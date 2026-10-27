using Hub;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using System.Text.Json;
namespace Hub;

public static class TaskEndpoints
{
    public static void MapHubTasks(this WebApplication app)
    {
        var api = app.MapGroup("/api").RequireAuthorization();
        api.MapGet("/tasks", async (HttpContext c, HubDb db) => Results.Ok(await db.Tasks.AsNoTracking().Where(x => x.UserId == Access.Owner(c) && !x.Archived).OrderBy(x => x.StartDate).ToListAsync()));
        api.MapGet("/tasks/{id:guid}", async (Guid id, HttpContext c, HubDb db) => await Owned(db, c, id) is { } t ? Results.Ok(t) : Results.NotFound());
        api.MapPost("/tasks", async (TaskInput input, HttpContext c, HubDb db) =>
        {
            if (Schedule.Validate(input) is { } error) return Results.BadRequest(new { detail = error });
            var t = new TaskItem { UserId = Access.Owner(c) }; Apply(t, input); db.Tasks.Add(t); await db.SaveChangesAsync(); return Results.Created($"/api/tasks/{t.Id}", t);
        });
        api.MapPut("/tasks/{id:guid}", async (Guid id, TaskInput input, HttpContext c, HubDb db) =>
        {
            var t = await Owned(db, c, id); if (t is null) return Results.NotFound(); if (Schedule.Validate(input) is { } error) return Results.BadRequest(new { detail = error });
            // Once history exists, schedule and checklist structure are immutable to preserve historical meaning.
            if (await db.Completions.AnyAsync(x => x.UserId == Access.Owner(c) && x.TaskId == id) && (t.StartDate != input.StartDate || t.DueDate != input.DueDate || t.Recurrence != input.Recurrence || t.Checklist != JsonSerializer.Serialize(input.Checklist))) return Results.Conflict(new { detail = "This task has history. Create a new task to change its schedule or checklist." });
            Apply(t, input); await db.SaveChangesAsync(); return Results.Ok(t);
        });
        api.MapDelete("/tasks/{id:guid}", async (Guid id, HttpContext c, HubDb db) => { var t = await Owned(db, c, id); if (t is null) return Results.NotFound(); t.Archived = true; await db.SaveChangesAsync(); return Results.NoContent(); });
        api.MapGet("/activity", async (DateOnly from, DateOnly to, HttpContext c, HubDb db) =>
        {
            if (to < from || to.DayNumber - from.DayNumber > 366) return Results.BadRequest(new { detail = "Select at most 367 days." });
            var owner = Access.Owner(c); var tasks = await db.Tasks.AsNoTracking().Where(x => x.UserId == owner).ToListAsync();
            var records = await db.Completions.AsNoTracking().Where(x => x.UserId == owner && x.Date >= from && x.Date <= to).ToListAsync();
            return Results.Ok(new { tasks, records });
        });
        api.MapPut("/tasks/{id:guid}/completion/{date}", async (Guid id, DateOnly date, CompletionInput input, HttpContext c, HubDb db) =>
        {
            var t = await Owned(db, c, id); if (t is null) return Results.NotFound();
            var u = await db.Users.SingleAsync(x => x.Id == Access.Owner(c)); var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(u.Timezone)));
            var count = JsonSerializer.Deserialize<string[]>(t.Checklist)!.Length;
            if (!Schedule.Occurs(t, date) || date > today || input.CheckedItems is null || input.CheckedItems.Any(i => i < 0 || i >= count)) return Results.BadRequest(new { detail = "Invalid occurrence, future date, or checklist item." });
            var r = await db.Completions.SingleOrDefaultAsync(x => x.TaskId == id && x.UserId == Access.Owner(c) && x.Date == date);
            if (r is null) { r = new Completion { TaskId = id, UserId = Access.Owner(c), Date = date }; db.Completions.Add(r); }
            r.Done = input.Done; r.CheckedItems = JsonSerializer.Serialize(input.CheckedItems.Distinct().Order().ToArray()); r.UpdatedAt = DateTime.UtcNow;
            try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Results.Conflict(new { detail = "Another update occurred. Refresh and retry." }); }
            return Results.Ok(r);
        });

    }
    static Task<TaskItem?> Owned(HubDb db, HttpContext c, Guid id) => db.Tasks.SingleOrDefaultAsync(x => x.Id == id && x.UserId == Access.Owner(c) && !x.Archived);
    static void Apply(TaskItem t, TaskInput i) { t.Title = i.Title.Trim(); t.Notes = i.Notes; t.Category = i.Category.Trim(); t.Priority = i.Priority; t.StartDate = i.StartDate; t.DueDate = i.DueDate; t.Recurrence = i.Recurrence; t.Checklist = JsonSerializer.Serialize(i.Checklist); }

}

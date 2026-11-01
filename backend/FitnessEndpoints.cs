using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
namespace Hub;

public static class FitnessEndpoints
{
    static object VersionView(FitnessVersion v) => new { v.Id, v.PlanId, v.Version, v.Hash, v.EffectiveFrom, v.ImportedAt, document = JsonSerializer.Deserialize<JsonElement>(v.Document) };
    static object SessionView(FitnessSession s) => new { s.Id, s.PlanId, s.VersionId, s.Date, s.Status, s.Notes, s.Revision, s.StartedAt, s.FinishedAt, planned = JsonSerializer.Deserialize<JsonElement>(s.Planned), sets = JsonSerializer.Deserialize<List<ActualSet>>(s.Actual) };
    static async Task<string> Body(HttpRequest request)
    {
        const int max = 120 * 1024;
        if (request.ContentLength > max) throw new ArgumentException("The JSON file exceeds 96 KiB.");
        using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
        while ((count = await request.Body.ReadAsync(buffer)) != 0) { if (output.Length + count > max) throw new ArgumentException("The JSON file exceeds 96 KiB."); await output.WriteAsync(buffer.AsMemory(0, count)); }
        return Encoding.UTF8.GetString(output.ToArray());
    }
    static async Task<string> UserTimezone(HubDb db, Guid owner) => (await db.Users.SingleAsync(x => x.Id == owner)).Timezone;
    static DateOnly Effective(WorkoutPlan p, bool update)
    {
        var minimum = FitnessCodec.Today(p.Timezone!).AddDays(update ? 1 : 0);
        return update ? (p.StartDate > minimum ? p.StartDate.Value : minimum) : p.StartDate ?? minimum;
    }
    static string? ModeError(string? mode, bool exists) => mode == "create" && exists ? "This plan exists. Use import_mode update or upsert." : mode == "update" && !exists ? "This plan does not exist in your account. Use create or upsert." : null;

    public static void MapHubFitness(this WebApplication app)
    {
        var api = app.MapGroup("/api/fitness").RequireAuthorization();
        api.MapGet("/plans", async (HttpContext c, HubDb db) =>
        {
            var owner = Access.Owner(c);
            var plans = await db.FitnessPlans.AsNoTracking().Where(x => x.UserId == owner).OrderBy(x => x.CreatedAt).ToListAsync();
            var versions = await db.FitnessVersions.AsNoTracking().Where(x => x.UserId == owner).OrderByDescending(x => x.ImportedAt).ToListAsync();
            return Results.Ok(plans.Select(p => new { p.Id, p.ExternalId, versions = versions.Where(v => v.PlanId == p.Id).Select(VersionView) }));
        });
        api.MapGet("/plans/{id:guid}", async (Guid id, HttpContext c, HubDb db) =>
        {
            var owner = Access.Owner(c); var p = await db.FitnessPlans.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == owner);
            return p is null ? Results.NotFound() : Results.Ok(new { p.Id, p.ExternalId, versions = (await db.FitnessVersions.AsNoTracking().Where(v => v.PlanId == id && v.UserId == owner).OrderByDescending(v => v.ImportedAt).ToListAsync()).Select(VersionView) });
        });
        api.MapPost("/import/preview", async (HttpContext c, HubDb db) =>
        {
            try
            {
                var owner = Access.Owner(c); var input = FitnessCodec.Parse(await Body(c.Request), await UserTimezone(db, owner)); var p = input.Plan!;
                var plan = await db.FitnessPlans.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == owner && x.ExternalId == p.ExternalId);
                if (ModeError(input.ImportMode, plan is not null) is { } error) return Results.Conflict(new { detail = error });
                var versions = plan is null ? [] : await db.FitnessVersions.AsNoTracking().Where(x => x.PlanId == plan.Id && x.UserId == owner).OrderByDescending(x => x.ImportedAt).ToListAsync();
                if (versions.Any(x => x.Version == p.Version)) return Results.Conflict(new { detail = "This plan version was already imported. Give the updated plan a new version." });
                var current = versions.FirstOrDefault();
                return Results.Ok(new { document = JsonSerializer.Deserialize<JsonElement>(FitnessCodec.Encode(input)), current = current is null ? null : VersionView(current), expectedHash = current?.Hash, effectiveFrom = Effective(p, current is not null) });
            }
            catch (ArgumentException e) { return Results.BadRequest(new { detail = e.Message }); }
        });
        api.MapPost("/import/confirm", async (HttpContext c, HubDb db) =>
        {
            try
            {
                ConfirmFitnessImport? request;
                try { request = JsonSerializer.Deserialize<ConfirmFitnessImport>(await Body(c.Request), new JsonSerializerOptions(JsonSerializerDefaults.Web) { MaxDepth = 28 }); }
                catch (JsonException) { return Results.BadRequest(new { detail = "Invalid confirmation request." }); }
                if (request is null || !request.Confirm || request.Document.ValueKind != JsonValueKind.Object) return Results.BadRequest(new { detail = "Confirm the import after reviewing the preview." });
                var owner = Access.Owner(c); var input = FitnessCodec.Parse(request.Document.GetRawText(), await UserTimezone(db, owner)); var p = input.Plan!;
                await using var transaction = await db.Database.BeginTransactionAsync();
                var plan = await db.FitnessPlans.SingleOrDefaultAsync(x => x.UserId == owner && x.ExternalId == p.ExternalId);
                if (ModeError(input.ImportMode, plan is not null) is { } error) return Results.Conflict(new { detail = error });
                var current = plan is null ? null : await db.FitnessVersions.Where(x => x.PlanId == plan.Id && x.UserId == owner).OrderByDescending(x => x.ImportedAt).FirstOrDefaultAsync();
                if (request.ExpectedHash != current?.Hash) return Results.Conflict(new { detail = "The plan changed since preview. Preview the file again." });
                if (plan is not null && await db.FitnessVersions.AnyAsync(x => x.PlanId == plan.Id && x.UserId == owner && x.Version == p.Version)) return Results.Conflict(new { detail = "This plan version was already imported. Give the updated plan a new version." });
                if (plan is null) { plan = new FitnessPlan { UserId = owner, ExternalId = p.ExternalId! }; db.FitnessPlans.Add(plan); }
                plan.Revision++;
                var document = FitnessCodec.Encode(input);
                var version = new FitnessVersion { UserId = owner, PlanId = plan.Id, Version = p.Version!, Document = document, Hash = FitnessCodec.Hash(document), EffectiveFrom = Effective(p, current is not null) };
                db.FitnessVersions.Add(version); await db.SaveChangesAsync(); await transaction.CommitAsync();
                return Results.Created($"/api/fitness/plans/{plan.Id}", VersionView(version));
            }
            catch (ArgumentException e) { return Results.BadRequest(new { detail = e.Message }); }
            catch (DbUpdateException) { return Results.Conflict(new { detail = "Another import occurred. Preview and retry." }); }
        });
        api.MapGet("/schedule", async (DateOnly from, DateOnly to, HttpContext c, HubDb db) =>
        {
            if (to < from || to.DayNumber - from.DayNumber > 92) return Results.BadRequest(new { detail = "Select at most 93 fitness days." });
            var owner = Access.Owner(c);
            var versions = await db.FitnessVersions.AsNoTracking().Where(x => x.UserId == owner && x.EffectiveFrom <= to).ToListAsync();
            var sessions = await db.FitnessSessions.AsNoTracking().Where(x => x.UserId == owner && x.Date >= from && x.Date <= to).ToListAsync();
            var events = new List<object>();
            foreach (var group in versions.GroupBy(x => x.PlanId))
            for (var date = from; date <= to; date = date.AddDays(1))
            {
                var v = group.Where(x => x.EffectiveFrom <= date).OrderByDescending(x => x.EffectiveFrom).ThenByDescending(x => x.ImportedAt).FirstOrDefault();
                if (v is null) continue;
                var p = JsonSerializer.Deserialize<WorkoutImport>(v.Document, FitnessCodec.Json)!.Plan!;
                var day = p.Days!.SingleOrDefault(x => x.Weekday == FitnessCodec.Weekday(date));
                var session = sessions.SingleOrDefault(x => x.PlanId == group.Key && x.Date == date);
                var rest = day is null || day.Exercises!.Count == 0;
                var status = session?.Status ?? (rest ? "rest" : date < FitnessCodec.Today(p.Timezone!) ? "missed" : "scheduled");
                events.Add(new { planId = group.Key, versionId = session?.VersionId ?? v.Id, date, planName = p.Name, title = session is null ? day?.Title ?? p.Name : JsonSerializer.Deserialize<WorkoutDay>(session.Planned, FitnessCodec.Json)?.Title, status, sessionId = session?.Id, canStart = !rest && date == FitnessCodec.Today(p.Timezone!) });
            }
            return Results.Ok(events);
        });
        api.MapPost("/sessions", async (StartFitnessSession input, HttpContext c, HubDb db) =>
        {
            var owner = Access.Owner(c);
            if (!await db.FitnessPlans.AnyAsync(x => x.Id == input.PlanId && x.UserId == owner)) return Results.NotFound();
            var existing = await db.FitnessSessions.SingleOrDefaultAsync(x => x.PlanId == input.PlanId && x.UserId == owner && x.Date == input.Date);
            if (existing is not null) return Results.Ok(SessionView(existing));
            var v = await db.FitnessVersions.Where(x => x.PlanId == input.PlanId && x.UserId == owner && x.EffectiveFrom <= input.Date).OrderByDescending(x => x.EffectiveFrom).ThenByDescending(x => x.ImportedAt).FirstOrDefaultAsync();
            if (v is null) return Results.BadRequest(new { detail = "No plan version is scheduled for this date." });
            var p = JsonSerializer.Deserialize<WorkoutImport>(v.Document, FitnessCodec.Json)!.Plan!;
            var day = p.Days!.SingleOrDefault(x => x.Weekday == FitnessCodec.Weekday(input.Date));
            if (input.Date != FitnessCodec.Today(p.Timezone!) || day is null || day.Exercises!.Count == 0) return Results.BadRequest(new { detail = "Start workouts only on their scheduled day. Rest days cannot be started." });
            var s = new FitnessSession { UserId = owner, PlanId = input.PlanId, VersionId = v.Id, Date = input.Date, Weekday = day.Weekday, Planned = FitnessCodec.Encode(day) };
            db.FitnessSessions.Add(s);
            try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Results.Conflict(new { detail = "The session was already started. Refresh and retry." }); }
            return Results.Created($"/api/fitness/sessions/{s.Id}", SessionView(s));
        });
        api.MapGet("/sessions", async (HttpContext c, HubDb db) => Results.Ok((await db.FitnessSessions.AsNoTracking().Where(x => x.UserId == Access.Owner(c)).OrderByDescending(x => x.Date).ToListAsync()).Select(SessionView)));
        api.MapGet("/sessions/{id:guid}", async (Guid id, HttpContext c, HubDb db) => await db.FitnessSessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == Access.Owner(c)) is { } s ? Results.Ok(SessionView(s)) : Results.NotFound());
        api.MapPut("/sessions/{id:guid}", async (Guid id, SaveFitnessSession input, HttpContext c, HubDb db) =>
        {
            var s = await db.FitnessSessions.SingleOrDefaultAsync(x => x.Id == id && x.UserId == Access.Owner(c));
            if (s is null) return Results.NotFound();
            if (s.Status != "in_progress") return Results.Conflict(new { detail = "Finished sessions are immutable." });
            if (input.Revision != s.Revision) return Results.Conflict(new { detail = "The session changed. Refresh before saving." });
            var day = JsonSerializer.Deserialize<WorkoutDay>(s.Planned, FitnessCodec.Json)!;
            if (ValidateActual(input, day) is { } error) return Results.BadRequest(new { detail = error });
            s.Actual = JsonSerializer.Serialize(input.Sets); s.Notes = input.Notes ?? ""; s.Status = input.Status; s.Revision++;
            if (s.Status != "in_progress") s.FinishedAt = DateTime.UtcNow;
            try { await db.SaveChangesAsync(); } catch (DbUpdateConcurrencyException) { return Results.Conflict(new { detail = "The session changed. Refresh before saving." }); }
            return Results.Ok(SessionView(s));
        });
        api.MapGet("/statistics", async (HttpContext c, HubDb db) =>
        {
            var sessions = await db.FitnessSessions.AsNoTracking().Where(x => x.UserId == Access.Owner(c) && x.Status == "completed").OrderBy(x => x.Date).ToListAsync();
            return Results.Ok(new { totalCompleted = sessions.Count, activeDays = sessions.Select(x => x.Date).Distinct().Count(), performance = sessions.SelectMany(s => (JsonSerializer.Deserialize<List<ActualSet>>(s.Actual) ?? []).Where(x => x.Completed && !x.Skipped).Select(x => new { s.Id, s.PlanId, s.VersionId, s.Date, set = x })) });
        });
    }
    public static string? ValidateActual(SaveFitnessSession input, WorkoutDay day)
    {
        if (input.Status is not ("in_progress" or "completed" or "skipped") || input.Notes?.Length > 10000 || input.Sets is null || input.Sets.Count > 500 || input.Sets.Any(x => x is null)) return "Invalid workout status, notes or sets.";
        if (input.Sets.Select(x => (x.ExerciseId, x.Set)).Distinct().Count() != input.Sets.Count) return "Duplicate exercise sets are not allowed.";
        foreach (var set in input.Sets)
        {
            if (set is null) return "Invalid set.";
            var exercise = day.Exercises!.SingleOrDefault(x => x.Id == set.ExerciseId);
            if (exercise is null || set.Set < 1 || set.Set > exercise.Sets || set.Repetitions is < 0 or > 10000 || set.Weight is < 0 or > 10000 || set.DurationSeconds is < 0 or > 86400 || set.Notes?.Length > 2000 || set.Completed && set.Skipped || set.Weight.HasValue && set.Unit is not ("kg" or "lb")) return "Invalid exercise ID, set number, repetitions, weight, duration or notes.";
        }
        if (input.Status == "completed" && day.Exercises!.Any(e => Enumerable.Range(1, e.Sets ?? 1).Any(n => !input.Sets.Any(x => x.ExerciseId == e.Id && x.Set == n && (x.Completed || x.Skipped))))) return "Complete or skip every planned set before finishing.";
        return null;
    }
}

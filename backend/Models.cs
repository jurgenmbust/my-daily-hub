using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
namespace Hub;

public class HubUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsAdmin { get; set; }
    public string Timezone { get; set; } = "America/Costa_Rica";
}
public class TaskItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Title { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Category { get; set; } = "Personal";
    public int Priority { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? DueDate { get; set; }
    public string Recurrence { get; set; } = "none";
    public string Checklist { get; set; } = "[]";
    public bool Archived { get; set; }
}
public class Completion
{
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public bool Done { get; set; }
    public string CheckedItems { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
public class HubDb(DbContextOptions<HubDb> options) : DbContext(options)
{
    public DbSet<FitnessPlan> FitnessPlans => Set<FitnessPlan>();
    public DbSet<FitnessVersion> FitnessVersions => Set<FitnessVersion>();
    public DbSet<FitnessSession> FitnessSessions => Set<FitnessSession>();
    public DbSet<HubUser> Users => Set<HubUser>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<Completion> Completions => Set<Completion>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        FitnessCodec.Configure(b);
        b.Entity<HubUser>().HasIndex(x => x.Username).IsUnique();
        b.Entity<TaskItem>().HasIndex(x => new { x.UserId, x.StartDate });
        b.Entity<TaskItem>().HasOne<HubUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Completion>().HasKey(x => new { x.TaskId, x.Date });
        b.Entity<Completion>().HasIndex(x => new { x.UserId, x.Date });
        b.Entity<TaskItem>().HasAlternateKey(x => new { x.Id, x.UserId });
        b.Entity<Completion>().HasOne<TaskItem>().WithMany().HasForeignKey(x => new { x.TaskId, x.UserId }).HasPrincipalKey(x => new { x.Id, x.UserId }).OnDelete(DeleteBehavior.Cascade);
    }
}
public record LoginInput(string Username, string Password);
public record UserInput(string Username, string Password, bool IsAdmin);
public record TaskInput(string Title, string Notes, string Category, int Priority, DateOnly StartDate, DateOnly? DueDate, string Recurrence, string[] Checklist);
public record CompletionInput(bool Done, int[] CheckedItems);
public record TimezoneInput(string Timezone);
public static class Schedule
{
    public static bool Occurs(TaskItem t, DateOnly d) => d >= t.StartDate && (t.Recurrence switch
    {
        "daily" => !t.DueDate.HasValue || d <= t.DueDate,
        "weekly" => d.DayOfWeek == t.StartDate.DayOfWeek && (!t.DueDate.HasValue || d <= t.DueDate),
        _ => d == (t.DueDate ?? t.StartDate)
    });
    public static string? Validate(TaskInput x) => string.IsNullOrWhiteSpace(x.Title) || x.Title.Length > 200 ? "Title is required (maximum 200 characters)." :
     x.Notes is null || x.Notes.Length > 10000 || x.Category is null || x.Category.Length > 80 ? "Notes or category exceeds its limit." :
     x.Priority is < 0 or > 2 || !new[] { "none", "daily", "weekly" }.Contains(x.Recurrence) ? "Invalid priority or recurrence." :
     x.DueDate < x.StartDate ? "Due date must be on or after the start date." :
     x.Checklist is null || x.Checklist.Length > 50 || x.Checklist.Any(s => string.IsNullOrWhiteSpace(s) || s.Length > 200) ? "Checklist supports up to 50 nonempty items of 200 characters." : null;
}

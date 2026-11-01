using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Cryptography;
using System.Text;
namespace Hub;

public class FitnessPlan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string ExternalId { get; set; } = "";
    public int Revision { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class FitnessVersion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PlanId { get; set; }
    public Guid UserId { get; set; }
    public string Version { get; set; } = "";
    public string Document { get; set; } = "";
    public string Hash { get; set; } = "";
    public DateOnly EffectiveFrom { get; set; }
    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
}
public class FitnessSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid PlanId { get; set; }
    public Guid VersionId { get; set; }
    public DateOnly Date { get; set; }
    public int Weekday { get; set; }
    public string Status { get; set; } = "in_progress";
    public string Planned { get; set; } = "";
    public string Actual { get; set; } = "[]";
    public string Notes { get; set; } = "";
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public int Revision { get; set; }
}
public class WorkoutImport
{
    public JsonElement SchemaVersion { get; set; }
    public string? ImportMode { get; set; } = "upsert";
    public WorkoutPlan? Plan { get; set; }
}
public class WorkoutPlan
{
    public string? ExternalId { get; set; }
    public string? Name { get; set; }
    [JsonConverter(typeof(FitnessStringConverter))] public string? Version { get; set; }
    public string? Language { get; set; }
    public string? Timezone { get; set; }
    public DateOnly? StartDate { get; set; }
    public string? Description { get; set; }
    public int? GeneralRestSeconds { get; set; }
    public List<WorkoutDay>? Days { get; set; }
}
public class WorkoutDay
{
    [JsonConverter(typeof(FitnessWeekdayConverter))] public int Weekday { get; set; }
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public List<WorkoutExercise>? Exercises { get; set; }
}
public class WorkoutExercise
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public int? Sets { get; set; }
    public WorkoutRange? Repetitions { get; set; }
    public WorkoutRange? DurationSeconds { get; set; }
    public WorkoutWeight? SuggestedWeight { get; set; }
    public bool? PerSide { get; set; }
    public string? Notes { get; set; }
}
public record WorkoutRange(int? Min, int? Max);
public record WorkoutWeight(decimal? Value, string? Unit);
public record ActualSet(string ExerciseId, int Set, bool Completed, bool Skipped, int? Repetitions, decimal? Weight, string? Unit, int? DurationSeconds, string? Notes);
public record SaveFitnessSession(int Revision, string Status, string? Notes, List<ActualSet>? Sets);
public record StartFitnessSession(Guid PlanId, DateOnly Date);
public record ConfirmFitnessImport(JsonElement Document, string? ExpectedHash, bool Confirm);

public class FitnessStringConverter : JsonConverter<string>
{
    public override string? Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => r.TokenType switch
    { JsonTokenType.String => r.GetString(), JsonTokenType.Number => JsonDocument.ParseValue(ref r).RootElement.GetRawText(), _ => throw new JsonException("version must be a string or number") };
    public override void Write(Utf8JsonWriter w, string value, JsonSerializerOptions o) => w.WriteStringValue(value);
}
public class FitnessWeekdayConverter : JsonConverter<int>
{
    public override int Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o)
    {
        if (r.TokenType == JsonTokenType.Number) return r.GetInt32();
        if (r.TokenType != JsonTokenType.String) throw new JsonException("weekday must be 1–7 or a day name");
        var name = r.GetString()!.ToLowerInvariant();
        string[][] names = [["monday", "mon", "lunes"], ["tuesday", "tue", "martes"], ["wednesday", "wed", "miércoles", "miercoles"], ["thursday", "thu", "jueves"], ["friday", "fri", "viernes"], ["saturday", "sat", "sábado", "sabado"], ["sunday", "sun", "domingo"]];
        for (var i = 0; i < 7; i++) if (names[i].Contains(name)) return i + 1;
        throw new JsonException("Unknown weekday");
    }
    public override void Write(Utf8JsonWriter w, int value, JsonSerializerOptions o) => w.WriteNumberValue(value);
}
public static class FitnessCodec
{
    public const int MaxBytes = 96 * 1024;
    public static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower, MaxDepth = 24 };
    public static string Encode<T>(T value) => JsonSerializer.Serialize(value, Json);
    public static WorkoutImport Parse(string raw, string timezone)
    {
        if (Encoding.UTF8.GetByteCount(raw) > MaxBytes) throw new ArgumentException("The JSON file exceeds 96 KiB.");
        WorkoutImport input;
        try { input = JsonSerializer.Deserialize<WorkoutImport>(raw, Json) ?? throw new JsonException(); }
        catch (Exception e) when (e is JsonException or FormatException or OverflowException) { throw new ArgumentException("Invalid workout JSON. Check field types, dates and weekday values."); }
        if (input.SchemaVersion.ValueKind is not (JsonValueKind.String or JsonValueKind.Number) || !new[] { "1", "1.0" }.Contains(input.SchemaVersion.ToString())) throw new ArgumentException("Unsupported schema_version. Use version 1.");
        input.ImportMode ??= "upsert";
        if (!new[] { "create", "update", "upsert" }.Contains(input.ImportMode)) throw new ArgumentException("import_mode must be create, update or upsert.");
        var p = input.Plan ?? throw new ArgumentException("plan is required.");
        if (string.IsNullOrWhiteSpace(p.ExternalId) || p.ExternalId.Length > 100 || p.ExternalId.Any(char.IsControl) || string.IsNullOrWhiteSpace(p.Name) || p.Name.Length > 200 || string.IsNullOrWhiteSpace(p.Version) || p.Version.Length > 50 || p.Version.Any(char.IsControl)) throw new ArgumentException("Plan external_id, name and version are required (100/200/50 characters maximum).");
        p.ExternalId = p.ExternalId.Trim(); p.Name = p.Name.Trim(); p.Version = p.Version.Trim();
        p.Timezone ??= timezone; p.Language ??= "es";
        try { TimeZoneInfo.FindSystemTimeZoneById(p.Timezone); } catch { throw new ArgumentException("Unknown plan timezone."); }
        if (p.Language is not ("en" or "es") || p.Description?.Length > 10000 || p.GeneralRestSeconds is < 0 or > 3600 || p.Timezone.Length > 100) throw new ArgumentException("Invalid plan language, description, timezone or rest interval.");
        if (p.Days is null || p.Days.Count is < 1 or > 7 || p.Days.Any(x => x is null) || p.Days.Select(x => x.Weekday).Distinct().Count() != p.Days.Count) throw new ArgumentException("Include 1–7 unique workout days.");
        var total = 0;
        foreach (var day in p.Days)
        {
            if (day.Weekday is < 1 or > 7 || day.Title?.Length > 200 || day.Notes?.Length > 10000) throw new ArgumentException("Invalid day weekday, title or notes.");
            day.Exercises ??= []; // Empty days are explicit rest days.
            if (day.Exercises.Count > 40 || day.Exercises.Any(x => x is null) || day.Exercises.Select(x => x.Id).Distinct().Count() != day.Exercises.Count) throw new ArgumentException("Each day supports up to 40 exercises with unique IDs.");
            foreach (var e in day.Exercises)
            {
                e.Sets ??= 1;
                if (string.IsNullOrWhiteSpace(e.Id) || e.Id.Length > 100 || string.IsNullOrWhiteSpace(e.Name) || e.Name.Length > 200 || e.Sets is < 1 or > 30 || e.Notes?.Length > 10000) throw new ArgumentException("Exercise id/name are required; sets must be 1–30 and text must fit its limits.");
                total += e.Sets.Value;
                if (!Range(e.Repetitions, 10000) || !Range(e.DurationSeconds, 86400)) throw new ArgumentException("Invalid repetition or duration range (min must not exceed max).");
                if (e.SuggestedWeight is { } w && (w.Value is < 0 or > 10000 || (w.Value.HasValue && w.Unit is not ("kg" or "lb")))) throw new ArgumentException("Weight must be 0–10000 and use kg or lb.");
            }
        }
        if (total > 500) throw new ArgumentException("Plan supports at most 500 sets per week.");
        return input;
    }
    static bool Range(WorkoutRange? r, int max) => r is null || (r.Min is null || r.Min >= 0 && r.Min <= max) && (r.Max is null || r.Max >= 0 && r.Max <= max) && !(r.Min > r.Max);
    public static string Hash(string raw) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    public static DateOnly Today(string zone) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(zone)));
    public static int Weekday(DateOnly date) => ((int)date.DayOfWeek + 6) % 7 + 1;
    public static void Configure(ModelBuilder b)
    {
        b.Entity<FitnessPlan>().HasIndex(x => new { x.UserId, x.ExternalId }).IsUnique();
        b.Entity<FitnessPlan>().HasAlternateKey(x => new { x.Id, x.UserId });
        b.Entity<FitnessPlan>().Property(x => x.ExternalId).HasMaxLength(100);
        b.Entity<FitnessPlan>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<FitnessPlan>().HasOne<HubUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<FitnessVersion>().HasIndex(x => new { x.PlanId, x.Version }).IsUnique();
        b.Entity<FitnessVersion>().Property(x => x.Version).HasMaxLength(50);
        b.Entity<FitnessVersion>().HasAlternateKey(x => new { x.Id, x.PlanId, x.UserId });
        b.Entity<FitnessVersion>().HasOne<FitnessPlan>().WithMany().HasForeignKey(x => new { x.PlanId, x.UserId }).HasPrincipalKey(x => new { x.Id, x.UserId }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<FitnessSession>().HasIndex(x => new { x.PlanId, x.Date }).IsUnique();
        b.Entity<FitnessSession>().HasIndex(x => new { x.UserId, x.Date });
        b.Entity<FitnessSession>().Property(x => x.Revision).IsConcurrencyToken();
        b.Entity<FitnessSession>().HasOne<FitnessVersion>().WithMany().HasForeignKey(x => new { x.VersionId, x.PlanId, x.UserId }).HasPrincipalKey(x => new { x.Id, x.PlanId, x.UserId }).OnDelete(DeleteBehavior.Restrict);
    }
}

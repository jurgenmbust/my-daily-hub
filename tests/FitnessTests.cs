using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Hub;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class FitnessTests
{
    static string Document(string version = "1", string external = "strength") => FitnessCodec.Encode(new WorkoutImport {
        SchemaVersion = JsonSerializer.SerializeToElement(1), ImportMode = "upsert", Plan = new WorkoutPlan {
            ExternalId = external, Name = "Mi entrenamiento", Version = version, Timezone = "America/Costa_Rica", Language = "es",
            Days = Enumerable.Range(1, 7).Select(i => new WorkoutDay { Weekday = i, Title = "Fuerza", Exercises = [new WorkoutExercise { Id = "squat", Name = "Sentadilla", Sets = 2, Repetitions = new(8, 12), SuggestedWeight = new(10, "kg"), PerSide = null }] }).ToList()
        }
    });
    static async Task<JsonElement> Import(HttpClient c, string raw)
    {
        var preview = await c.PostAsync("/api/fitness/import/preview", new StringContent(raw, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, preview.StatusCode);
        var p = await preview.Content.ReadFromJsonAsync<JsonElement>();
        var saved = await c.PostAsJsonAsync("/api/fitness/import/confirm", new { document = p.GetProperty("document"), expectedHash = p.GetProperty("expectedHash").ValueKind == JsonValueKind.Null ? null : p.GetProperty("expectedHash").GetString(), confirm = true });
        Assert.Equal(HttpStatusCode.Created, saved.StatusCode);
        return await saved.Content.ReadFromJsonAsync<JsonElement>();
    }
    [Fact]
    public void Import_validates_schema_optional_nulls_and_limits()
    {
        var valid = Document(); var input = FitnessCodec.Parse(valid, "America/Costa_Rica");
        Assert.Null(input.Plan!.Days![0].Exercises![0].DurationSeconds);
        Assert.Throws<ArgumentException>(() => FitnessCodec.Parse(valid.Replace("\"schema_version\":1", "\"schema_version\":2"), "UTC"));
        Assert.Throws<ArgumentException>(() => FitnessCodec.Parse(valid.Replace("\"sets\":2", "\"sets\":-1"), "UTC"));
        Assert.Throws<ArgumentException>(() => FitnessCodec.Parse(valid.Replace("\"weekday\":1", "\"weekday\":1.5"), "UTC"));
        Assert.Throws<ArgumentException>(() => FitnessCodec.Parse(valid.Replace("\"min\":8", "\"min\":30"), "UTC"));
        Assert.Throws<ArgumentException>(() => FitnessCodec.Parse(valid.Replace("America/Costa_Rica", "Not/AZone"), "UTC"));
        Assert.Throws<ArgumentException>(() => FitnessCodec.Parse(new string('x', FitnessCodec.MaxBytes + 1), "UTC"));
        Assert.Throws<ArgumentException>(() => FitnessCodec.Parse("{broken", "UTC"));
        var day = input.Plan.Days[0];
        Assert.NotNull(FitnessEndpoints.ValidateActual(new(0, "completed", null, []), day));
        Assert.NotNull(FitnessEndpoints.ValidateActual(new(0, "in_progress", null, [new("foreign-exercise", 1, true, false, 1, null, null, null, null)]), day));
    }
    [Fact]
    public async Task Versions_are_transactional_and_completed_history_is_immutable()
    {
        using var f = new Factory(); await f.Seed(); using var a = await f.Login("alice");
        var v1 = await Import(a, Document()); var plan = v1.GetProperty("planId").GetGuid();
        var started = await a.PostAsJsonAsync("/api/fitness/sessions", new StartFitnessSession(plan, FitnessCodec.Today("America/Costa_Rica")));
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<JsonElement>(); var sid = session.GetProperty("id").GetGuid();
        var actual = new List<ActualSet> { new("squat", 1, true, false, 9, 12, "kg", null, "Controlado"), new("squat", 2, false, true, null, null, null, null, "Descanso") };
        Assert.Equal(HttpStatusCode.OK, (await a.PutAsJsonAsync($"/api/fitness/sessions/{sid}", new SaveFitnessSession(0, "completed", "Buen día", actual))).StatusCode);
        var before = await a.GetStringAsync($"/api/fitness/sessions/{sid}");
        var v2 = await Import(a, Document("2").Replace("Sentadilla", "Sentadilla actualizada").Replace("\"sets\":2", "\"sets\":3"));
        Assert.Equal(FitnessCodec.Today("America/Costa_Rica").AddDays(1), DateOnly.Parse(v2.GetProperty("effectiveFrom").GetString()!));
        Assert.Equal(before, await a.GetStringAsync($"/api/fitness/sessions/{sid}"));
        Assert.Equal(HttpStatusCode.Conflict, (await a.PutAsJsonAsync($"/api/fitness/sessions/{sid}", new SaveFitnessSession(1, "completed", "changed", actual))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await a.PostAsync("/api/fitness/import/preview", new StringContent(Document("2"), Encoding.UTF8, "application/json"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsync("/api/fitness/import/preview", new StringContent(Document("3").Replace("\"sets\":2", "\"sets\":0"), Encoding.UTF8, "application/json"))).StatusCode);
        var plans = await a.GetFromJsonAsync<JsonElement>("/api/fitness/plans"); Assert.Equal(2, plans[0].GetProperty("versions").GetArrayLength());
        var stats = await a.GetFromJsonAsync<JsonElement>("/api/fitness/statistics"); Assert.Equal(1, stats.GetProperty("totalCompleted").GetInt32()); Assert.Single(stats.GetProperty("performance").EnumerateArray());
        var today = FitnessCodec.Today("America/Costa_Rica");
        var events = await a.GetFromJsonAsync<JsonElement>($"/api/fitness/schedule?from={today:yyyy-MM-dd}&to={today.AddDays(1):yyyy-MM-dd}");
        Assert.Equal(2, events.GetArrayLength()); Assert.Equal("completed", events[0].GetProperty("status").GetString());
        Assert.Equal(v1.GetProperty("id").GetGuid(), events[0].GetProperty("versionId").GetGuid());
        Assert.Equal(v2.GetProperty("id").GetGuid(), events[1].GetProperty("versionId").GetGuid());
    }
    [Fact]
    public async Task Every_fitness_operation_is_scoped_to_the_authenticated_owner()
    {
        using var f = new Factory(); await f.Seed(); using var a = await f.Login("alice"); using var b = await f.Login("bob");
        var first = await Import(a, Document()); var plan = first.GetProperty("planId").GetGuid();
        var start = await a.PostAsJsonAsync("/api/fitness/sessions", new StartFitnessSession(plan, FitnessCodec.Today("America/Costa_Rica")));
        var session = (await start.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/fitness/plans/{plan}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/fitness/sessions/{session}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PostAsJsonAsync("/api/fitness/sessions", new StartFitnessSession(plan, FitnessCodec.Today("America/Costa_Rica")))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PutAsJsonAsync($"/api/fitness/sessions/{session}", new SaveFitnessSession(0, "skipped", "", []))).StatusCode);
        Assert.Empty((await b.GetFromJsonAsync<JsonElement>("/api/fitness/plans")).EnumerateArray());
        Assert.Empty((await b.GetFromJsonAsync<JsonElement>("/api/fitness/sessions")).EnumerateArray());
        Assert.Equal(0, (await b.GetFromJsonAsync<JsonElement>("/api/fitness/statistics")).GetProperty("totalCompleted").GetInt32());
        using var scope = f.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<HubDb>(); var alice = await db.Users.SingleAsync(x => x.Username == "alice");
        // Unknown imported user IDs are ignored, not used as authorization.
        var bob = await Import(b, Document().Replace("\"plan\":{", $"\"user_id\":\"{alice.Id}\",\"plan\":{{"));
        Assert.NotEqual(plan, bob.GetProperty("planId").GetGuid());
        Assert.Equal(1, (await a.GetFromJsonAsync<JsonElement>("/api/fitness/plans" )).GetArrayLength());
        using var anon = f.CreateClient(new() { AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync("/api/fitness/plans")).StatusCode);
    }
    [Fact]
    public async Task Confirmation_detects_stale_preview_and_does_not_partially_save()
    {
        using var f = new Factory(); await f.Seed(); using var a = await f.Login("alice");
        var p = await a.PostAsync("/api/fitness/import/preview", new StringContent(Document(), Encoding.UTF8, "application/json"));
        var preview = await p.Content.ReadFromJsonAsync<JsonElement>();
        await Import(a, Document());
        var result = await a.PostAsJsonAsync("/api/fitness/import/confirm", new { document = preview.GetProperty("document"), expectedHash = (string?)null, confirm = true });
        Assert.Equal(HttpStatusCode.Conflict, result.StatusCode);
        var plans = await a.GetFromJsonAsync<JsonElement>("/api/fitness/plans"); Assert.Single(plans.EnumerateArray()); Assert.Single(plans[0].GetProperty("versions").EnumerateArray());
        result = await a.PostAsJsonAsync("/api/fitness/import/confirm", new { document = preview.GetProperty("document"), confirm = false });
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
    }
}

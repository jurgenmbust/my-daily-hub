using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hub;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

public class Factory : WebApplicationFactory<Program>
{
    readonly SqliteConnection connection = new("Data Source=:memory:");
    public Factory() { connection.Open(); }
    protected override void ConfigureWebHost(IWebHostBuilder b)
    {
        b.UseEnvironment("Testing"); b.UseSetting("KeyPath", Path.Combine(Path.GetTempPath(), "hub-test-keys")); b.ConfigureServices(s =>
        {
            s.RemoveAll<DbContextOptions<HubDb>>(); s.RemoveAll<Microsoft.EntityFrameworkCore.Infrastructure.IDbContextOptionsConfiguration<HubDb>>();
            s.AddDbContext<HubDb>(o => o.UseSqlite(connection));
        });
    }
    public async Task Seed() { using var scope = Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<HubDb>(); await db.Database.EnsureCreatedAsync(); var h = scope.ServiceProvider.GetRequiredService<IPasswordHasher<HubUser>>(); foreach (var name in new[] { "alice", "bob", "admin" }) { var u = new HubUser { Username = name, IsAdmin = name == "admin" }; u.PasswordHash = h.HashPassword(u, "very-long-test-password"); db.Users.Add(u); } await db.SaveChangesAsync(); }
    public async Task<HttpClient> Login(string name) { var c = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }); c.DefaultRequestHeaders.Add("X-Hub-Request", "1"); Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/auth/login", new LoginInput(name, "very-long-test-password"))).StatusCode); return c; }
    protected override void Dispose(bool disposing) { base.Dispose(disposing); if (disposing) connection.Dispose(); }
}
public class AuthorizationTests
{
    static TaskInput Input => new("Private task", "Secret note", "Personal", 2, new DateOnly(2026, 1, 1), null, "daily", ["private item"]);
    [Fact]
    public async Task Every_task_operation_enforces_ownership()
    {
        using var f = new Factory(); await f.Seed(); using var a = await f.Login("alice"); using var b = await f.Login("bob"); var created = await a.PostAsJsonAsync("/api/tasks", Input); Assert.Equal(HttpStatusCode.Created, created.StatusCode); var t = (await created.Content.ReadFromJsonAsync<TaskItem>())!;
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/tasks/{t.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PutAsJsonAsync($"/api/tasks/{t.Id}", Input with { Title = "stolen" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.DeleteAsync($"/api/tasks/{t.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PutAsJsonAsync($"/api/tasks/{t.Id}/completion/2026-01-01", new CompletionInput(true, [0]))).StatusCode);
        Assert.Empty((await b.GetFromJsonAsync<TaskItem[]>("/api/tasks"))!);
        var activity = await b.GetFromJsonAsync<JsonElement>("/api/activity?from=2026-01-01&to=2026-01-31"); Assert.Equal(0, activity.GetProperty("tasks").GetArrayLength()); Assert.Equal(0, activity.GetProperty("records").GetArrayLength());
        Assert.Equal(HttpStatusCode.OK, (await a.PutAsJsonAsync($"/api/tasks/{t.Id}/completion/2026-01-01", new CompletionInput(true, [0]))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await a.PutAsJsonAsync($"/api/tasks/{t.Id}/completion/2026-01-02", new CompletionInput(false, []))).StatusCode);
        var own = await a.GetFromJsonAsync<JsonElement>("/api/activity?from=2026-01-01&to=2026-01-31"); Assert.Equal(2, own.GetProperty("records").GetArrayLength());
        activity = await b.GetFromJsonAsync<JsonElement>("/api/activity?from=2026-01-01&to=2026-01-31"); Assert.Equal(0, activity.GetProperty("records").GetArrayLength());
        using var admin = await f.Login("admin"); Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/tasks/{t.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await a.DeleteAsync($"/api/tasks/{t.Id}")).StatusCode);
        own = await a.GetFromJsonAsync<JsonElement>("/api/activity?from=2026-01-01&to=2026-01-31"); Assert.Equal(2, own.GetProperty("records").GetArrayLength());
    }
    [Fact] public async Task Sessions_admin_and_request_protection_are_enforced() { using var f = new Factory(); await f.Seed(); using var anonymous = f.CreateClient(new() { AllowAutoRedirect = false }); Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/tasks")).StatusCode); using var b = await f.Login("bob"); Assert.Equal(HttpStatusCode.Forbidden, (await b.PostAsJsonAsync("/api/admin/users", new UserInput("eve", "long-enough-password", false))).StatusCode); using var admin = await f.Login("admin"); Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/users", new UserInput("eve", "long-enough-password", false))).StatusCode); b.DefaultRequestHeaders.Remove("X-Hub-Request"); Assert.Equal(HttpStatusCode.BadRequest, (await b.PostAsJsonAsync("/api/tasks", Input)).StatusCode); b.DefaultRequestHeaders.Add("X-Hub-Request", "1"); await b.PostAsync("/api/auth/logout", null); Assert.Equal(HttpStatusCode.Unauthorized, (await b.GetAsync("/api/tasks")).StatusCode); }
    [Theory]
    [InlineData("daily", "2026-01-02", true)]
    [InlineData("weekly", "2026-01-08", true)]
    [InlineData("weekly", "2026-01-02", false)]
    [InlineData("none", "2026-01-02", false)]
    public void Recurrence_has_independent_occurrences(string recurrence, string date, bool expected) { var t = new TaskItem { StartDate = new(2026, 1, 1), Recurrence = recurrence }; Assert.Equal(expected, Schedule.Occurs(t, DateOnly.Parse(date))); }
}

using Hub;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders(); builder.Logging.AddJsonConsole();
builder.Services.AddDbContext<HubDb>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database")));
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["KeyPath"] ?? "/app/keys")).SetApplicationName("MyDailyHub");
builder.Services.AddScoped<IPasswordHasher<HubUser>, PasswordHasher<HubUser>>();
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210000);
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "hub.session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Configuration.GetValue<bool>("SecureCookies") ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(12); o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization(); builder.Services.AddProblemDetails();
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) })); });
builder.Services.AddHealthChecks().AddDbContextCheck<HubDb>();
var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    if (ctx.Request.Method is not ("GET" or "HEAD" or "OPTIONS") && ctx.Request.Headers["X-Hub-Request"] != "1") { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { detail = "Missing request protection header." }); return; }
    await next();
});
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<HubDb>();
    await db.Database.MigrateAsync();
    if (!await db.Users.AnyAsync())
    {
        var password = builder.Configuration["Bootstrap:Password"] ?? throw new InvalidOperationException("Bootstrap password required for empty database.");
        if (password.Length < 14) throw new InvalidOperationException("Bootstrap password must have at least 14 characters.");
        var u = new HubUser { Username = (builder.Configuration["Bootstrap:Username"] ?? "admin").Trim().ToLowerInvariant(), IsAdmin = true };
        u.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<HubUser>>().HashPassword(u, password); db.Users.Add(u); await db.SaveChangesAsync();
    }
}
app.MapHealthChecks("/api/health");
app.MapHubAuth();
app.MapHubTasks();
app.MapHubFitness();
app.Run();
public partial class Program;

using Hub;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using System.Text.Json;
namespace Hub;

public static class AuthEndpoints
{
    public static void MapHubAuth(this WebApplication app)
    {
        app.MapPost("/api/auth/login", async (LoginInput input, HubDb db, IPasswordHasher<HubUser> hasher, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(input.Username) || string.IsNullOrEmpty(input.Password) || input.Password.Length > 256) return Results.Unauthorized();
            var u = await db.Users.SingleOrDefaultAsync(x => x.Username == input.Username.Trim().ToLowerInvariant());
            // Always perform a password derivation, including for unknown usernames.
            var dummy = new HubUser(); var hash = u?.PasswordHash ?? hasher.HashPassword(dummy, "constant-time-dummy-password");
            var valid = hasher.VerifyHashedPassword(u ?? dummy, hash, input.Password);
            if (u is null || valid == PasswordVerificationResult.Failed) return Results.Unauthorized();
            if (valid == PasswordVerificationResult.SuccessRehashNeeded) { u.PasswordHash = hasher.HashPassword(u, input.Password); await db.SaveChangesAsync(); }
            await ctx.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()), new Claim(ClaimTypes.Name, u.Username), new Claim(ClaimTypes.Role, u.IsAdmin ? "admin" : "user") }, CookieAuthenticationDefaults.AuthenticationScheme)));
            return Results.Ok(new { u.Username, u.IsAdmin, u.Timezone });
        }).RequireRateLimiting("login");
        var api = app.MapGroup("/api").RequireAuthorization();
        api.MapPost("/auth/logout", async (HttpContext c) => { await c.SignOutAsync(); return Results.NoContent(); });
        api.MapGet("/auth/me", async (HttpContext c, HubDb db) => await db.Users.Where(x => x.Id == Access.Owner(c)).Select(x => new { x.Username, x.IsAdmin, x.Timezone }).SingleAsync());
        api.MapPut("/auth/timezone", async (TimezoneInput input, HttpContext c, HubDb db) =>
        {
            if (string.IsNullOrWhiteSpace(input.Timezone) || input.Timezone.Length > 100) return Results.BadRequest(new { detail = "Timezone is required (maximum 100 characters)." });
            try { TimeZoneInfo.FindSystemTimeZoneById(input.Timezone); } catch (TimeZoneNotFoundException) { return Results.BadRequest(new { detail = "Unknown timezone." }); } catch (InvalidTimeZoneException) { return Results.BadRequest(); }
            var u = await db.Users.SingleAsync(x => x.Id == Access.Owner(c)); u.Timezone = input.Timezone; await db.SaveChangesAsync(); return Results.NoContent();
        });
        api.MapPost("/admin/users", async (UserInput input, HubDb db, IPasswordHasher<HubUser> hasher) =>
        {
            if (string.IsNullOrWhiteSpace(input.Username) || input.Username.Length > 80 || input.Password is null || input.Password.Length is < 14 or > 256) return Results.BadRequest(new { detail = "Username required (80 characters max); password must be 14–256 characters." });
            var name = input.Username.Trim().ToLowerInvariant(); if (await db.Users.AnyAsync(x => x.Username == name)) return Results.Conflict(new { detail = "Username already exists." });
            var u = new HubUser { Username = name, IsAdmin = input.IsAdmin }; u.PasswordHash = hasher.HashPassword(u, input.Password); db.Users.Add(u);
            try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Results.Conflict(); }
            return Results.Created("/api/admin/users", new { u.Id, u.Username, u.IsAdmin });
        }).RequireAuthorization(p => p.RequireRole("admin"));

    }
}
public static class Access { public static Guid Owner(HttpContext c) => Guid.Parse(c.User.FindFirstValue(ClaimTypes.NameIdentifier)!); }

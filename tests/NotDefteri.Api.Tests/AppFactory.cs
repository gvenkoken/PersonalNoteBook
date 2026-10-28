using System.Security.Claims;
using System.Text.Encodings.Web;
using NotDefteri.Api.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace NotDefteri.Api.Tests;

// The API in-process on an in-memory SQLite database: fast, no Docker, no network. PostgreSQL-specific behaviour is
// covered separately by [PostgresFact] tests, which run only when a disposable database is provided.
public sealed class AppFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            connection.Open();
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));
            // Tests authenticate with a header instead of real tokens; requests without it stay anonymous.
            services.AddAuthentication(o => { o.DefaultAuthenticateScheme = TestAuth.Name; o.DefaultChallengeScheme = TestAuth.Name; })
                .AddScheme<AuthenticationSchemeOptions, TestAuth>(TestAuth.Name, _ => { });
        });
    }
    public HttpClient CreateAuthenticatedClient()
    {
        var client = CreateClient(); client.DefaultRequestHeaders.Add(TestAuth.Header, "test-user"); return client;
    }
    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
        return host;
    }
    protected override void Dispose(bool disposing) { base.Dispose(disposing); if (disposing) connection.Dispose(); }
}

// Test-only authentication: the X-Test-User header names the user. Never registered outside the test host.
public sealed class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Name = "Test", Header = "X-Test-User";
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(Header, out var user) || string.IsNullOrWhiteSpace(user)) return Task.FromResult(AuthenticateResult.NoResult());
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, user.ToString())], Name);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Name)));
    }
}

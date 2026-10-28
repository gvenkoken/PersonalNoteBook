using System.Net;
using NotDefteri.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace NotDefteri.Api.Tests;

public sealed class PlatformTests(AppFactory factory) : IClassFixture<AppFactory>
{
    [Fact]
    public async Task Liveness_and_readiness_are_healthy()
    {
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health", TestContext.Current.CancellationToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready", TestContext.Current.CancellationToken)).StatusCode);
    }

    [Fact]
    public async Task Unknown_routes_answer_with_problem_details()
    {
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/api/does-not-exist", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [PostgresFact]
    public async Task Model_is_created_on_PostgreSQL()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(PostgresFactAttribute.ConnectionString).Options;
        await using var db = new AppDbContext(options);
        await db.Database.EnsureDeletedAsync(TestContext.Current.CancellationToken);
        Assert.True(await db.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken));
        Assert.True(await db.Database.CanConnectAsync(TestContext.Current.CancellationToken));
    }
}

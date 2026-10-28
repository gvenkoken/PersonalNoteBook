using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace NotDefteri.Api.Data;

public static class DataRegistration
{
    // PostgreSQL in every real environment. The connection string comes from configuration or the environment
    // (ConnectionStrings__AppDb); it is never committed.
    public static IServiceCollection AddAppData(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("AppDb");
        services.AddDbContext<AppDbContext>(options =>
        {
            if (!string.IsNullOrWhiteSpace(connection)) options.UseNpgsql(connection);
        });
        return services;
    }
}

public sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancel = default)
    {
        try { return await db.Database.CanConnectAsync(cancel) ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("Database unavailable."); }
        catch (Exception) { return HealthCheckResult.Unhealthy("Database unavailable."); }
    }
}

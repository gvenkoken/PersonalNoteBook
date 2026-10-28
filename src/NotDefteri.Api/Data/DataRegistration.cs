using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace NotDefteri.Api.Data;

public static class DataRegistration
{
    // PostgreSQL in every real environment. The connection string comes from configuration or the environment
    // (ConnectionStrings__AppDb); it is never committed. Containers (compose.yaml) instead pass its parts: Database:Host,
    // Database:Name, Database:User and the POSTGRES_PASSWORD variable shared with the database container.
    public static IServiceCollection AddAppData(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("AppDb");
        if (string.IsNullOrWhiteSpace(connection) && !string.IsNullOrWhiteSpace(configuration["Database:Host"]))
        {
            var parts = new NpgsqlConnectionStringBuilder
            {
                Host = configuration["Database:Host"],
                Database = configuration["Database:Name"],
                Username = configuration["Database:User"],
            };
            parts["Password"] = configuration["POSTGRES_PASSWORD"];
            connection = parts.ConnectionString;
        }
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

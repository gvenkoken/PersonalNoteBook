namespace NotDefteri.Api.Tests;

// Opt-in: set IDEA_TEST_POSTGRES to a connection string of a disposable database. Never an application database.
public sealed class PostgresFactAttribute : FactAttribute
{
    public static string? ConnectionString => Environment.GetEnvironmentVariable("IDEA_TEST_POSTGRES");
    public PostgresFactAttribute() { if (string.IsNullOrWhiteSpace(ConnectionString)) Skip = "Set IDEA_TEST_POSTGRES to a disposable PostgreSQL database to run."; }
}

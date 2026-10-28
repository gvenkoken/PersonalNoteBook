using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NotDefteri.Api.Data;
using Npgsql;

namespace NotDefteri.Api.Tests.Data;

public sealed class NoteTests
{
    [Fact]
    public void Normalizes_content_and_uses_utc_timestamps()
    {
        var note = new Note { Content = "Türkçe\r\n第二行\rthird\nfourth" };
        var now = new DateTime(2026, 10, 28, 12, 0, 0, DateTimeKind.Utc);
        note.PrepareForSave(true, now);
        Assert.Equal("Türkçe\n第二行\nthird\nfourth", note.Content);
        Assert.Equal(now, note.CreatedAt);
        Assert.Equal(now, note.UpdatedAt);
        Assert.Equal(DateTimeKind.Utc, note.CreatedAt.Kind);
        Assert.Equal(DateTimeKind.Utc, note.UpdatedAt.Kind);
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(note));
        Assert.Equal("2026-10-28T12:00:00Z", json.RootElement.GetProperty("CreatedAt").GetString());
        Assert.Equal("2026-10-28T12:00:00Z", json.RootElement.GetProperty("UpdatedAt").GetString());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Saving_normalizes_inserts_and_updates(bool asynchronous)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        var note = new Note { Title = "Note", Content = "a\r\nb\rc" };
        db.Notes.Add(note);
        await Save();
        var createdAt = note.CreatedAt;
        Assert.Equal("a\nb\nc", note.Content);
        note.Content = "updated\rcontent";
        await Save();
        Assert.Equal(createdAt, note.CreatedAt);
        Assert.True(note.UpdatedAt >= createdAt);
        Assert.Equal(DateTimeKind.Utc, note.CreatedAt.Kind);
        Assert.Equal(DateTimeKind.Utc, note.UpdatedAt.Kind);
        db.ChangeTracker.Clear();
        Assert.Equal("updated\ncontent", (await db.Notes.SingleAsync(TestContext.Current.CancellationToken)).Content);

        async Task Save()
        {
            if (asynchronous) await db.SaveChangesAsync(TestContext.Current.CancellationToken);
            else db.SaveChanges();
        }
    }

    [PostgresFact]
    public async Task Migration_enforces_unique_titles_and_persists_utc()
    {
        var schema = "notes_test_" + Guid.NewGuid().ToString("N");
        var connectionString = new NpgsqlConnectionStringBuilder(PostgresFactAttribute.ConnectionString!)
        {
            SearchPath = schema
        }.ConnectionString;
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);
        var cancel = TestContext.Current.CancellationToken;
        try
        {
            // The schema name is generated locally from a GUID, never user input.
            var createSchema = "CREATE SCHEMA " + schema;
            await db.Database.ExecuteSqlRawAsync(createSchema, cancel);
            await db.Database.MigrateAsync(cancel);
            db.Notes.Add(new Note { Title = "Same title", Content = "Türkçe\r\ntext\rend" });
            await db.SaveChangesAsync(cancel);
            db.ChangeTracker.Clear();
            var saved = await db.Notes.SingleAsync(cancel);
            Assert.Equal("Türkçe\ntext\nend", saved.Content);
            Assert.Equal(DateTimeKind.Utc, saved.CreatedAt.Kind);
            Assert.Equal(DateTimeKind.Utc, saved.UpdatedAt.Kind);
            db.Notes.Add(new Note { Title = "Same title" });
            var exception = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync(cancel));
            var postgres = Assert.IsType<PostgresException>(exception.InnerException);
            Assert.Equal(PostgresErrorCodes.UniqueViolation, postgres.SqlState);
            Assert.Equal("IX_Notes_Title", postgres.ConstraintName);
        }
        finally
        {
            var dropSchema = "DROP SCHEMA IF EXISTS " + schema + " CASCADE";
            await db.Database.ExecuteSqlRawAsync(dropSchema, CancellationToken.None);
        }
    }
}

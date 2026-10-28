using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NotDefteri.Api.Data;

namespace NotDefteri.Api.Tests.Features.Notes;

public sealed class NotesApiTests
{
    [Fact]
    public async Task Anonymous_client_can_create_list_update_and_permanently_delete()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/notes", new { title = "İlk not", content = "a\r\nb" }, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<NoteDto>(TestContext.Current.CancellationToken))!;
        var url = $"/api/notes/{created.Id}";
        Assert.Equal(url, response.Headers.Location?.OriginalString);
        Assert.Equal("a\nb", created.Content);
        Assert.Equal(created, await client.GetFromJsonAsync<NoteDto>(url, TestContext.Current.CancellationToken));
        var list = (await client.GetFromJsonAsync<JsonElement[]>("/api/notes", TestContext.Current.CancellationToken))!;
        var summary = Assert.Single(list);
        Assert.Equal(created.Id, summary.GetProperty("id").GetGuid());
        Assert.Equal(created.Title, summary.GetProperty("title").GetString());
        Assert.Equal(created.UpdatedAt, summary.GetProperty("updatedAt").GetDateTime());
        Assert.False(summary.TryGetProperty("content", out _));

        response = await client.PutAsJsonAsync(url, new { title = "Yeni ad", content = "Yeni içerik" }, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await response.Content.ReadFromJsonAsync<NoteDto>(TestContext.Current.CancellationToken))!;
        Assert.Equal("Yeni ad", updated.Title);
        Assert.Equal("Yeni içerik", updated.Content);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
        Assert.True(updated.UpdatedAt > created.UpdatedAt);
        Assert.Equal(updated, await client.GetFromJsonAsync<NoteDto>(url, TestContext.Current.CancellationToken));
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(url, TestContext.Current.CancellationToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(url, TestContext.Current.CancellationToken)).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Notes.AnyAsync(n => n.Id == created.Id, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Duplicate_create_and_rename_return_distinct_conflict_without_changing_notes()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        await client.PostAsJsonAsync("/api/notes", new { title = "Taken", content = "original" }, TestContext.Current.CancellationToken);
        await AssertProblem(await client.PostAsJsonAsync("/api/notes", new { title = "Taken" }, TestContext.Current.CancellationToken),
            HttpStatusCode.Conflict, "note_title_conflict");
        var response = await client.PostAsJsonAsync("/api/notes", new { title = "Other", content = "unchanged" }, TestContext.Current.CancellationToken);
        var note = (await response.Content.ReadFromJsonAsync<NoteDto>(TestContext.Current.CancellationToken))!;
        await AssertProblem(await client.PutAsJsonAsync($"/api/notes/{note.Id}", new { title = "Taken", content = "changed" }, TestContext.Current.CancellationToken),
            HttpStatusCode.Conflict, "note_title_conflict");
        Assert.Equal(note, await client.GetFromJsonAsync<NoteDto>($"/api/notes/{note.Id}", TestContext.Current.CancellationToken));
        var notes = (await client.GetFromJsonAsync<JsonElement[]>("/api/notes", TestContext.Current.CancellationToken))!;
        Assert.Collection(notes,
            other => Assert.Equal("Other", other.GetProperty("title").GetString()),
            taken => Assert.Equal("Taken", taken.GetProperty("title").GetString()));
    }

    [Theory]
    [InlineData("")]
    [InlineData("  \t")]
    [InlineData(null)]
    public async Task Empty_titles_are_rejected_on_create_and_update(string? title)
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        await AssertProblem(await client.PostAsJsonAsync("/api/notes", new { title }, TestContext.Current.CancellationToken), HttpStatusCode.BadRequest, "invalid_title");
        var response = await client.PostAsJsonAsync("/api/notes", new { title = "Valid" }, TestContext.Current.CancellationToken);
        var note = (await response.Content.ReadFromJsonAsync<NoteDto>(TestContext.Current.CancellationToken))!;
        await AssertProblem(await client.PutAsJsonAsync($"/api/notes/{note.Id}", new { title }, TestContext.Current.CancellationToken), HttpStatusCode.BadRequest, "invalid_title");
        Assert.Equal(note, await client.GetFromJsonAsync<NoteDto>($"/api/notes/{note.Id}", TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Missing_ids_return_404_for_read_update_and_delete()
    {
        using var factory = new AppFactory();
        using var client = factory.CreateClient();
        var url = $"/api/notes/{Guid.NewGuid()}";
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(url, TestContext.Current.CancellationToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync(url, new { title = "Valid" }, TestContext.Current.CancellationToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync(url, TestContext.Current.CancellationToken)).StatusCode);
    }

    [Fact]
    public async Task Save_failure_returns_explicit_problem_and_does_not_insert()
    {
        using var factory = new AppFactory();
        using var failingFactory = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            // Keep the factory's SQLite options, but explicitly replace the context so
            // an existing AddDbContext registration cannot discard the interceptor.
            services.RemoveAll<AppDbContext>();
            services.AddScoped<AppDbContext>(provider => new AppDbContext(
                new DbContextOptionsBuilder<AppDbContext>(provider.GetRequiredService<DbContextOptions<AppDbContext>>())
                    .AddInterceptors(new FailingSave()).Options));
        }));
        using var client = failingFactory.CreateClient();
        await AssertProblem(await client.PostAsJsonAsync("/api/notes", new { title = "Failed" }, TestContext.Current.CancellationToken),
            HttpStatusCode.InternalServerError, "note_save_failed");
        Assert.Empty((await client.GetFromJsonAsync<NoteDto[]>("/api/notes", TestContext.Current.CancellationToken))!);
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("title").GetString()));
    }

    private sealed class FailingSave : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default) =>
            throw new DbUpdateException("Simulated storage failure");
    }

    public sealed record NoteDto(Guid Id, string Title, string Content, DateTime CreatedAt, DateTime UpdatedAt);
}

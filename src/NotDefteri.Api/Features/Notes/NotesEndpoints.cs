using Microsoft.EntityFrameworkCore;
using NotDefteri.Api.Data;
using Npgsql;

namespace NotDefteri.Api.Features.Notes;

public static class NotesEndpoints
{
    public static IEndpointRouteBuilder MapNotes(this IEndpointRouteBuilder endpoints)
    {
        var notes = endpoints.MapGroup("/api/notes").WithTags("Notes").AllowAnonymous();
        notes.MapGet("/", async (AppDbContext db, CancellationToken cancel) =>
            Results.Ok(await db.Notes.AsNoTracking().OrderBy(n => n.Title)
                .Select(n => new NoteSummary(n.Id, n.Title, n.UpdatedAt)).ToListAsync(cancel)));
        notes.MapGet("/{id:guid}", async Task<IResult> (Guid id, AppDbContext db, CancellationToken cancel) =>
        {
            var note = await db.Notes.AsNoTracking().SingleOrDefaultAsync(n => n.Id == id, cancel);
            return note is null ? Results.NotFound() : Results.Ok(note);
        });
        notes.MapPost("/", Create);
        notes.MapPut("/{id:guid}", Update);
        notes.MapDelete("/{id:guid}", Delete);
        return endpoints;
    }

    private static async Task<IResult> Create(NoteRequest request, AppDbContext db, CancellationToken cancel)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return InvalidTitle();
        if (await db.Notes.AnyAsync(n => n.Title == request.Title, cancel)) return TitleConflict();
        var note = new Note { Title = request.Title, Content = request.Content ?? string.Empty };
        db.Notes.Add(note);
        return await Save(db, cancel) ?? Results.Created($"/api/notes/{note.Id}", note);
    }

    private static async Task<IResult> Update(Guid id, NoteRequest request, AppDbContext db, CancellationToken cancel)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return InvalidTitle();
        var note = await db.Notes.FindAsync([id], cancel);
        if (note is null) return Results.NotFound();
        if (await db.Notes.AnyAsync(n => n.Id != id && n.Title == request.Title, cancel)) return TitleConflict();
        note.Title = request.Title;
        note.Content = request.Content ?? string.Empty;
        // Explicit saves refresh the timestamp even when the text is unchanged.
        db.Entry(note).State = EntityState.Modified;
        return await Save(db, cancel) ?? Results.Ok(note);
    }

    private static async Task<IResult> Delete(Guid id, AppDbContext db, CancellationToken cancel)
    {
        var note = await db.Notes.FindAsync([id], cancel);
        if (note is null) return Results.NotFound();
        db.Notes.Remove(note);
        return await Save(db, cancel) ?? Results.NoContent();
    }

    private static async Task<IResult?> Save(AppDbContext db, CancellationToken cancel)
    {
        try
        {
            await db.SaveChangesAsync(cancel);
            return null;
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
               { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_Notes_Title" })
        {
            // The index also catches concurrent requests passing the duplicate check.
            return TitleConflict();
        }
        catch (DbUpdateException)
        {
            return Results.Problem(statusCode: 500, title: "Not kaydedilemedi",
                detail: "Değişiklikler kaydedilemedi. Lütfen tekrar deneyin.",
                extensions: new Dictionary<string, object?> { ["code"] = "note_save_failed" });
        }
    }

    private static IResult InvalidTitle() => Results.Problem(statusCode: 400,
        title: "Not başlığı boş olamaz", extensions: new Dictionary<string, object?> { ["code"] = "invalid_title" });

    private static IResult TitleConflict() => Results.Problem(statusCode: 409,
        title: "Bu ad zaten kullanılıyor", extensions: new Dictionary<string, object?> { ["code"] = "note_title_conflict" });
}

public sealed record NoteRequest(string? Title, string? Content);
public sealed record NoteSummary(Guid Id, string Title, DateTime UpdatedAt);

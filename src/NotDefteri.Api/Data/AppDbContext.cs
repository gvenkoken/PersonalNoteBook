using Microsoft.EntityFrameworkCore;

namespace NotDefteri.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Note> Notes => Set<Note>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareNotes();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareNotes();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void PrepareNotes()
    {
        var utcNow = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<Note>())
        {
            if (entry.State is EntityState.Added or EntityState.Modified)
            {
                entry.Entity.PrepareForSave(entry.State == EntityState.Added, utcNow);
                if (entry.State == EntityState.Modified)
                    entry.Property(note => note.CreatedAt).IsModified = false;
            }
        }
    }
}

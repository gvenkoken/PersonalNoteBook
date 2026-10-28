using Microsoft.EntityFrameworkCore;

namespace NotDefteri.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    // Entity mappings live next to their feature as IEntityTypeConfiguration<T> classes and are discovered here,
    // so adding a feature never edits this file.
    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}

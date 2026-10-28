using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace NotDefteri.Api.Data;

public sealed class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.ToTable("Notes");
        builder.HasKey(note => note.Id);
        builder.Property(note => note.Title).IsRequired().HasColumnType("text");
        builder.HasIndex(note => note.Title).IsUnique();
        builder.Property(note => note.Content).IsRequired().HasColumnType("text");
        builder.Property(note => note.CreatedAt).HasColumnType("timestamp with time zone");
        builder.Property(note => note.UpdatedAt).HasColumnType("timestamp with time zone");
    }
}

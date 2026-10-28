using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using NotDefteri.Api.Data;

namespace NotDefteri.Api.Migrations;

[DbContext(typeof(AppDbContext))]
public sealed class NotesModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder) => ConfigureModel(modelBuilder);

    internal static void ConfigureModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "8.0.24")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);
        modelBuilder.Entity("NotDefteri.Api.Data.Note", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            entity.Property<string>("Title").IsRequired().HasColumnType("text");
            entity.Property<string>("Content").IsRequired().HasColumnType("text");
            entity.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
            entity.Property<DateTime>("UpdatedAt").HasColumnType("timestamp with time zone");
            entity.HasKey("Id");
            entity.HasIndex("Title").IsUnique();
            entity.ToTable("Notes");
        });
    }
}

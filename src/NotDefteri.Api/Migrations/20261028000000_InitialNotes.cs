using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotDefteri.Api.Data;

namespace NotDefteri.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261028000000_InitialNotes")]
public sealed class InitialNotes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Notes",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Title = table.Column<string>(type: "text", nullable: false),
                Content = table.Column<string>(type: "text", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_Notes", note => note.Id));
        migrationBuilder.CreateIndex(name: "IX_Notes_Title", table: "Notes", column: "Title", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "Notes");

    protected override void BuildTargetModel(ModelBuilder modelBuilder) =>
        NotesModelSnapshot.ConfigureModel(modelBuilder);
}

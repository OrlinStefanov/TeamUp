using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TeamUpBackEnd.DbContext;

#nullable disable

namespace TeamUpBackEnd.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260615120000_AddInboxCategoryLastSeen")]
    /// <inheritdoc />
    public partial class AddInboxCategoryLastSeen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "MemberLastSeen",
                table: "WorkspaceInboxLastSeen",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.AddColumn<DateTime>(
                name: "TaskLastSeen",
                table: "WorkspaceInboxLastSeen",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MemberLastSeen",
                table: "WorkspaceInboxLastSeen");

            migrationBuilder.DropColumn(
                name: "TaskLastSeen",
                table: "WorkspaceInboxLastSeen");
        }
    }
}

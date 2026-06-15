using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TeamUpBackEnd.DbContext;

#nullable disable

namespace TeamUpBackEnd.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260615140000_AddWorkspaceInboxDismissed")]
    /// <inheritdoc />
    public partial class AddWorkspaceInboxDismissed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkspaceInboxDismissed",
                columns: table => new
                {
                    WorkspaceId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    MessageId = table.Column<int>(type: "integer", nullable: false),
                    DismissedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkspaceInboxDismissed", x => new { x.WorkspaceId, x.UserId, x.MessageId });
                    table.ForeignKey(
                        name: "FK_WorkspaceInboxDismissed_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkspaceInboxDismissed_WorkspaceInboxMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "WorkspaceInboxMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkspaceInboxDismissed_Workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalTable: "Workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkspaceInboxDismissed_MessageId",
                table: "WorkspaceInboxDismissed",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkspaceInboxDismissed_UserId",
                table: "WorkspaceInboxDismissed",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkspaceInboxDismissed_WorkspaceId_UserId",
                table: "WorkspaceInboxDismissed",
                columns: new[] { "WorkspaceId", "UserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkspaceInboxDismissed");
        }
    }
}

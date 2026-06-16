using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamUpBackEnd.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupManagementFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                table: "Conversations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "JoinedAt",
                table: "ConversationMembers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.AddColumn<string>(
                name: "Nickname",
                table: "ConversationMembers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "ConversationMembers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                """
                UPDATE "ConversationMembers"
                SET "JoinedAt" = "LastSeen"
                WHERE "JoinedAt" = TIMESTAMPTZ '2024-01-01 00:00:00+00';
                """);

            migrationBuilder.Sql(
                """
                WITH ranked AS (
                    SELECT
                        cm."ConversationId",
                        cm."UserId",
                        ROW_NUMBER() OVER (PARTITION BY cm."ConversationId" ORDER BY cm."JoinedAt", cm."UserId") AS rn
                    FROM "ConversationMembers" cm
                    INNER JOIN "Conversations" c ON c."Id" = cm."ConversationId"
                    WHERE c."IsGroup" = TRUE
                )
                UPDATE "ConversationMembers" cm
                SET "Role" = 2
                FROM ranked r
                WHERE cm."ConversationId" = r."ConversationId"
                  AND cm."UserId" = r."UserId"
                  AND r.rn = 1;
                """);

            migrationBuilder.Sql(
                """
                UPDATE "Conversations" c
                SET "CreatedByUserId" = owner."UserId"
                FROM (
                    SELECT cm."ConversationId", cm."UserId"
                    FROM "ConversationMembers" cm
                    WHERE cm."Role" = 2
                ) owner
                WHERE c."Id" = owner."ConversationId"
                  AND c."IsGroup" = TRUE;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_CreatedByUserId",
                table: "Conversations",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Conversations_AspNetUsers_CreatedByUserId",
                table: "Conversations",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Conversations_AspNetUsers_CreatedByUserId",
                table: "Conversations");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_CreatedByUserId",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "JoinedAt",
                table: "ConversationMembers");

            migrationBuilder.DropColumn(
                name: "Nickname",
                table: "ConversationMembers");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "ConversationMembers");
        }
    }
}

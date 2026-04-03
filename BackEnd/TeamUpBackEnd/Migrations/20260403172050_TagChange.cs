using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamUpBackEnd.Migrations
{
    /// <inheritdoc />
    public partial class TagChange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskTags_Tags_TagId",
                table: "TaskTags");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskTags_Tasks_TaskItemId",
                table: "TaskTags");

            migrationBuilder.DropPrimaryKey(
                name: "PK_TaskTags",
                table: "TaskTags");

            migrationBuilder.RenameTable(
                name: "TaskTags",
                newName: "TaskItemTags");

            migrationBuilder.RenameIndex(
                name: "IX_TaskTags_TagId",
                table: "TaskItemTags",
                newName: "IX_TaskItemTags_TagId");

            migrationBuilder.AddColumn<int>(
                name: "WorkSpaceId",
                table: "Tags",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_TaskItemTags",
                table: "TaskItemTags",
                columns: new[] { "TaskItemId", "TagId" });

            migrationBuilder.AddForeignKey(
                name: "FK_TaskItemTags_Tags_TagId",
                table: "TaskItemTags",
                column: "TagId",
                principalTable: "Tags",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskItemTags_Tasks_TaskItemId",
                table: "TaskItemTags",
                column: "TaskItemId",
                principalTable: "Tasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskItemTags_Tags_TagId",
                table: "TaskItemTags");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskItemTags_Tasks_TaskItemId",
                table: "TaskItemTags");

            migrationBuilder.DropPrimaryKey(
                name: "PK_TaskItemTags",
                table: "TaskItemTags");

            migrationBuilder.DropColumn(
                name: "WorkSpaceId",
                table: "Tags");

            migrationBuilder.RenameTable(
                name: "TaskItemTags",
                newName: "TaskTags");

            migrationBuilder.RenameIndex(
                name: "IX_TaskItemTags_TagId",
                table: "TaskTags",
                newName: "IX_TaskTags_TagId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TaskTags",
                table: "TaskTags",
                columns: new[] { "TaskItemId", "TagId" });

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTags_Tags_TagId",
                table: "TaskTags",
                column: "TagId",
                principalTable: "Tags",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskTags_Tasks_TaskItemId",
                table: "TaskTags",
                column: "TaskItemId",
                principalTable: "Tasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

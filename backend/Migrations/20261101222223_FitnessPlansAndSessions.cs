using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hub.Migrations
{
    /// <inheritdoc />
    public partial class FitnessPlansAndSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FitnessPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FitnessPlans", x => x.Id);
                    table.UniqueConstraint("AK_FitnessPlans_Id_UserId", x => new { x.Id, x.UserId });
                    table.ForeignKey(
                        name: "FK_FitnessPlans_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FitnessVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Document = table.Column<string>(type: "text", nullable: false),
                    Hash = table.Column<string>(type: "text", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FitnessVersions", x => x.Id);
                    table.UniqueConstraint("AK_FitnessVersions_Id_PlanId_UserId", x => new { x.Id, x.PlanId, x.UserId });
                    table.ForeignKey(
                        name: "FK_FitnessVersions_FitnessPlans_PlanId_UserId",
                        columns: x => new { x.PlanId, x.UserId },
                        principalTable: "FitnessPlans",
                        principalColumns: new[] { "Id", "UserId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FitnessSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Weekday = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Planned = table.Column<string>(type: "text", nullable: false),
                    Actual = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Revision = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FitnessSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FitnessSessions_FitnessVersions_VersionId_PlanId_UserId",
                        columns: x => new { x.VersionId, x.PlanId, x.UserId },
                        principalTable: "FitnessVersions",
                        principalColumns: new[] { "Id", "PlanId", "UserId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FitnessPlans_UserId_ExternalId",
                table: "FitnessPlans",
                columns: new[] { "UserId", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FitnessSessions_PlanId_Date",
                table: "FitnessSessions",
                columns: new[] { "PlanId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FitnessSessions_UserId_Date",
                table: "FitnessSessions",
                columns: new[] { "UserId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_FitnessSessions_VersionId_PlanId_UserId",
                table: "FitnessSessions",
                columns: new[] { "VersionId", "PlanId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_FitnessVersions_PlanId_UserId",
                table: "FitnessVersions",
                columns: new[] { "PlanId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_FitnessVersions_PlanId_Version",
                table: "FitnessVersions",
                columns: new[] { "PlanId", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FitnessSessions");

            migrationBuilder.DropTable(
                name: "FitnessVersions");

            migrationBuilder.DropTable(
                name: "FitnessPlans");
        }
    }
}

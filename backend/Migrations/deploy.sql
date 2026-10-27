CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    CREATE TABLE "Users" (
        "Id" uuid NOT NULL,
        "Username" text NOT NULL,
        "PasswordHash" text NOT NULL,
        "IsAdmin" boolean NOT NULL,
        "Timezone" text NOT NULL,
        CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    CREATE TABLE "Tasks" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "Title" text NOT NULL,
        "Notes" text NOT NULL,
        "Category" text NOT NULL,
        "Priority" integer NOT NULL,
        "StartDate" date NOT NULL,
        "DueDate" date,
        "Recurrence" text NOT NULL,
        "Checklist" text NOT NULL,
        "Archived" boolean NOT NULL,
        CONSTRAINT "PK_Tasks" PRIMARY KEY ("Id"),
        CONSTRAINT "AK_Tasks_Id_UserId" UNIQUE ("Id", "UserId"),
        CONSTRAINT "FK_Tasks_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    CREATE TABLE "Completions" (
        "TaskId" uuid NOT NULL,
        "Date" date NOT NULL,
        "UserId" uuid NOT NULL,
        "Done" boolean NOT NULL,
        "CheckedItems" text NOT NULL,
        "UpdatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_Completions" PRIMARY KEY ("TaskId", "Date"),
        CONSTRAINT "FK_Completions_Tasks_TaskId_UserId" FOREIGN KEY ("TaskId", "UserId") REFERENCES "Tasks" ("Id", "UserId") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    CREATE INDEX "IX_Completions_TaskId_UserId" ON "Completions" ("TaskId", "UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    CREATE INDEX "IX_Completions_UserId_Date" ON "Completions" ("UserId", "Date");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    CREATE INDEX "IX_Tasks_UserId_StartDate" ON "Tasks" ("UserId", "StartDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    CREATE UNIQUE INDEX "IX_Users_Username" ON "Users" ("Username");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261027210421_Initial') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261027210421_Initial', '10.0.0');
    END IF;
END $EF$;
COMMIT;


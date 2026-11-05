-- Keeps a shared game's content in the teacher's account after its link expires,
-- so My activities can create a new link from it. The link (and student answers)
-- still expire; the activity stays until the teacher removes it.
-- Requires 0004_add-teacher-activities.sql. Safe to run twice.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.teacher_activities', N'payload') IS NULL
    ALTER TABLE dbo.teacher_activities ADD
        payload NVARCHAR(MAX) NULL,           -- cleaned game content (JSON), games only
        game_version INT NULL,                -- adapter version the payload was made for
        expires_at DATETIME2 NULL;            -- when the current link expires

-- EXEC so the constraint compiles after the column above exists (no GO needed).
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_teacher_activities_payload_json')
    EXEC(N'ALTER TABLE dbo.teacher_activities ADD CONSTRAINT CK_teacher_activities_payload_json CHECK (payload IS NULL OR ISJSON(payload) = 1);');

COMMIT;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0006_add-teacher-activity-payload')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0006_add-teacher-activity-payload');

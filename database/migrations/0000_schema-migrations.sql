-- Tracks which numbered migrations in database/migrations have run on this
-- database. Every migration ends by recording its own id here, so it is
-- recorded however it is run (the script in src/teachingTools/scripts,
-- the Azure Portal query editor, sqlcmd, ...).
--
-- On a database that already had the earlier changes applied by hand, this
-- also records 0001–0008 for each change it can see is already in place.
-- Safe to run twice.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.schema_migrations (
        id          NVARCHAR(200) NOT NULL PRIMARY KEY,  -- file name without .sql
        applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
    -- Only migration names: lets the website (whatever its database user) warn admins when it is behind.
    GRANT SELECT ON dbo.schema_migrations TO PUBLIC;
END;

-- Baseline: changes made before this table existed.
DECLARE @seen TABLE (id NVARCHAR(200));
IF OBJECT_ID(N'dbo.textbook_lesson_items', N'U') IS NOT NULL INSERT INTO @seen VALUES (N'0001_add-textbook-lessons');
IF OBJECT_ID(N'dbo.teacher_library_access', N'U') IS NOT NULL INSERT INTO @seen VALUES (N'0002_add-teacher-private-library');
IF COL_LENGTH(N'dbo.teacher_library_access', N'trial_started_at') IS NOT NULL AND OBJECT_ID(N'dbo.teacher_activation_codes', N'U') IS NOT NULL INSERT INTO @seen VALUES (N'0003_add-teacher-membership');
IF OBJECT_ID(N'dbo.teacher_activities', N'U') IS NOT NULL INSERT INTO @seen VALUES (N'0004_add-teacher-activities');
IF COL_LENGTH(N'dbo.teacher_activation_codes', N'revoked_at') IS NOT NULL INSERT INTO @seen VALUES (N'0005_add-activation-code-revocation');
IF COL_LENGTH(N'dbo.teacher_activities', N'payload') IS NOT NULL INSERT INTO @seen VALUES (N'0006_add-teacher-activity-payload');
IF OBJECT_ID(N'dbo.teacher_accounts', N'U') IS NOT NULL INSERT INTO @seen VALUES (N'0007_add-teacher-accounts');
IF OBJECT_ID(N'dbo.membership_events', N'U') IS NOT NULL INSERT INTO @seen VALUES (N'0008_add-membership-events');

INSERT INTO dbo.schema_migrations (id)
SELECT s.id FROM @seen s WHERE NOT EXISTS (SELECT 1 FROM dbo.schema_migrations m WHERE m.id = s.id);

IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0000_schema-migrations')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0000_schema-migrations');

COMMIT;

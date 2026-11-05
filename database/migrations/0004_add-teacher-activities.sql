-- Index of the shared games and books each teacher account created, so
-- My activities can list them on any device. Content stays in Blob storage;
-- this table only records which items belong to which account.
-- Requires 0002_add-teacher-private-library.sql (same owner_key scheme).
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.teacher_activities', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.teacher_activities (
        owner_key CHAR(64) NOT NULL,
        kind VARCHAR(10) NOT NULL,            -- 'game' or 'book'
        item_id VARCHAR(64) NOT NULL,         -- share id or book id
        game_type VARCHAR(40) NULL,
        title NVARCHAR(200) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_teacher_activities PRIMARY KEY (owner_key, kind, item_id),
        CONSTRAINT CK_teacher_activities_kind CHECK (kind IN ('game', 'book'))
    );
    CREATE INDEX IX_teacher_activities_item ON dbo.teacher_activities (kind, item_id);
END;

COMMIT;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0004_add-teacher-activities')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0004_add-teacher-activities');

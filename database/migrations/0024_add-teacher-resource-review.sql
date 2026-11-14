SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.teacher_resources','review') IS NULL
    ALTER TABLE dbo.teacher_resources ADD review NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.teacher_resources','revision') IS NULL
    ALTER TABLE dbo.teacher_resources ADD revision INT NOT NULL CONSTRAINT DF_teacher_resources_revision DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id=N'0024_add-teacher-resource-review')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0024_add-teacher-resource-review');
COMMIT;

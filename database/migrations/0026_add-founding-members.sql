-- Founding member marker on teacher accounts: set by an admin at
-- /admin/memberships for teachers who bought at the founding price.
-- NULL = not a founding member. Safe to run twice. Not exposed through DAB.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.teacher_accounts', 'founding_member_at') IS NULL
    ALTER TABLE dbo.teacher_accounts ADD founding_member_at DATETIME2 NULL, founding_member_by NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id=N'0026_add-founding-members')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0026_add-founding-members');
COMMIT;

SET XACT_ABORT ON;
BEGIN TRANSACTION;

ALTER TABLE dbo.community_posts ALTER COLUMN textbook NVARCHAR(87) NULL;

IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0025_expand-community-textbook')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0025_expand-community-textbook');

COMMIT;

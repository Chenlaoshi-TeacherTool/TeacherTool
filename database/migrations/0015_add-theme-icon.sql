-- Optional emoji shown before an admin-created theme's name on the Theme Activities list.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.content_catalog', N'icon') IS NULL
    ALTER TABLE dbo.content_catalog ADD icon NVARCHAR(16) NOT NULL CONSTRAINT DF_content_catalog_icon DEFAULT N'';
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0015_add-theme-icon')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0015_add-theme-icon');
COMMIT;

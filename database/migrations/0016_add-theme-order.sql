-- Display order for themes, set by dragging on /admin/materials. 0 = not ordered yet (shown after ordered ones).
-- A theme row whose entry_key matches a built-in theme renames and orders that built-in theme.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.content_catalog', N'sort_order') IS NULL
    ALTER TABLE dbo.content_catalog ADD sort_order INT NOT NULL CONSTRAINT DF_content_catalog_sort_order DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0016_add-theme-order')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0016_add-theme-order');
COMMIT;

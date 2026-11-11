SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.recommendation_products', 'companion_files') IS NULL
    ALTER TABLE dbo.recommendation_products ADD companion_files nvarchar(max) NULL;
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0019_add-recommendation-files')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0019_add-recommendation-files');
COMMIT;

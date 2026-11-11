SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.activity_materials', 'title_en') IS NULL
    ALTER TABLE dbo.activity_materials ADD title_en NVARCHAR(120) NOT NULL CONSTRAINT DF_activity_material_title_en DEFAULT N'';
IF COL_LENGTH('dbo.activity_materials', 'products') IS NULL
    ALTER TABLE dbo.activity_materials ADD products NVARCHAR(MAX) NOT NULL CONSTRAINT DF_activity_material_products DEFAULT N'[]';
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_activity_material_products')
    EXEC(N'ALTER TABLE dbo.activity_materials ADD CONSTRAINT CK_activity_material_products CHECK (ISJSON(products) = 1);');
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0020_add-material-products')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0020_add-material-products');
COMMIT;

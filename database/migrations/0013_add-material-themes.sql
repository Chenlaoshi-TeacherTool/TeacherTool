-- Keep a material's attachments in one record while linking multiple theme pages.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.activity_materials', 'themes') IS NULL
    ALTER TABLE dbo.activity_materials ADD themes NVARCHAR(MAX) NULL;
EXEC sp_executesql N'UPDATE dbo.activity_materials SET themes = N''["'' + STRING_ESCAPE(theme, ''json'') + N''"]'' WHERE themes IS NULL;';
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_activity_material_themes')
    EXEC(N'ALTER TABLE dbo.activity_materials ADD CONSTRAINT CK_activity_material_themes CHECK (themes IS NOT NULL AND ISJSON(themes) = 1);');
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0013_add-material-themes')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0013_add-material-themes');
COMMIT;

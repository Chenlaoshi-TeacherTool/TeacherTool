SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.site_pages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.site_pages (
        page_key VARCHAR(20) NOT NULL PRIMARY KEY,
        draft NVARCHAR(MAX) NOT NULL,
        published NVARCHAR(MAX) NULL,
        CONSTRAINT CK_site_pages_draft CHECK (ISJSON(draft) = 1),
        CONSTRAINT CK_site_pages_published CHECK (published IS NULL OR ISJSON(published) = 1)
    );
END;
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id=N'0021_add-site-pages')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0021_add-site-pages');
COMMIT;

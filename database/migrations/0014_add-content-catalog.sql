-- Admin-created themes, textbook series and books. Existing code-defined entries stay valid.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.content_catalog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.content_catalog (
        kind VARCHAR(10) NOT NULL,
        parent_key VARCHAR(40) NOT NULL DEFAULT '',
        entry_key VARCHAR(40) NOT NULL,
        zh NVARCHAR(120) NOT NULL,
        en NVARCHAR(120) NOT NULL,
        members_only BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_content_catalog PRIMARY KEY (kind, parent_key, entry_key),
        CONSTRAINT CK_content_catalog_kind CHECK (kind IN ('theme', 'series', 'book'))
    );
END;
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0014_add-content-catalog')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0014_add-content-catalog');
COMMIT;

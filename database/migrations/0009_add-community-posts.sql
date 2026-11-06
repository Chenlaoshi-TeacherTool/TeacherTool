-- Teacher community (/community): word lists and games teachers publish for
-- other teachers to reuse. Posts go live at once; reports flag them for the
-- admin page (/admin/community), which can hide or delete them.
-- owner_key is the same SHA-256 key used by the other teacher_* tables.
-- Safe to run twice. Not exposed through DAB.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.community_posts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.community_posts (
        id            VARCHAR(16)    NOT NULL PRIMARY KEY,
        kind          VARCHAR(10)    NOT NULL,           -- 'wordlist' or 'game'
        owner_key     CHAR(64)       NOT NULL,
        author_name   NVARCHAR(40)   NOT NULL,
        title         NVARCHAR(120)  NOT NULL,
        description   NVARCHAR(500)  NULL,
        stages        VARCHAR(200)   NOT NULL DEFAULT '', -- comma list, e.g. 'non-native,primary'
        textbook      VARCHAR(40)    NULL,
        game_type     VARCHAR(40)    NULL,
        game_version  INT            NULL,
        item_count    INT            NOT NULL DEFAULT 0,
        payload       NVARCHAR(MAX)  NOT NULL,           -- JSON: word list items or game data
        status        VARCHAR(10)    NOT NULL DEFAULT 'live', -- 'live' or 'hidden'
        report_count  INT            NOT NULL DEFAULT 0,
        use_count     INT            NOT NULL DEFAULT 0,
        created_at    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_community_posts_status ON dbo.community_posts (status, created_at DESC);
    CREATE INDEX IX_community_posts_owner ON dbo.community_posts (owner_key);
END;

IF OBJECT_ID(N'dbo.community_reports', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.community_reports (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        post_id       VARCHAR(16)    NOT NULL,
        reason        NVARCHAR(300)  NULL,
        created_at    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_community_reports_post ON dbo.community_reports (post_id);
END;

COMMIT;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0009_add-community-posts')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0009_add-community-posts');

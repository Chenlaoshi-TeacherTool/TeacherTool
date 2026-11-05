-- Adds the textbook companion tables to an existing TeacherToolDb.
-- Same definitions as the textbook section of schema.sql; safe to run twice.
-- After running it, redeploy DAB (see README.md) so /textbooklessons and
-- /textbooklessonitems are served.

IF OBJECT_ID('dbo.textbook_lessons', 'U') IS NULL
BEGIN
    CREATE TABLE textbook_lessons (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        slug              NVARCHAR(100) NOT NULL UNIQUE,
        series            NVARCHAR(40)  NOT NULL,
        book_slug         NVARCHAR(40)  NOT NULL,
        book_name         NVARCHAR(100) NOT NULL,
        sort_order        INT           NOT NULL DEFAULT 0,
        lesson_no         INT           NULL,
        title             NVARCHAR(200) NOT NULL,
        sentence_patterns NVARCHAR(MAX) NULL,
        activities        NVARCHAR(MAX) NULL,
        is_published      BIT           NOT NULL DEFAULT 1,
        updated_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_textbook_lessons_book ON textbook_lessons(series, book_slug, sort_order);
END;

IF OBJECT_ID('dbo.textbook_lesson_items', 'U') IS NULL
BEGIN
    CREATE TABLE textbook_lesson_items (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        lesson_id   INT           NOT NULL FOREIGN KEY REFERENCES textbook_lessons(id) ON DELETE CASCADE,
        zh          NVARCHAR(100) NOT NULL,
        py          NVARCHAR(200) NOT NULL,
        en          NVARCHAR(200) NOT NULL DEFAULT '',
        kind        NVARCHAR(20)  NULL,
        sort_order  INT           NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_textbook_lesson_items_lesson_id ON textbook_lesson_items(lesson_id);
END;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0001_add-textbook-lessons')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0001_add-textbook-lessons');

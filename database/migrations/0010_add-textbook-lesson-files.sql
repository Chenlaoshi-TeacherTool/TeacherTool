-- Textbook companion lessons for members:
--   * textbook_lesson_files: files (PDF, Word, PowerPoint, ...) attached to a
--     lesson, uploaded at /admin/textbooks/lessons/:id/edit. The files live in
--     the private "textbook-materials" blob container; members download them
--     through the site (/textbook-companion/files/:id), never from Blob storage.
--   * textbook_lessons.games: one game per line, "title | link".
--   * The 12 lessons of Jinan “中文” Book 1 (第一课–第十二课), so each has a
--     page to fill in. Rename them at /admin/textbooks.
-- Safe to run twice. Not exposed through DAB.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.textbook_lesson_files', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.textbook_lesson_files (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        lesson_id     INT            NOT NULL FOREIGN KEY REFERENCES dbo.textbook_lessons(id) ON DELETE CASCADE,
        title         NVARCHAR(200)  NOT NULL,          -- shown to teachers, e.g. 第一课 作业单
        file_name     NVARCHAR(200)  NOT NULL,          -- original name, used for the download
        blob_name     VARCHAR(200)   NOT NULL,          -- name inside the textbook-materials container
        content_type  VARCHAR(120)   NOT NULL,
        size_bytes    INT            NOT NULL,
        sort_order    INT            NOT NULL DEFAULT 0,
        created_at    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_textbook_lesson_files_lesson ON dbo.textbook_lesson_files (lesson_id, sort_order);
END;

IF COL_LENGTH(N'dbo.textbook_lessons', N'games') IS NULL
    ALTER TABLE dbo.textbook_lessons ADD games NVARCHAR(MAX) NULL;

-- Jinan Book 1, lessons 1–12 (only the ones not there yet).
INSERT INTO dbo.textbook_lessons (slug, series, book_slug, book_name, sort_order, lesson_no, title, is_published)
SELECT v.slug, N'jinan', N'book-1', N'第一册', v.n, v.n, v.title, 1
FROM (VALUES
    (N'jinan-1-01', 1, N'第一课'), (N'jinan-1-02', 2, N'第二课'), (N'jinan-1-03', 3, N'第三课'),
    (N'jinan-1-04', 4, N'第四课'), (N'jinan-1-05', 5, N'第五课'), (N'jinan-1-06', 6, N'第六课'),
    (N'jinan-1-07', 7, N'第七课'), (N'jinan-1-08', 8, N'第八课'), (N'jinan-1-09', 9, N'第九课'),
    (N'jinan-1-10', 10, N'第十课'), (N'jinan-1-11', 11, N'第十一课'), (N'jinan-1-12', 12, N'第十二课')
) AS v(slug, n, title)
WHERE NOT EXISTS (SELECT 1 FROM dbo.textbook_lessons t WHERE t.slug = v.slug);

COMMIT;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0010_add-textbook-lesson-files')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0010_add-textbook-lesson-files');

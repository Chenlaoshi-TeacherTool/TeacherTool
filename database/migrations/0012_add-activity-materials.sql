-- One material record and attachment list, with many textbook lesson links.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.activity_materials', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.activity_materials (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        owner_key CHAR(64) NULL,
        theme VARCHAR(40) NOT NULL,
        title NVARCHAR(120) NOT NULL,
        description NVARCHAR(2000) NOT NULL,
        description_en NVARCHAR(2000) NOT NULL DEFAULT N'',
        limited_free BIT NOT NULL DEFAULT 0,
        preview NVARCHAR(500) NOT NULL DEFAULT N'',
        files NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        revision INT NOT NULL DEFAULT 1,
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_activity_material_files CHECK (ISJSON(files) = 1)
    );
    CREATE TABLE dbo.activity_material_lessons (
        material_id VARCHAR(64) NOT NULL REFERENCES dbo.activity_materials(id) ON DELETE CASCADE,
        lesson_id INT NOT NULL REFERENCES dbo.textbook_lessons(id) ON DELETE CASCADE,
        PRIMARY KEY (material_id, lesson_id)
    );
    CREATE INDEX IX_activity_material_lesson ON dbo.activity_material_lessons(lesson_id);
END;
IF NOT EXISTS (SELECT 1 FROM dbo.activity_materials WHERE id = 'five-elements-planets')
    INSERT INTO dbo.activity_materials (id, theme, title, description, description_en, limited_free, files)
    VALUES ('five-elements-planets', 'five-elements', N'五行星球活动', N'星球寻宝彩铅版，六张 A4 大图。',
        N'Planet treasure hunt: six A4 colored-pencil pictures.', 1,
        N'[{"name":"星球寻宝_彩铅版_六张A4大图.pdf","url":"https://chenlaoshitteaching.blob.core.windows.net/printables/five-elements/planet-treasure-hunt-pencil-a4.pdf"},{"name":"星球寻宝_彩铅版_六张A4大图.docx","url":"https://chenlaoshitteaching.blob.core.windows.net/printables/five-elements/planet-treasure-hunt-pencil-a4.docx"}]');
IF NOT EXISTS (SELECT 1 FROM dbo.textbook_lessons WHERE series = N'jinan' AND book_slug = N'book-1' AND slug = N'jinan-1-04' AND lesson_no = 4)
    THROW 50001, 'Jinan Book 1 Lesson 4 was not found. Confirm the target lesson before migrating.', 1;
UPDATE dbo.textbook_lessons SET title = N'金木水火土'
WHERE series = N'jinan' AND book_slug = N'book-1' AND slug = N'jinan-1-04' AND title = N'第四课';
INSERT INTO dbo.activity_material_lessons (material_id, lesson_id)
SELECT 'five-elements-planets', id FROM dbo.textbook_lessons l
WHERE series = N'jinan' AND book_slug = N'book-1' AND slug = N'jinan-1-04' AND lesson_no = 4
AND NOT EXISTS (SELECT 1 FROM dbo.activity_material_lessons WHERE material_id = 'five-elements-planets' AND lesson_id = l.id);
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0012_add-activity-materials')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0012_add-activity-materials');
COMMIT;

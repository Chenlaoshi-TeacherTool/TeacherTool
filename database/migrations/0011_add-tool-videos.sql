-- Tutorial videos for each tool, set at /admin/toolvideos. Every tool page
-- shows a "Watch how" button when its path has a video (milk-tea-footer.js
-- reads /api/tool-videos). One Chinese and one English YouTube link per tool.
-- Safe to run twice. Not exposed through DAB.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.tool_videos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tool_videos (
        tool_path   NVARCHAR(300)  NOT NULL PRIMARY KEY,  -- e.g. /teaching-tools/lucky-wheel (no trailing slash)
        video_zh    NVARCHAR(300)  NULL,                  -- YouTube link, Chinese version
        video_en    NVARCHAR(300)  NULL,                  -- YouTube link, English version
        updated_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

COMMIT;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0011_add-tool-videos')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0011_add-tool-videos');

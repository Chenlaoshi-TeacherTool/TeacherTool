-- Things a teacher account starred ("我的收藏"), in the teacher's own order.
-- Generic on purpose: kind says what ref points at. The app accepts 'tool'
-- (ref = the tool's href in config/tools.js) for now; themes, textbook pages
-- and community items can be added later without a new table.
-- Same owner_key scheme as 0002/0004. Safe to run twice. Not exposed through DAB.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.teacher_favorites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.teacher_favorites (
        owner_key CHAR(64) NOT NULL,
        kind VARCHAR(20) NOT NULL,
        ref NVARCHAR(300) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_teacher_favorites PRIMARY KEY (owner_key, kind, ref)
    );
END;

COMMIT;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0027_add-teacher-favorites')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0027_add-teacher-favorites');

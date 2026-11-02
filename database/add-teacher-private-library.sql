SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.teacher_private_libraries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.teacher_private_libraries (
        owner_key CHAR(64) NOT NULL PRIMARY KEY,
        content NVARCHAR(MAX) NOT NULL,
        revision INT NOT NULL,
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_teacher_private_library_json CHECK (ISJSON(content) = 1),
        CONSTRAINT CK_teacher_private_library_revision CHECK (revision > 0)
    );
END;

IF OBJECT_ID(N'dbo.teacher_library_access', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.teacher_library_access (
        owner_key CHAR(64) NOT NULL PRIMARY KEY,
        write_until DATETIME2 NOT NULL,
        granted_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

COMMIT;

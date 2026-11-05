-- One row per teacher account, so an admin can find a teacher by the email
-- they signed up with (e.g. the email in a PayPal note) and see their
-- membership. Filled in automatically when a teacher signs in.
-- owner_key is the same SHA-256 key used by the other teacher_* tables.
-- Safe to run twice. Not exposed through DAB.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.teacher_accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.teacher_accounts (
        owner_key     CHAR(64)      NOT NULL PRIMARY KEY,
        provider      VARCHAR(40)   NOT NULL,          -- Easy Auth provider, e.g. 'teachers'
        email         NVARCHAR(320) NULL,              -- lower case; NULL if sign-in gave none
        display_name  NVARCHAR(200) NULL,
        created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        last_seen_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_teacher_accounts_email ON dbo.teacher_accounts (email);
END;

COMMIT;

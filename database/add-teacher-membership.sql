-- Teacher membership: 3-day trial on first sign-in and one-time activation codes.
-- Requires add-teacher-private-library.sql (dbo.teacher_library_access).
SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- When the account received its automatic trial (NULL = no trial given,
-- e.g. access granted by hand before trials existed).
IF COL_LENGTH(N'dbo.teacher_library_access', N'trial_started_at') IS NULL
    ALTER TABLE dbo.teacher_library_access ADD trial_started_at DATETIME2 NULL;

IF OBJECT_ID(N'dbo.teacher_activation_codes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.teacher_activation_codes (
        -- SHA-256 of the normalized code; the code itself is never stored.
        code_hash CHAR(64) NOT NULL PRIMARY KEY,
        days INT NOT NULL,
        batch_label NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        created_by NVARCHAR(200) NULL,
        redeemed_by CHAR(64) NULL,
        redeemed_at DATETIME2 NULL,
        CONSTRAINT CK_teacher_activation_code_days CHECK (days BETWEEN 1 AND 3660)
    );
    CREATE INDEX IX_teacher_activation_codes_created ON dbo.teacher_activation_codes (created_at DESC);
END;

COMMIT;

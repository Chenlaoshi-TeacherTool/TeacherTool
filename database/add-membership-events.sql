-- A history of every change to a teacher's cloud saving (membership) end date:
-- the automatic trial, activation codes, and refunds (deactivated codes).
-- teacher_library_access keeps only the current end date; this table says how
-- it got there. Rows are only ever added, never changed.
-- Requires add-teacher-membership.sql and add-activation-code-revocation.sql.
-- Safe to run twice; the backfill only runs while the table is empty.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.membership_events', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.membership_events (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        owner_key     CHAR(64)      NOT NULL,
        kind          VARCHAR(10)   NOT NULL,      -- 'trial', 'code', 'refund'
        days          INT           NOT NULL,      -- days added (negative for a refund)
        until_before  DATETIME2     NULL,          -- end date before the change (NULL = none / unknown)
        until_after   DATETIME2     NULL,          -- end date after the change (NULL = unknown, backfilled)
        code_hash     CHAR(64)      NULL,          -- the activation code involved, if any
        actor         NVARCHAR(200) NULL,          -- admin who made the change; NULL = the teacher or the site
        created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_membership_events_kind CHECK (kind IN ('trial', 'code', 'refund'))
    );
    CREATE INDEX IX_membership_events_owner ON dbo.membership_events (owner_key, created_at DESC);
END;

-- Backfill what the existing tables already record (exact earlier end dates are unknown).
IF NOT EXISTS (SELECT 1 FROM dbo.membership_events)
BEGIN
    INSERT INTO dbo.membership_events (owner_key, kind, days, code_hash, created_at)
    SELECT owner_key, 'trial', DATEDIFF(DAY, trial_started_at, write_until), NULL, trial_started_at
    FROM dbo.teacher_library_access
    WHERE trial_started_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.teacher_activation_codes c WHERE c.redeemed_by = teacher_library_access.owner_key);

    -- Trial rows for accounts that later used a code: the trial length is not recorded, so assume 3 days.
    INSERT INTO dbo.membership_events (owner_key, kind, days, code_hash, created_at)
    SELECT owner_key, 'trial', 3, NULL, trial_started_at
    FROM dbo.teacher_library_access
    WHERE trial_started_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM dbo.teacher_activation_codes c WHERE c.redeemed_by = teacher_library_access.owner_key);

    INSERT INTO dbo.membership_events (owner_key, kind, days, code_hash, created_at)
    SELECT redeemed_by, 'code', days, code_hash, redeemed_at
    FROM dbo.teacher_activation_codes WHERE redeemed_by IS NOT NULL;

    INSERT INTO dbo.membership_events (owner_key, kind, days, code_hash, actor, created_at)
    SELECT redeemed_by, 'refund', -days, code_hash, revoked_by, revoked_at
    FROM dbo.teacher_activation_codes WHERE redeemed_by IS NOT NULL AND revoked_at IS NOT NULL;
END;

COMMIT;

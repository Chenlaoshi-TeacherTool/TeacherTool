-- Lets an admin deactivate an activation code (for a refund). A deactivated
-- code can no longer be redeemed; if it was already used, its days are taken
-- back from that teacher's cloud saving. Requires 0003_add-teacher-membership.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.teacher_activation_codes', N'revoked_at') IS NULL
    ALTER TABLE dbo.teacher_activation_codes ADD revoked_at DATETIME2 NULL, revoked_by NVARCHAR(200) NULL;

COMMIT;

-- Record this migration (see database/README.md).
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0005_add-activation-code-revocation')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0005_add-activation-code-revocation');

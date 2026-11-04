-- Lets an admin deactivate an activation code (for a refund). A deactivated
-- code can no longer be redeemed; if it was already used, its days are taken
-- back from that teacher's cloud saving. Requires add-teacher-membership.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.teacher_activation_codes', N'revoked_at') IS NULL
    ALTER TABLE dbo.teacher_activation_codes ADD revoked_at DATETIME2 NULL, revoked_by NVARCHAR(200) NULL;

COMMIT;

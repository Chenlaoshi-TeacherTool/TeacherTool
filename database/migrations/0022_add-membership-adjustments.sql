SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.membership_events', 'reason') IS NULL
    ALTER TABLE dbo.membership_events ADD reason NVARCHAR(500) NULL;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_membership_events_kind')
    ALTER TABLE dbo.membership_events DROP CONSTRAINT CK_membership_events_kind;
ALTER TABLE dbo.membership_events ADD CONSTRAINT CK_membership_events_kind CHECK (kind IN ('trial','code','refund','extend','set','stop'));
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id=N'0022_add-membership-adjustments')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0022_add-membership-adjustments');
COMMIT;

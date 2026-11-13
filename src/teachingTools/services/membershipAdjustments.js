'use strict';
function fail(message) { var error = new Error(message); error.status = 400; throw error; }
function validate(body) {
  if (!['extend','set','stop'].includes(body.action)) fail('请选择有效的调整操作。');
  var reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length > 500) fail('请填写调整原因，不超过500字。');
  var days = Number(body.days);
  if (body.action === 'extend' && (!Number.isInteger(days) || days < 1 || days > 3660)) fail('增加天数请填写1至3660的整数。');
  var until = null;
  if (body.action === 'set') {
    if (!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(body.date || '')) fail('请填写2000至2099年之间的有效日期。');
    until = new Date(body.date + 'T23:59:59.999Z');
    if (!Number.isFinite(until.getTime()) || until.toISOString().slice(0,10) !== body.date) fail('到期日期无效。');
  }
  if (body.expected !== 'none' && !/^\d{1,16}$/.test(body.expected || '')) fail('页面状态无效，请刷新后重试。');
  return { action: body.action, days: body.action === 'extend' ? days : 0, until: until, reason: reason, expected: body.expected };
}
function create(client) {
  var db = client || require('./sqlClient');
  async function get(owner) {
    if (!/^[0-9a-f]{64}$/.test(owner)) return null;
    var result = await (await db.getPool()).request().input('owner',db.sql.Char(64),owner).query(
      'SELECT a.owner_key, a.email, a.display_name, l.write_until, ' +
      "COALESCE(CONVERT(VARCHAR(30),DATEDIFF_BIG(MILLISECOND,CONVERT(DATETIME2,'1970-01-01'),l.write_until)),'none') AS expected " +
      'FROM dbo.teacher_accounts a LEFT JOIN dbo.teacher_library_access l ON l.owner_key=a.owner_key WHERE a.owner_key=@owner;');
    var row = result.recordset[0];
    return row ? { owner: row.owner_key, email: row.email, name: row.display_name, until: row.write_until, expected: row.expected } : null;
  }
  async function adjust(owner, body, actor) {
    if (!/^[0-9a-f]{64}$/.test(owner)) fail('老师账户无效。');
    var values = validate(body);
    var result = await (await db.getPool()).request().input('owner',db.sql.Char(64),owner)
      .input('action',db.sql.VarChar(10),values.action).input('days',db.sql.Int,values.days)
      .input('until',db.sql.DateTime2,values.until).input('reason',db.sql.NVarChar(500),values.reason)
      .input('expected',db.sql.VarChar(30),values.expected).input('actor',db.sql.NVarChar(200),String(actor).slice(0,200))
      .query(
        'SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION; ' +
        "IF NOT EXISTS (SELECT 1 FROM dbo.teacher_accounts WHERE owner_key=@owner) BEGIN ROLLBACK; SELECT 'missing' AS outcome; RETURN; END; " +
        'DECLARE @before DATETIME2, @after DATETIME2, @now DATETIME2=SYSUTCDATETIME(); ' +
        'SELECT @before=write_until FROM dbo.teacher_library_access WITH (UPDLOCK,HOLDLOCK) WHERE owner_key=@owner; ' +
        "IF COALESCE(CONVERT(VARCHAR(30),DATEDIFF_BIG(MILLISECOND,CONVERT(DATETIME2,'1970-01-01'),@before)),'none') <> @expected " +
        "BEGIN ROLLBACK; SELECT 'conflict' AS outcome; RETURN; END; " +
        "SET @after=CASE WHEN @action='extend' THEN DATEADD(DAY,@days,CASE WHEN @before>@now THEN @before ELSE @now END) WHEN @action='set' THEN @until ELSE @now END; " +
        'IF @before IS NULL INSERT INTO dbo.teacher_library_access(owner_key,write_until) VALUES (@owner,@after); ' +
        'ELSE UPDATE dbo.teacher_library_access SET write_until=@after WHERE owner_key=@owner; ' +
        'INSERT INTO dbo.membership_events(owner_key,kind,days,until_before,until_after,actor,reason) ' +
        "VALUES (@owner,@action,CASE WHEN @action='extend' THEN @days ELSE DATEDIFF(DAY,COALESCE(@before,@now),@after) END,@before,@after,@actor,@reason); " +
        "COMMIT; SELECT 'saved' AS outcome, @after AS write_until;"
      );
    return result.recordset[0];
  }
  return { get: get, adjust: adjust };
}
module.exports = Object.assign(create(), { create: create, validate: validate });

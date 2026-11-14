# 教师资源分享（第一步）

- 管理入口：`/admin/teacher-resources`，沿用 Admin 身份验证与同源保存检查。
- 前台入口：`/community#teacher-resources`。不改变原有 Community 导航启用状态和用户投稿审核。
- 单条新增、保存草稿、发布、下架；保存下一版草稿保留当前公开版本。
- 文字卡片、原生介绍弹窗、独立新标签页外链；没有引入第三方图片或 logo。
- 发布需要简介、分类、利益关系说明、最近核查日期，以及人工核实勾选。
- 网站功能文字目前以中文整理；界面标签支持中英文。

## 数据与部署

新增迁移 `0023_add-teacher-resources.sql`。部署前按现有数据库迁移流程执行；迁移重复执行不会覆盖已有推荐。没有执行云端迁移或部署。

SQL 使用独立的 `dbo.teacher_resources` 表存储草稿及公开版本。本地没有 SQL 连接时使用 `src/teachingTools/tmp/teacher-resources.json`；初次载入从 `data/teacher-resource-drafts.json` 提供五条草稿。两种存储不会自动互相同步。

五条初稿全部未发布。利益关系留空，需管理员按实际情况填写，不能推断无赞助或无佣金。推荐理由为公开功能基础上的编辑建议，不代表陈老师已亲测。卡兜具体功能仍待人工核实。

## 初稿依据（2026-11-14）

- [张老师中文课堂](https://zhanglaoshichinese.com/)：公开首页可读文字，识字、HSK、分组积分、笔顺与书写工具。
- [卡兜课堂游戏](https://kadou.yuntika.com/)：仅核实网页标题，没有据其他域名的介绍填充其功能。
- [QuizPebble](https://www.quizpebble.com/)：公开首页的游戏、词卡、复习、作业、结果与学习单介绍。
- [LumiTeach](https://www.lumiteach.com/)：公开索引的中文首页内容，课堂管理、游戏、学习及材料生成；保留用户给定的原始网址。
- [Mandarin Studio](https://themandarinstudio.com/)：公开首页文字说明课程内容转游戏与学习单，没有假定具体导出与收费能力。

## 验证

`node --test test/teacherResources.test.js test/community.test.js test/adminPages.test.js test/siteMap.test.js`

本地 Playwright 使用隔离的预览数据检查五张卡片、弹窗、Escape 关闭、新标签外链、390px 手机布局与后台编辑。预览中的商业关系说明为示例，不写入实际推荐数据。SQL 参数化保存使用模拟数据库测试；未实际连接 Azure SQL。

## 第二步：网站投稿与审核

- 分享区提供“分享教学网站”和“我的网站投稿”。原投稿页选择“教学网站”也进入新表单。
- 教师登录后可提交名称、公开 HTTPS 链接、简介、功能、场景、限制、收费和利益关系，并填写公开署名。
- `/community/websites/mine` 仅显示当前账户的投稿；修改入口同样校验所有权。
- Admin 的“教师资源分享”优先显示待审核投稿，可以编辑、批准发布、填写意见后退回补充或下架。
- 修改或重投只替换草稿，不改变公开版本。退回意见只在投稿人自己的页面和 Admin 显示。
- 审核与重投携带版本号；SQL 使用事务和版本条件更新，过期页面返回 409，避免覆盖新投稿。
- 数据迁移新增 `0024_add-teacher-resource-review.sql`，记录投稿人、审核状态、处理意见和版本号。未执行云端迁移或部署。
- 原有社区帖子和旧网站投稿继续在 `/admin/community` 管理，不搬迁或覆盖历史记录。新界面的教学网站投稿统一进入“教师资源分享”。
- 该步骤不含广告交易、推广期限或付款功能。

验证：`node --test test/teacherResourceReview.test.js test/teacherResources.test.js test/community.test.js test/siteMap.test.js test/dbMigrations.test.js`。
隔离的本地 Playwright 流程覆盖提交、未审不公开、退回意见、重投、批准、再次修改保留旧版，以及手机页面布局。身份使用本地演示账户，不证明生产登录供应商配置可用。

## 第三步：商业披露与推广期限

- Admin 为每条推荐选择待核实、无商业合作、付费推广、含佣金链接或其他商业合作。发布前必须选择已核实类型，并填写已有的利益关系说明。
- 付费推广必须设置开始与结束日期，可选择推广期间优先展示，以及到期后保留普通收录或停止展示。日期按 America/Los_Angeles 计算，包含结束日。
- 卡片与详情弹窗均显示商业标识。推广开始前注明付费合作待开始，到期保留时显示“曾付费推广”；佣金及其他合作有独立标识。商业外链增加 sponsored 属性。
- 优先展示只在有效付费推广期间生效，在现有搜索、分类和分页之前排序。到期后优先位置自动取消。到期停止展示同时移除卡片和详情弹窗，但保留后台数据。
- 到期规则在每次服务器渲染时计算，不依赖后台定时任务；已经打开的页面需要刷新才能反映最新日期状态。
- 老师投稿和重投无法修改 Admin 的推广设置；保存草稿不改变公开的合作信息，需重新发布才生效。
- 推广配置存入既有 draft/published JSON，不新增数据库表或迁移；仍需前两步的 0023、0024 迁移。
- 无在线付款、套餐、佣金结算或广告交易功能；不自动启用 Community 导航，不部署上线。

新增测试 `test/teacherResourcePromotion.test.js`，覆盖商业关系校验、洛杉矶日期边界和夏令时、到期保留与隐藏、推广排序、双位置标识、老师权限与草稿隔离。

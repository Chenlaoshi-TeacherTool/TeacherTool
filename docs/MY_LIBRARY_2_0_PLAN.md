# My Library 2.0：安全审查、备份准备与兼容迁移规划

## 实施进度补充（2026-10-29—2026-10-30）

以下为首轮静态规划之后的更新，后文“本次仅新增文档”等陈述保留为当时审查记录。

### 第三阶段：Maze 读取个人题库（2026-10-30 完成）

- Maze 新增个人题库选择、八题预览及显式应用入口，只展示统一库中的 question-bank 集合。首次支持单个个人题库，原公共题库入口继续工作。
- 从源库随机选择八个完整且答案不同的问答；选择题按 correctOptionId 或明确的 A-D 选项标签取真实答案。缺项、歧义、题目超过 120 字符、答案超过 28 字符或含现有行解析分隔符时排除并提示，数量不足时停止，不截短后导入。
- 预览不改变当前迷宫；已有问题时必须勾选替换确认。预览后编辑迷宫、修改选择或源库变化，会使预览失效；应用前重新核对库原始值与迷宫输入，防止异步覆盖。现有标题保留，空标题才自动命名。
- 草稿仍使用 chen-laoshi-maze-generator-v1，保存实际选中的八个问答，并附带每题 collectionId/itemId/revision 的 sourceRefs。刷新恢复不重新抽题；修改内容后不保留失配引用。载入示例、清空或导入公共题库会清除个人来源标记。草稿存储失败会如实提示，不声称已保存。
- Maze 对统一库只读，不改源题库，不启用云同步。手动编辑和既有 PowerPoint 生成继续使用原模板与路线逻辑。
- 验证：完整项目测试 100 项全部通过，其中新增选题适配测试 4 项。独立 Chrome 验证从 Library 界面保存到 Maze 读取、预览不覆盖、替换确认、选择题答案、来源快照、刷新恢复、编辑失效、源库变更拦截、其他标签页更新、容量失败提示和公共入口。实际生成测试 PowerPoint 并解包检查包含所选题目与答案，390px 页面整体无横向溢出，页面无运行异常。
- 本阶段只完成本地开发，尚未提交、推送或部署；上一阶段的独立恢复点为 a88c6c2。

### 第二阶段：统一个人库保存与浏览（2026-10-30 完成）

- 新增 public/shared/library-store.js；两个 Library 页面现在共享独立的 `cls-library-v2:active`。此键直接保存完整 v2 包，使用单次 localStorage.setItem 的原子替换；当前无活动项目或多包切换需求，未实现下文拟议的 staging 指针流程。
- 导入先检查现有库。相同集合内容跳过；同名称、同原始编号或内部 ID 冲突时显示保留双方的提示，必须勾选确认再保存。内部 ID 冲突会为新副本重编集合、词条、选项 ID 并保持答案引用，现有集合不会被替换。
- 保存使用浏览器 Web Locks 串行处理本应用各标签页的写入，并核对预览时的原始存储值；过期预览拒绝保存、要求重新检查。不支持 Web Locks 的环境只允许预览与下载。存储损坏、容量不足、合并超过大小/条目限制时停止保存，保留旧值；不把解析失败视为空库。
- 两个页面均可搜索、按词表/题库筛选、展开查看全部条目、下载整库备份，并监听其他标签页的存储变化。词库页增加“Preview current vocabulary draft”，可将当前输入显式预览后存入新库。
- 旧 clwl、题库与活动存储键仍由原页面功能管理，不自动迁移、不双写；旧区域保存的词表不会无提示地出现在新库。新库尚未接入 Maze、Jeopardy、Tarsia、Bingo 或云同步；生产网站未部署。
- 初始备份和新增模块均在本地；后续开发前继续保留用户原有六个修改文件。统一库容量上限仍为 5 MB、100 个集合、5,000 个条目，实际浏览器配额更小时保存会报错并提示下载。
- 最终验证：完整测试 96 项全部通过，其中转换测试 8 项、个人库存储测试 10 项。独立临时 Chrome 验证了显式保存、两页实时同步、重复跳过、冲突保留双方、刷新恢复、搜索筛选、整库下载后在全新环境恢复、错误文件拒绝、损坏存储保留及手机宽度；旧键保持不变、页面无运行异常。备份内部的同名独立集合不会被误判为与现有库冲突。
- 最终核对原有六个修改文件的差异 SHA-256 仍为 `130934A4D748493E136A8AC3E92EA39E6B809F6EAB8329FD4A971C30862B7FD2`，暂存区为空。期间出现其他工作的提交 `5e96cfa`（Halloween Secret Message），本次未修改、撤销或提交该工作；之前 HEAD 记录为历史审查基线。

### 第一阶段：格式转换与只读预览

- 主项目 1,748 个文件及嵌套工作区 1,302 个文件已独立备份并完成恢复/校验；备份保存在本聊天 outputs/my-library-backup-20261029T055903Z，未包含 Git 忽略项、浏览器数据、SQL 或 Blob。
- 用户明确确认浏览器没有需保留的已保存内容，授权直接开始开发。这是用户声明，不是自动枚举或验证浏览器存储的结论。
- 首个实现阶段为 public/shared/library-v2.js 的无存储副作用转换器，以及两个 Library 页面的 JSON 备份预览/下载。支持单词表、单题库、v1 词表 bundle、当前 v2 内容备份；活动项目、原始浏览器键值备份与 XLSX 转换暂未接入该新入口，旧 XLSX 代码保持不变。
- 初版内部 ID 使用原始文件 SHA-256 + 集合/条目位置生成不透明稳定标识，代替下文拟议的 UUID；重复预览同一文件 ID 一致，不同内容不按旧 id 覆盖，未知字段和原始字符串保留。语义相同但字节不同的文件不自动去重，正式写入功能需要独立冲突预览。
- 文件最多 5 MB、100 个集合、5,000 个条目；有结构/深度限制。转换结果过大时拒绝并提示拆分，确保下载格式仍能重新预览。缺题干/答案、重复旧题号及字母答案找不到选项时提示，不静默删记录。
- 此阶段只预览并下载文件，不读取或写入任何 localStorage/sessionStorage，不启用自动迁移、云同步、活动适配或生产部署。Maze 试点仍属于下一阶段。
- 验证：新增 8 项转换测试通过；两个实际 HTML 页面在独立临时 Chrome 中完成预览、下载再预览、无效文件禁用下载、文本安全显示和 390px 宽度检查。页面检查前后本地存储一致；示例数据不来自用户浏览器。

审查日期：2026-10-28（America/Los_Angeles）。项目：`C:\Users\vanes\Source\Repo\TeacherTool`。

## 1. 范围与完成标准

本次仅新增本文件；审查当前工作区源码，不修改功能、依赖、数据库、生产部署，不提交、不暂存、不丢弃用户改动。以下“现状”为本地代码证据，“建议”为后续实现；未访问生产数据库或用户浏览器存储，不将源码检查视为线上或恢复测试通过。

完成标准：记录 Git 基线及恢复边界；逐项列出六个界面的数据与导入导出；指出备份缺口；定义版本化模型、逐工具适配、无损迁移与回滚验收；最终确认只增加本规划。

## 2. Git 状态与可恢复点

当前分支 `main`，HEAD 为 `f78b921653aadffbe7442a0dad8b29803f00b181`。本机 `origin/main` 指向同一提交；未 fetch，不能证明远端此刻无新提交。最近提交依次为 `f78b921`、`000957b`、`deb11dd`、`44a6b08`、`58d874e`，reflog 可见。已有 `backup/main-before-sync` 指向 `562160d0c5fd8c31fb96ba84b70aab66464ef445`，是较旧代码恢复点；stash 列表为空。

已有六个修改文件（98 行新增、16 行删除）：

- `src/teachingTools/locales/translations.js`
- `src/teachingTools/public/low-prep/book-generator/book-generator.js`
- `src/teachingTools/public/low-prep/jeopardy/jeopardy.js`
- `src/teachingTools/routes/bookGenerator.js`
- `src/teachingTools/views/book-generator/player.ejs`
- `src/teachingTools/views/low-prep-activities/book-generator.ejs`

Jeopardy 现有差异是 PDF 题目/答案换行并取消截断，本次审查以该工作区版本为准，后续适配必须保留它。

已有未跟踪条目（Git 默认折叠目录）：`.agents/`、`output/`、`server-error.log`、`server-output.log`、`skills-lock.json`、`src/teachingTools/public/low-prep/uno-card-generator/`、`src/teachingTools/public/templates/maze-generator-editable-template.pptx`、`src/teachingTools/server-error.log`、`src/teachingTools/server-output.log`、`src/teachingTools/test/bookGeneratorSecurity.test.js`、`src/teachingTools/test/jeopardyExport.test.js`、`src/teachingTools/test/wordlistReliability.test.js`、`src/teachingTools/views/low-prep-activities/uno-card-generator.ejs`、`tmp/`、`work/`。

未发现项目内 AGENTS.md；项目上级 Source/Repo、Source 及用户目录的对应检查未发现 AGENTS.md。遵循本会话给定的四项原则。

### 备份状态必须分开看

| 层次 | 已确认 | 尚未完成 / 边界 |
|---|---|---|
| 已提交代码 | HEAD、本机远程跟踪引用、旧备份分支、reflog | 未新建 bundle、分支或提交；没有独立离线备份验证 |
| 未提交及未跟踪工作 | 已记录列表及 tracked diff 基线 | Git 提交点不包含这些内容；本次未创建它们的备份包 |
| 浏览器本地数据 | 已查明源码中的键与结构 | 未连接用户使用的浏览器/站点 origin；未读取、导出或验证任何真实数据 |
| SQL / Blob / 公共内容 | 已读路由、服务、schema 与架构文档 | 未获取数据库快照、媒体副本或分享数据；代码仓库不能替代它们 |

当前适合完成文档规划；开始功能迁移前必须完成未提交工作副本与浏览器数据备份。不要用 reset、clean、stash 或 checkout 覆盖来“清理”工作区。可另行制作外部恢复包，包含 tracked 的 staged/unstaged binary patch、未跟踪所需文件清单及副本、HEAD 与校验和；敏感配置按私密备份处理，恢复到临时目录验证后再动功能代码。此为待办，并非已执行。

## 3. 文件与数据流清单

下表路径均相对 `src/teachingTools/`；每个 HTML/EJS 同目录样式也在审查范围。

| 界面 | 主要文件 | 数据、保存与导入 | 导出及恢复边界 |
|---|---|---|---|
| My Library（词库页） | `public/teaching-tools/word-list-library/word-list-library.{html,js,css}`；`public/shared/wordlist-core.js` | 文本建词表、公共 starter packs、浏览器多词表；列表含 id/name/theme/level/items/updated，词条 zh/py/en/theme/level/img/note | 页面下载单词表 JSON、打印 PDF；核心有 exportAll/importAll，但页面未提供 JSON 文件恢复入口。不能把核心函数存在视为用户已能一键恢复 |
| Question Bank Library | `public/teaching-tools/question-bank-library/question-bank-library.{html,js,css}`；`public/shared/questionbank-core.js` | 公共题库 API；核心支持浏览器多题库；保留 XLSX 解析代码，但 HTML 上传 disabled，savedBanks 容器 hidden，显示 Coming soon | 当前选中题库可下载 JSON；页面只接收 XLSX，没有 JSON 恢复入口。历史个人库可能仍存在但 UI 隐藏 |
| Bingo | `views/low-prep-activities/bingo-generator.ejs`；`public/low-prep/bingo-generator/bingo-generator.{js,css}` | 文本词条、共享 picker 取公共词表；映射 zh/py/en/emoji，按 zh 去重。生成的卡片及 meta 保存在内存 | Word DOCX、打印/存 PDF；未见此工具自身 localStorage 草稿或 JSON 项目导入导出；刷新前需另存输入与设置 |
| Maze | `views/low-prep-activities/maze-generator.ejs`；`public/low-prep/maze-generator/maze-generator.{js,css}` | title + 8 个 question/answer pair；文本解析或公共题库挑选；单份本地草稿 | 从模板生成可编辑 PPTX；无 JSON 项目导入导出。PPTX 可人工保留内容，但不是可重新导入的项目备份 |
| Jeopardy | `views/low-prep-activities/jeopardy.ejs`；`public/low-prep/jeopardy/jeopardy.{js,css}` | 词表与公共题库生成、手动编辑；多棋盘本地保存。G 含 id/name/rows/base/step/seconds/categories/teams，clue 含 q/a/dd/used | JSON 项目导出/导入、PPTX、PDF；JSON 导入只检查 categories 存在并清空 id，需另按保存；未见全棋盘一键备份 |
| Tarsia | `views/low-prep-activities/tarsia-puzzle.ejs`；`public/low-prep/tarsia-puzzle/tarsia-puzzle.{js,css}` | 词汇/问答模式、公共库 picker、本机词表读取；单份草稿保存模式、尺寸、两侧字段、标题、原始输入和 seed | PDF 两页及打印；当前无 PPTX 或 JSON 项目导入导出。已编辑 pair 与翻译内存未全部包含在草稿，不能据草稿承诺完整恢复 |

共享连接层：`public/shared/library-picker.js` 的 SOURCE_CONFIG 只有公共 `/api/wordlists/presets` 与 `/api/questionbanks/presets`（及按 id 获取详情）；它不是统一个人库选择器。两个库页面都显示 My Library 标题，但仍是两套实现。

后端证据：`routes/api.js`、`services/dabWordListsClient.js`、`services/dabQuestionBanksClient.js`、`routes/admin.js`、`database/schema.sql`。公共词表详情返回 items（zh/py/en/theme/level/img/note），公共题库返回 questions（id/theme/level/prompt/answer/tags/type/options/note）与父级 description/theme/level/curriculum。DAB 将 SQL slug 暴露为 API id；不能当成浏览器自建 id 的同一个命名空间。

`GET /api/wordlists/mine` 未登录 401，登录后仍为 501；登录检测不等于个人云同步已实现。现有 SQL 的 word_lists 有 owner_user_id，questions.external_id 有全局 UNIQUE；未来个人题库不能直接复用未经隔离的全局题号约束。`docs/azure-architecture-migration.md` 已取代旧 Table Storage 方案；文档部分历史“当前状态”已过时，以实际路由和 schema 为依据，云资源当前状态未验证。

### 存储键、格式与风险

| 键 / 介质 | 内容 | 风险 |
|---|---|---|
| localStorage `clwl:index`、`clwl:<id>` | 词表索引及独立 JSON 正文 | exportAll 只沿索引加载，会漏孤儿正文；不可用时核心回退内存；importAll 同 id 调 save 可覆盖 |
| localStorage `chenlaoshi-questionbanks-v1` | 整个 banks 数组；bank 有 id/name/importedAt/updatedAt/source/questions | 解析失败返回空数组，不能据此断言无数据；normalizeBank 会过滤空 prompt、重设 updatedAt、舍弃未列字段，直接拿它迁移会损失元数据 |
| localStorage `cljp:index`、索引内记录的 id（通常 `cljp:<timestamp>`） | 棋盘索引及 G 正文 | 正文、索引分两次写入，无整体事务；容量失败可能不一致；索引外记录也需保留 |
| localStorage `chen-laoshi-maze-generator-v1` | `{title,pairs:[{question,answer}]}` | 仅一份草稿，保存异常被吞掉；不保存完整生成布局/随机状态 |
| localStorage `chen-laoshi-tarsia-puzzle-v1` | `{mode,size,sideTypes,title,vocabulary,qa,seed}` | 未直接保存 state.pairs、translatedWords；旧 matchType 兼容分支需保留；手改与翻译需额外保存 |
| sessionStorage `chenlaoshi-wordlist-booklet-draft` | 词表传给 booklet 的临时稿 | 随标签页会话消失，不是长期备份 |
| localStorage `teacherTool.emojiChoices.v1` | emoji 选择偏好 | 辅助数据，与工具主体分开备份 |
| localStorage `teacher-game-shares:v1` | 分享记录，含 deleteToken | 属管理凭据，必须私密保存；分享链接不等于个人库或完整项目备份 |

上述主体存储路径未发现 IndexedDB 使用；不能据此推断其他工具或浏览器里没有数据库。localStorage 按协议、域名和端口隔离，不同浏览器/profile、www/非 www、localhost/生产站均需分别检查。

## 4. 浏览器数据的手动备份准备

**本次浏览器备份状态：未执行，真实记录数未知，恢复未验证。** 用户需要在实际使用的浏览器与站点中完成以下操作，或后续明确由连接到该浏览器的受控会话完成。不要在备份前清缓存、清站点数据、换域名、重建草稿或批量导入。

1. My Library：逐个打开已保存词表，下载 JSON；保留原始输入与图片/附件。核心 exportAll 仅作为后续全量备份实现依据，当前页面没有一键全量恢复承诺。
2. Jeopardy：逐个已保存棋盘加载并下载 JSON；当前未保存棋盘也先下载；在独立测试环境验证导入、题目、分值、队伍和 used 状态，再按保存。加载其他棋盘前先保存当前编辑。
3. Question Bank：可见题库逐个下载 JSON，同时保留原 XLSX。历史个人库被隐藏时，不能靠当前页面下载公共题库代替它的备份。
4. Maze：先保留当前题目答案原文、标题与 PPTX；Tarsia：保留输入、两侧字段、尺寸、标题、手改配对、翻译及 PDF。Bingo：复制输入并记录网格、自由格、份数、展示字段，下载 Word/PDF；若需保留完全相同卡片排列，现有导出只能作为成品记录。
5. 对无法通过界面全量导出的数据，在浏览器开发者工具 Application/Storage 中记录正确 origin，私密导出上述相关 localStorage 原始键值（含索引和所有前缀正文，不仅索引可见条目）及所需 sessionStorage。不要只截图，不把 token 放进 Git、公共分享或规划文档。当前工具无统一导出按钮时，应由开发人员协助原始键值导出，不能声称 UI 已覆盖。
6. 记录 origin、浏览器/profile、时间、文件名、大小、记录数与校验和。JSON 能解析只是第一步，还需在隔离环境恢复并逐项对照；图片 URL 不包含图片二进制，外链及 SQL/Blob 内容需要独立副本或可用性验证。

恢复工作应在临时浏览器 profile 或隔离 origin 完成；原站数据不作为实验场。先保存异常原始字符串，再分析坏 JSON；不能以空数组替换解析失败的数据。

## 5. 建议的统一数据模型（待实现）

采用一个版本化备份包，内容集合与活动实例分开。先统一浏览器契约和适配器，不引入登录、收费、云同步依赖，不在这一阶段改 SQL。

```json
{
  "format": "cls-teaching-library",
  "schemaVersion": 2,
  "exportedAt": "2026-10-28T00:00:00Z",
  "collections": [],
  "activities": [],
  "legacyRecords": [],
  "migration": { "adapterVersion": 1, "sources": [] }
}
```

示例时间只是格式示例，不是本次导出时间。

| 对象 | 建议字段与约束 |
|---|---|
| Collection | id（内部稳定 UUID）、kind（vocabulary/question-bank）、name、description、theme、level、curriculum、tags、createdAt/updatedAt（未知可 null）、revision、source、items |
| source | kind（local/preset/import）、legacyId、origin、sourceCollectionId、sourceRevision（未知可 null）；旧来源名保留为 sourceLabel；公共内容与私人副本分别 id，公共源不原位写入 |
| VocabularyItem | id、kind=vocabulary、term、pronunciation、definition、translations（按语言键保存文字）、emoji、imageUrl、theme、level、note、legacy。zh→term、py→pronunciation、en→definition；不假设所有词条都是中文 |
| QuestionItem | id、kind=question、prompt、answer（原始字符串）、type（原标签）、options（有稳定 id/label/text 的有序数组）、correctOptionId（仅可确定时填写）、theme、level、tags、note、legacy。A-D 字母答案不猜测改写；缺选项或歧义报告给用户 |
| Activity | id、tool、title、sourceRefs（collectionId/itemId/revision）、contentSnapshot、settings、runtime、legacy。sourceRefs 可为空以接收旧独立草稿；快照保存实际选题与手改结果，源库修改不自动重写已备课活动 |
| legacyRecords | sourceKey、rawValue（原始字符串）、origin、capturedAt、checksum；保留未知字段、坏 JSON、孤儿条目和无法映射的记录，以便回滚与人工修复；含管理 token 的记录默认不进入普通可分享备份 |

日期规则：词表 updated、题库 importedAt/updatedAt、索引 updated 有效时转换为 UTC ISO 字符串，原数值留 legacy；缺值不伪造历史创建时间，迁移时间另记。旧 question id 用来源集合限定，新内部 id 与 legacyId 分开，避免不同老师、银行或公共 slug 碰撞。

无需抽象出超出本阶段的题型引擎。词表和题库维持有区别的 item kind，共用集合外壳；渲染器通过适配器接收自己需要的格式。

### 活动适配与验收

| 工具 | 输入与规则 | 必须保留/验证 |
|---|---|---|
| Bingo | 首先接词条；以后可显式将问答转换为答案格，不自动丢题意 | term/py/definition/emoji 映射、现有按词去重行为、gridSize/freeSpace/fields/sheetCount；保存实际生成 cards，避免仅凭随机种子无法还原 |
| Maze | 从题库选择完整问答，当前固定 8 对；不足阻止生成并说明 | 字母答案映射选项文本、原题来源、实际顺序及最终 8 对；选择新库前处理当前草稿；PPTX 模板依然使用当前 chenlaoshi 模板 |
| Jeopardy | 每集合对应 category 或老师手动分类，保持当前 rows/base/step/seconds | 展示题干与选项、答案文本、dd/used、队伍与分数分开存 runtime；从旧 G 迁移不重新抽题，不影响现有 PDF 换行改动 |
| Tarsia | 词汇或问答，两侧各选字段；size、sideTypes 与旧 matchType 兼容 | 直接保存最终 pairs 的 a/b/kindA/kindB 与翻译文字、手改、seed、原始输入。未知语言不自动覆盖为英语；内容不足/答案歧义显示预览警告 |

## 6. 兼容迁移与回滚方案（待实现）

1. **先备份原始值。** 枚举允许的存储键与前缀，既检查索引也检查正文；逐个解析，记录空、坏 JSON、孤儿、重复 id。旧 v1 wordlist bundle、单词表 JSON、单题库 JSON、XLSX、Jeopardy G、Maze/Tarsia 草稿均由独立检测器识别；未知格式拒绝导入，保留原文件。
2. **只读生成预览。** 不调用旧 save/normalizeBank/importAll 进行采集，以免重设时间、删字段或覆盖同 id。给出集合数/条目数/活动数、冲突、丢失字段、不可恢复部分；Tarsia 未持久化的内存译文不能从旧草稿推回。
3. **稳定映射且可重试。** 用 origin + sourceKey + legacyId/原始记录位置 建映射；将分配的新 id 持久保存在迁移清单。内容 checksum 用于发现重复导入，不能按题目文本合并不同答案。相同旧 id 但内容不同，默认保留双方并提示冲突；覆盖需单独明确选择。
4. **写入新键的 staging 包。** 建议 `cls-library-v2:staging:<migrationId>`，配套 manifest、校验和和状态；读取验证通过后，将 `cls-library-v2:active` 切换到已验证包。该指针只代表单键切换，不声称跨 localStorage 多键事务。提交前检查旧键 checksum 未变化，发现其他标签页写入即中止并重新预览。
5. **验证再启用。** 验证 schemaVersion、类型/长度/数量、item 引用、选项答案、计数、关键字段与快照一致；读取回验、导出再导入的语义一致性必须通过。配额不足、权限被禁、写入失败或校验失败时保持旧读取路径和数据。
6. **保持 v1。** 不删除、不改名、不覆盖旧键，不默认双向写入；v2 激活前旧工具仍读 v1。逐工具切换到 v2 适配器，来源与版本明确。若尚有旧工具继续写 v1，检测来源 checksum 漂移并提示重新预览，不静默覆盖 v2 新工作。
7. **回滚。** 切回旧读取路径即可看到迁移前 v1 数据；v2 期间新增内容先导出独立 v2 备份保留，不承诺旧工具能读懂。保留 staging/active 包用于恢复，不以清空存储回滚。将 v2 降级为 v1 时另做显式有损字段预览。

导入安全：限制文件字节、集合/条目数量、字符串长度、数组层级；XLSX 同时限制解压后大小，避免仅凭现有 5 MB 压缩包限制。只按允许字段构建对象，避免不可信键合并；文本通过 textContent/既有转义渲染，图片 URL 校验协议。未知主版本拒绝写入，未知字段放 legacy；不能把备份里的 ownerId、权限或 deleteToken 当服务器授权。

## 7. 风险与优先级

| 优先级 | 风险 / 任务 | 下一步验收 |
|---|---|---|
| P0 | 浏览器数据和未提交工作没有本次独立备份 | 完成私密恢复包与隔离恢复；记录真实计数、校验和，逐工具对照 |
| P0 | 个人题库 UI 隐藏、JSON 下载缺恢复闭环 | 先交付只读备份/预览与 JSON 导入验证，坏记录保留；不先开启批量覆盖 |
| P0 | Tarsia 草稿不含全部最终配对/译文；Bingo 无项目持久化 | 迁移前保存当前输入、成品和最终手改；新项目格式能完整恢复内容与布局 |
| P1 | 两套核心模型、公共 picker 与个人库脱节 | 实现纯转换器和共享个人库读取接口，公共与私人来源可辨认；先接一个工具验证 |
| P1 | 增量切换和跨标签页写入冲突 | 幂等、配额失败、中途退出、重复迁移与来源变化全部有测试；无旧键损失 |
| P2 | 云端、身份与 SQL 全局题号冲突 | 浏览器方案稳定后另立设计；所有权服务端校验、命名空间与 SQL 迁移独立评审 |

建议后续顺序：备份及恢复验证 → v2 契约/纯适配器与导入预览 → 词库/题库统一浏览 → Maze 作为小范围问答适配试点 → Jeopardy/Tarsia → Bingo 项目持久化。用户真实数据未备份并验证前，不启用自动迁移。

测试矩阵至少覆盖：空库、中文与通用学科、缺字段、未知字段、重复/冲突 id、坏 JSON、孤儿索引、旧 v1 bundle、单文件 JSON、XLSX 重复题号/选项不足、A-D 答案歧义、Tarsia 旧 matchType/多语言、存储不可用/满额、跨标签页变化、重复运行不增副本、v2 导出重导入、回滚后 v1 原始值校验一致。功能测试在后续实现时运行；本次文档审查不宣称这些测试已通过。

## 8. 本次核验与仍待确认事项

已执行源码静态检查、Git 状态/分支/引用/reflog/stash 核对；未运行会写入测试结果的功能测试，也未对线上操作。已有 tracked diff 的文本 SHA-256 基线为 `130934A4D748493E136A8AC3E92EA39E6B809F6EAB8329FD4A971C30862B7FD2`（PowerShell Out-String UTF-8 表示，用相同方法复验）。此校验验证既有差异保持，不等价于工作区恢复包。

交付时再次比对 Git：应只新增 `docs/MY_LIBRARY_2_0_PLAN.md`，上述六项差异与未跟踪条目保持。尚未确认：各浏览器 origin 中的真实数据、备份文件、恢复结果、生产 SQL/Blob 快照、远端最新状态。后续第一项实际工作是完成备份闭环，而不是直接迁移。

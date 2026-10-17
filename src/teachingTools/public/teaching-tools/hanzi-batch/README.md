# 汉字动态笔顺批量生成器

纯前端静态工具，无需 npm install、构建、数据库或后端。依赖库及 GIF Worker 已随 vendor 文件夹提供，笔顺 JSON 按字从 jsDelivr 加载，需要联网。

## 运行

在本目录运行 `python -m http.server 8080`，打开 http://localhost:8080/ 。不要双击 index.html（file 协议不支持模块及 fetch）。也可将整个文件夹复制到任何静态 HTTP/HTTPS 主机。

在 TeacherTool 中启动现有网站后访问 `/teaching-tools/hanzi-batch`（自动跳转到静态页面）。已接入教学工具目录、中英文目录文案、sitemap，以及共享 site-theme.css 和导航页脚。工具主体仍为纯前端；独立部署时，网站导航、统计和共享主题的绝对路径可删除，工具自己的样式含主题颜色回退值，导出无需服务器接口。

Word Bank 使用网站现有的 `/api/wordlists/presets` 和 `/api/wordlists/presets/:id`，没有新增后端或数据库。独立静态部署时仍可手动输入和导出，Word Bank 需要连接这些现有接口。

## 使用

粘贴文字并生成，或从网站 Word Bank 选择词表并提取汉字。列表只保留 Unicode 汉字并按首次出现去重。点击字预览，复选框决定批量导出内容。无数据字显示为灰色，网络失败可点击生成重新尝试。

格线、配色、每笔时长和尺寸统一用于导出。点击笔画按钮显示截至该笔的累计字形。分解图当前笔固定红色，之前笔画沿用配色；横向分解图的格子边长为所选尺寸的三分之一。PDF 使用 A4 纵向、每行六格并自动分页。GIF 和 SVG 循环播放，末帧停留约 1.5 秒；播放器循环选项仅控制预览。

批量任务按字依次生成，GIF 编码在两个 Web Worker 中完成。可取消；取消不会下载部分 ZIP。1000 px GIF 与复杂字会占用较多内存，大列表建议使用 300/600 px 或分次导出。ZIP 文件序号对应原列表位置，取消勾选后保留原序号。

## Word Bank 词库

选择网站已发布的 Word Bank 词表，点击“提取汉字并加入”。仅从词条的 `zh` 字段提取汉字，忽略拼音、英文与备注，按首次出现去重并追加到已有列表。词库更新后可点击“刷新”；网络失败不会替换已有汉字，手动输入和导出仍可使用。

词表内容在网站原有 Word Bank 管理流程中维护。本工具不再加载示例 `data/lessons.json`。

## 文件及许可

`player.js`：Hanzi Writer 播放；`core.js`：数据、共用格线和静态渲染；`exporters/`：GIF/SVG/PNG/分解图及 PDF；`zip.js`：批量打包；`app.js`：界面状态。

Hanzi Writer 3.5.0 (MIT)、gif.js 0.2.0 (MIT)、JSZip 3.10.1 (MIT)、jsPDF 2.5.2 (MIT)。vendor 源码保留上游许可头；见 THIRD_PARTY_LICENSES.txt。

Stroke data from Make Me a Hanzi (Arphic Public License) via Hanzi Writer. 数据来源：https://github.com/chanind/hanzi-writer-data 。字形数据遵循 Arphic Public License，许可随本工具附带。

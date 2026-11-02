# 老师登录与私人云库：首个可测试实现

2026-11-01 验证：完整项目测试 119 项通过；新增接口测试 8 项以及独立 Chrome 的两个模拟账号流程通过。模拟身份和内存仓库不替代真实 Azure 登录与 SQL 集成测试，当前未执行线上迁移或部署。

现有 Azure 配置只读核对：Authentication 已启用、允许匿名访问公共页面；Microsoft 应用存在，Google 未配置。Microsoft 应用的 signInAudience 为 AzureADMyOrg，仅面向当前组织。不能据此向外部老师宣布登录已开放；应先单独设计外部老师登录接入，并验证管理员白名单与身份提供方隔离，避免直接扩大现有后台登录应用的范围。

本阶段增加独立页面 `/teaching-tools/teacher-library/teacher-library.html` 和 `/api/teacher-library` 接口。仅实现词表/题库云端快照；支付、自动订阅授权、云端活动项目和活动直接读取云库尚未接入。

## 产品方向更正：全站老师账号与我的资料

用户确认需要网站级账号，而非单独登录云库。当前页面已调整为“我的资料”工作台；公共导航脚本加载统一的登录/注册/账号入口，各工具共用同一登录会话。工作台可新建词表和普通问答题库：有云写权限时保存到账号，无权限时明确保存为本地草稿。此阶段尚无完整的云资料编辑/删除管理和自动付费授权。

邮箱注册、邮箱验证、密码找回与 Google 联合登录采用独立的托管客户身份流程。建议 Microsoft Entra External ID 的邮箱密码与 Google 联合登录，由 App Service 的自定义 OIDC 提供方 `teachers` 接入。应用不接收或自行保存密码，不放一个假密码表单代替真实认证。Google 联合登录配置完成后才显示 Google 入口；入口先到托管登录页选择 Google，而非冒充已经完成直接 Google 授权。

目前只完成接入代码和模拟测试。没有创建 External ID 租户、注册新的身份应用、生成客户端密钥或配置 Google OAuth，不能宣布真实邮箱/Google 注册已可用。

## 结构与权限

- 老师账号通过 `TEACHER_ACCOUNTS_ENABLED=true`、Azure 实例环境和 `AZURE_AUTH_ENABLED=true` 启用；云库另外要求 `LIBRARY_CLOUD_ENABLED=true`。登录状态不再依赖云库数据库可用性。
- 身份来自 Azure 注入的 principal id 与 provider，内部 owner_key 为 provider + NUL + principal id 的 SHA-256；不以邮箱或请求体里的 ownerId/paid 字段授权。
- 每个账号一个完整 v2 快照，复用既有 5 MB、100 集合、5,000 条目限制。新 SQL 表独立于公共词表、教材和题库，不加入 DAB 的公共匿名实体。
- 写入权限来自 `teacher_library_access.write_until`，在 SQL 事务内复查；账号没有权限或已到期，仍能读取/导出原有内容，不能写入。
- 通过 `If-Match` 数字版本和 SQL UPDLOCK/HOLDLOCK 事务处理并发，旧设备收到 409，不覆盖新版本。单版本快照没有历史回收站，上线试用前必须验证数据库备份恢复，替换前页面要求下载备份并确认。
- 保存请求要求固定站点 Origin、自定义请求头和专用 JSON Content-Type；接口无 CORS 开放，响应不缓存。专用 Content-Type 避开现有 app 默认 100 KB JSON 解析限制，无需改动正在编辑的 app.js。

## 生产或预发布启用步骤（本次不自动执行）

1. 先备份 SQL 数据库，在预发布库执行 `database/add-teacher-private-library.sql`。验证应用身份仅有这两张表所需 SELECT/INSERT/UPDATE 权限，不为 DAB 匿名角色增加权限；已有 DAB 配置保持不变。
2. 保持现有管理员 `aad` 提供方及其单组织应用不变。创建独立的客户身份租户/应用及注册登录用户流程，启用邮箱密码、邮箱验证和自助密码重置；在该流程配置 Google 联合登录。用 App Service 自定义 OIDC 名称 `teachers` 接入，回调为 `https://clsteachingtools.com/.auth/login/teachers/callback`。保留公共工具匿名访问，检查正式域名与 Azure 域名回调。新增租户、OAuth 应用、密钥或修改认证配置前须取得明确授权。
3. 配置 `SITE_URL=https://clsteachingtools.com`、现有 `SQL_CONNECTION_STRING`、`AZURE_AUTH_ENABLED=true`、`TEACHER_ACCOUNT_PROVIDER=teachers`。真实身份流程验收后设置 `TEACHER_ACCOUNTS_ENABLED=true`，Google 实测通过才设置 `TEACHER_GOOGLE_ENABLED=true`。云库迁移和隔离验证通过后再启用 `LIBRARY_CLOUD_ENABLED=true`。不在日志、Git 或聊天中输出连接字符串或客户端密钥。
4. 由两位老师分别完成真实注册与登录。管理员通过受控的当前用户会话接口取得 owner_key，核实本人身份后，用参数化 SQL 为试用账号设置明确到期时间：向 dbo.teacher_library_access 写入对应 owner_key 和 write_until。此操作代表试用授权，不是已付费证明；浏览器传来的 paid 或 ownerId 不参与授权。
5. 用账号 A 保存材料，账号 B 验证看不到 A；在另一个设备读取 A，再制造版本冲突。验证撤销/到期后仍能读取导出，但写入被拒绝；数据库和登录平台实际连通检查通过后再开放生产入口。

登录身份信任边界依据 Microsoft 官方说明：外部请求不能自行设置 Easy Auth 身份头，由 App Service 注入。若以后迁移到其他主机，不能简单设置同名环境变量或信任这些头，必须另行接入可验证的认证机制。

- https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities
- https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-customize-sign-in-out
- https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers
- https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-provider-openid-connect

## 当前页面流程

登录 → 读取自己的云库 → 预览本浏览器材料 → 确认替换云端快照 → 服务器检查权限和版本 → 保存成功。也可下载云库备份，或预览后将云库合并到当前浏览器；本地重复跳过、冲突保留双方，再返回 Maze 使用。

页面不自动上传、不自动覆盖本地库，不把不同登录账号的云库写入共享本地缓存。数据归属与写入权限均由服务器复核，界面按钮仅用于说明。

## 不能声称已完成的事项

自动测试使用两个模拟身份与内存仓库验证路由边界，不等于实际完成两位老师的 Azure 登录或真实 SQL 恢复。真实身份提供方配置、SQL 迁移、试用授权、备份恢复与生产发布必须分别记录结果。付款、续费、退款和 webhook 幂等处理是下一阶段。

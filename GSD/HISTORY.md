# History: WeChat CLI Bridge Development

## 2026-03-29

### Task: M003 S05 Release Gate And Real Inbox UAT
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已完成真实 SMTP 收件箱 UAT、命令兼容性补强和 `v1.4.0` 版本收口
- **Scope**: SMTP UAT、bridge mail UX、版本口径、README、GSD 根文档、milestone 文档

### Subtask: 文档与模板同步
- **Status**: Complete
- **Files**:
  - `README.md`
  - `README_CN.md`
  - `templates/config.example.json`
  - `GSD/milestones/M003-v1.4-mail-channel/S05-PLAN.md`
  - `GSD/milestones/M003-v1.4-mail-channel/S05-UAT.md`
  - `GSD/milestones/M003-v1.4-mail-channel/RELEASE-CHECKLIST.md`
  - `GSD/milestones/M003-v1.4-mail-channel/README.md`
  - `GSD/milestones/M003-v1.4-mail-channel/ROADMAP.md`
- **Changes**:
  - 补齐 `M003 S05` 的 plan、UAT 与 release checklist
  - 为 README / README_CN 补充 SMTP 配置说明
  - 将 `templates/config.example.json` 同步到当前 `media` / `mail` 结构
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 118 tests passed

### Subtask: SMTP UAT 准备审计
- **Status**: Complete
- **Environment**:
  - 脱敏检查 `/tmp/wcb-uat-home/config.json`
  - 脱敏检查 `/tmp/wechat-cli-bridge-verify/config.json`
  - 脱敏检查 `/mnt/c/Users/Administrator/.wechat-cli-bridge/config.json`
- **Observed Result**:
  - 当前三处配置都没有启用且完整的 SMTP 凭据
  - 真实收件箱 UAT 仍待用户提供测试账号

### Subtask: 真实 SMTP 收件箱 UAT
- **Status**: Complete
- **Environment**:
  - 本地 UAT home: `/tmp/wcb-uat-home`
  - 发信链路: Gmail SMTP
  - 收件箱: QQ Mail
- **Observed Result**:
  - `/mail` → 收到纯文本邮件
  - `/mailhtml` → 收到 HTML 邮件
  - `/mailfile` → 收到附件邮件
  - direct SMTP probe 也已成功收到 HTML-only 与附件邮件

### Subtask: mail UX 兼容性补强
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 为 `/mailhtml` 增加 plain-text fallback，避免部分收件端只吃 `text/html` 时表现不稳
  - 为 `/mailfile` 的附件准备失败补充解析后的绝对路径
- **Verification**:
  - `npm test -- --runInBand --ci src/bridge/core.test.ts` → passed
  - `npm run build` → passed

### Subtask: 版本与发布口径收口
- **Status**: Complete
- **Files**:
  - `package.json`
  - `package-lock.json`
  - `src/index.ts`
  - `src/bridge/ilink-client.ts`
  - `README.md`
  - `README_CN.md`
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/sessions/SESSION-2026-03-29.md`
  - `GSD/milestones/M003-v1.4-mail-channel/*`
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 120 tests passed
- **Result**: 版本号、banner、channel version、README 和 GSD 已统一到 `v1.4.0 / release ready`

### Subtask: GSD 根文档纠偏
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-29.md`
- **Result**: 根级状态已从“只写了 S05”纠正为“文档收口已完成，但 inbox UAT 仍待凭据”

### Task: M003 S02/S03/S04 Mail Sending And WeChat UX
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 邮件通道已完成 SMTP sender、附件发送与微信命令面，当前只剩真实邮箱 UAT
- **Scope**: nodemailer、smtp sender、bridge command UX、GSD 文档

### Subtask: SMTP sender 实施
- **Status**: Complete
- **Files**:
  - `src/mail/smtp-sender.ts`
  - `src/mail/smtp-sender.test.ts`
  - `src/mail/index.ts`
  - `package.json`
- **Changes**:
  - 安装 `nodemailer`
  - 新增 SMTP sender
  - 新增 transport options builder 与 sender tests
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/mail/contract.test.ts src/mail/config.test.ts src/mail/smtp-sender.test.ts --runInBand --ci` → 14 tests passed

### Subtask: 邮件命令面实施
- **Status**: Complete
- **Files**:
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/commands/handler.ts`
  - `src/commands/handler.test.ts`
- **Changes**:
  - 新增 `/mail`
  - 新增 `/mailhtml`
  - 新增 `/mailfile`
  - 接入收件人校验、附件 staging 与错误反馈
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/bridge/core.test.ts src/commands/handler.test.ts --runInBand --ci` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 118 tests passed

### Subtask: M003 文档收口
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-29.md`
  - `GSD/milestones/M003-v1.4-mail-channel/*`
- **Result**: M003 当前状态、切片顺序和下一步已同步到 GSD

## 2026-03-28

### Task: M003 S01 Mail Contract & Provider Decision
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已完成邮件通道的 contract/config 底座，当前里程碑切换到 `M003-v1.4-mail-channel`
- **Scope**: milestone 文档、mail contract、SMTP config normalization、测试、GSD 收口

### Subtask: M003 规划落盘
- **Status**: Complete
- **Files**:
  - `GSD/milestones/M003-v1.4-mail-channel/ROADMAP.md`
  - `GSD/milestones/M003-v1.4-mail-channel/CONTEXT.md`
  - `GSD/milestones/M003-v1.4-mail-channel/RESEARCH.md`
  - `GSD/milestones/M003-v1.4-mail-channel/S01-PLAN.md`
  - `GSD/milestones/M003-v1.4-mail-channel/S01-UAT.md`
  - `GSD/milestones/M003-v1.4-mail-channel/README.md`
- **Result**: `M003` 已从 backlog candidate 升级为 active milestone

### Subtask: 邮件契约与配置底座
- **Status**: Complete
- **Files**:
  - `src/mail/contract.ts`
  - `src/mail/config.ts`
  - `src/mail/index.ts`
  - `src/mail/contract.test.ts`
  - `src/mail/config.test.ts`
- **Changes**:
  - 新增邮件地址、收件人、正文、附件与草稿契约
  - 新增 SMTP config normalization、summary 与 readiness helper
  - 明确 `v1.4` 首版 provider 为 `SMTP`
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/mail/contract.test.ts src/mail/config.test.ts --runInBand --ci` → 10 tests passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 110 tests passed

### Task: M002 S04 UX, Safety & Failure Recovery
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: rich delivery 命令面已补齐图片/文件双入口，且已具备默认安全限制与结构化失败反馈
- **Scope**: command UX、媒体发送结果契约、本地安全限制、自动化验证、GSD 回写

### Subtask: 命令面收口
- **Status**: Complete
- **Files**:
  - `src/commands/handler.ts`
  - `src/commands/handler.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 新增 `/sendimage <path>`
  - 为命令解析增加引号参数支持，允许带空格路径
  - 将 `/sendfile` 明确为“按附件发送”
  - 在 bridge 侧统一图片/文件发送命令处理与用户反馈
- **Verification**:
  - `npx jest src/commands/handler.test.ts src/bridge/core.test.ts --runInBand --ci` → passed

### Subtask: 安全限制与失败分类
- **Status**: Complete
- **Files**:
  - `src/media/staging.ts`
  - `src/media/staging.test.ts`
  - `src/bridge/ilink-client.ts`
  - `src/bridge/ilink-client.media.test.ts`
- **Changes**:
  - 为本地媒体发送增加默认大小限制（图片 10 MB / 文件 25 MB）
  - 默认阻止 `.ssh`、`.git`、`.env` 等敏感路径
  - 限制 `/sendimage` 仅接受受支持图片格式
  - 将 `sendLocalMedia()` 从布尔返回升级为结构化结果，区分 staging / upload / send 失败
  - 允许将图片按普通文件附件发送，避免命令语义混乱
- **Verification**:
  - `npx jest src/media/staging.test.ts src/bridge/ilink-client.media.test.ts --runInBand --ci` → passed

### Subtask: M002 当前总验收
- **Status**: Complete
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 91 tests passed
- **Result**: M002 已完成 S04，当前只剩 S05 文档/UAT/发布门与真实设备确认

### Task: M002 S05 Docs, UAT & Release Gate
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: rich delivery 的版本口径、README、UAT 和 release gate 已收口到 `v1.3.0`
- **Scope**: version sync、README、release checklist、GSD 文档

### Subtask: 版本与 README 收口
- **Status**: Complete
- **Files**:
  - `package.json`
  - `package-lock.json`
  - `src/index.ts`
  - `src/bridge/ilink-client.ts`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 将版本号、startup banner、channel version 统一到 `v1.3.0`
  - 将 README / README_CN 同步到 rich delivery 当前命令面、限制和测试基线
  - 将 README 中“文件下发未实现”的旧口径移除
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed

### Subtask: 发布门文档
- **Status**: Complete
- **Files**:
  - `GSD/milestones/M002-v1.3-rich-delivery/S05-PLAN.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S05-UAT.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/RELEASE-CHECKLIST.md`
- **Result**: M002 已具备显式 UAT 和 release gate 文档，且将真实设备 UAT 保留为 release blocker

### Subtask: 仓库地址占位符清理
- **Status**: Complete
- **Files**:
  - `package.json`
  - `README.md`
  - `GSD/projects/wechat-cli-bridge.md`
  - `GSD/STATE.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S05-UAT.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/RELEASE-CHECKLIST.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/RELEASE-CHECKLIST.md`
- **Result**: 已将仓库地址统一替换为 `https://github.com/moyetian/wechat-cli-bridge`

### Task: M002 真实设备 UAT 收口
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: rich delivery 已在真实微信设备上完成图片/文件 happy path 与 failure path 验证，M002 达到发布就绪状态
- **Scope**: 真实 bridge 启动、协议修正、设备验证、GSD 收口

### Subtask: 真实设备 happy path 验证
- **Status**: Complete
- **Environment**:
  - 复用 `openclaw-weixin` 登录凭证
  - 使用临时 bridge home `/tmp/wcb-uat-home`
  - 使用设备 UAT 素材 `/tmp/wcb-uat-assets/uat-image.png` 与 `/tmp/wcb-uat-assets/uat-file.txt`
- **Observed Result**:
  - `/sendimage` 图片可正常打开
  - `/sendfile` 文件可正常下载打开

### Subtask: 协议层最终修正
- **Status**: Complete
- **Files**:
  - `src/bridge/ilink-client.ts`
  - `src/bridge/ilink-client.media.test.ts`
- **Changes**:
  - 为 CDN 上传增加重试与更详细错误展开
  - 将 `aes_key` 编码改为与官方插件一致的 hex-string-base64 格式
  - 增加 CDN 重试与 `aes_key` 编码断言测试
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/bridge/ilink-client.media.test.ts --runInBand --ci` → 5 tests passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 92 tests passed

### Subtask: 真实设备 failure path 验证
- **Status**: Complete
- **Observed Result**:
  - `/sendfile /tmp/wcb-uat-assets/missing.txt` → 路径不存在
  - `/sendimage /tmp/wcb-uat-assets/uat-file.txt` → 图片类型不支持
  - `/sendfile /tmp/wcb-uat-assets/.env` → 敏感路径被拒绝
  - `/sendfile /tmp/wcb-uat-assets/too-large.bin` → 超过大小限制
- **Result**: failure path 文案已在真实微信会话中验证通过

### Task: 发布后易用性补强 - 自然语言直发文件
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: bridge 现在可以直接理解“把桌面上的 report.pdf 发给我”这类请求，不必强制用户使用 `/sendfile`
- **Scope**: 自然语言意图识别、桌面文件解析、模糊请求澄清、测试

### Subtask: 自然语言媒体意图解析
- **Status**: Complete
- **Files**:
  - `src/media/natural-send.ts`
  - `src/media/natural-send.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/commands/handler.ts`
- **Changes**:
  - 新增自然语言“直接发文件/图片”意图识别
  - 支持显式路径和桌面文件名匹配
  - 对模糊请求返回澄清提示，不盲猜文件
  - 在 bridge 层直接执行发送，不走 Agent
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 100 tests passed

### Subtask: 自然语言桌面发送真实验证
- **Status**: Complete
- **Observed Result**:
  - `把桌面上的中国高铁运营路线图发给我` → 正确命中桌面图片匹配，但因 19 MB 超过 10 MB 图片限制而被拒绝
  - `把桌面上的 Weixin.exe.lnk 发给我` → 成功发送并在微信端正常收到
- **Result**: 自然语言桌面文件匹配与直发链路已在真实微信会话中验证通过

### Subtask: 媒体大小限制配置化
- **Status**: Complete
- **Files**:
  - `src/types/index.ts`
  - `src/index.ts`
  - `src/setup.ts`
  - `src/bridge/core.ts`
  - `src/bridge/ilink-client.ts`
  - `src/commands/handler.ts`
  - `README.md`
  - `README_CN.md`
- **Changes**:
  - 将图片/文件大小限制改为 `config.json` 可调
  - 新增 `media.maxImageSizeMB` / `media.maxFileSizeMB`
  - `/help` 现在会显示当前配置下的媒体限制
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 100 tests passed

### Subtask: GSD 文档回写
- **Status**: Complete
- **Files**:
  - `GSD/STATE.md`
  - `GSD/ROADMAP.md`
  - `GSD/HISTORY.md`
  - `GSD/sessions/SESSION-2026-03-28.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/ROADMAP.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S04-PLAN.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/S04-UAT.md`
- **Result**: 今天的 S04 实施、验证和下一步已按 `gsd-2` 口径回写

## 2026-03-27

### Task: M002 Rich Delivery 里程碑规划
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已将下一主里程碑切换为 `M002-v1.3-rich-delivery`
- **Scope**: 微信文件下发规划、邮件里程碑切分、GSD 收口

### Subtask: rich delivery 缺口审计
- **Status**: Complete
- **Files**: `src/bridge/ilink-client.ts`, `src/types/index.ts`
- **Findings**:
  - 枚举层虽有 `IMAGE` / `FILE`
  - inbound/outbound 实现仍只支持 `TEXT`
  - 当前没有附件 staging、上传和发送链路
- **Key Insight**: 这不是 bug，而是未实现能力

### Subtask: 里程碑切换
- **Status**: Complete
- **Files**:
  - `GSD/ROADMAP.md`
  - `GSD/STATE.md`
  - `GSD/milestones/M002-v1.3-rich-delivery/*`
  - `GSD/milestones/M003-v1.4-mail-channel/README.md`
- **Changes**:
  - 将 M001 标记为实现完成
  - 新增 M002 roadmap/context/research/S01 文档
  - 将邮件能力切分为独立的 M003 候选里程碑
- **Result**: 后续执行顺序清晰，不会把微信文件下发与邮件通道混做一团

### Task: M002 S01/S02 基础能力实现
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: media contract 与本地附件 staging 管线已落地
- **Scope**: contract、attachmentsDir、staging、测试

### Subtask: Media Contract
- **Status**: Complete
- **Files**:
  - `src/media/contract.ts`
  - `src/media/contract.test.ts`
  - `src/media/index.ts`
- **Changes**:
  - 定义 `MediaKind`、`MediaSendIntent`、`MediaLifecycleStatus`
  - 定义 `MediaAttachmentDraft`
  - 增加图片/文件类型推断、默认发送意图和摘要函数
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/media/contract.test.ts --runInBand --ci` → 7 tests passed

### Subtask: Attachment Staging Pipeline
- **Status**: Complete
- **Files**:
  - `src/media/staging.ts`
  - `src/media/staging.test.ts`
  - `src/utils/paths.ts`
  - `src/utils/storage.ts`
  - `src/utils/paths.test.ts`
  - `src/utils/storage.test.ts`
- **Changes**:
  - 新增 `attachmentsDir`
  - 实现本地文件存在性检查、普通文件校验、mime 推断、大小限制与 staging copy
  - 以 SHA-256 文件名进行 staging
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/media/staging.test.ts src/utils/paths.test.ts src/utils/storage.test.ts --runInBand --ci` → 24 tests passed

### Subtask: M002 阶段性总验收
- **Status**: Complete
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 80 tests passed
- **Key Insight**: 当前的真实阻塞已经从“本地文件如何准备”转移到“iLink rich media 如何真正发出去”

### Task: M002 S03 WeChat 文件发送链路实现
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 已基于官方插件实现落地首版本地文件/图片发送链路
- **Scope**: ClawBot 安装、协议移植、bridge 命令入口、自动化测试

### Subtask: 官方能力探测
- **Status**: Complete
- **Files**:
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/README.md`
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/src/messaging/send-media.ts`
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/src/messaging/send.ts`
  - `/home/moyetian/.openclaw/extensions/openclaw-weixin/src/cdn/upload.ts`
- **Findings**:
  - 官方链路为 `getuploadurl -> AES-128-ECB -> CDN upload -> sendmessage`
  - `IMAGE` 和 `FILE` item 都有明确结构
  - ClawBot 插件支持本地路径和远程 URL 媒体发送
- **Result**: 先前关于 rich media payload 的核心未知点已基本消除

### Subtask: ClawBot 环境接入
- **Status**: Complete
- **Commands**:
  - `npm install -g openclaw`
  - `npx -y @tencent-weixin/openclaw-weixin-cli@latest install`
  - `openclaw channels login --channel openclaw-weixin`
- **Result**: 微信扫码连接成功，`openclaw-weixin` 插件已就绪

### Subtask: 协议层移植
- **Status**: Complete
- **Files**:
  - `src/bridge/ilink-client.ts`
  - `src/bridge/ilink-client.media.test.ts`
- **Changes**:
  - 新增 `getuploadurl` 请求
  - 新增 CDN AES-128-ECB 上传
  - 新增 `sendLocalMedia()` 和 `IMAGE` / `FILE` item 发送
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/bridge/ilink-client.media.test.ts --runInBand --ci` → 2 tests passed

### Subtask: Bridge 命令入口
- **Status**: Complete
- **Files**:
  - `src/commands/handler.ts`
  - `src/commands/handler.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 新增 `/sendfile <path>`
  - 支持从当前 `workingDir` 解析相对路径
  - 成功发送后写入决策历史
- **Verification**:
  - `npm run build` → passed
  - `npx jest src/commands/handler.test.ts src/bridge/core.test.ts src/bridge/ilink-client.media.test.ts --runInBand --ci` → 30 tests passed

### Subtask: M002 当前总验收
- **Status**: Complete
- **Verification**:
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 84 tests passed
- **Result**: M002 已进入“真实设备 UAT + UX 收口”阶段

### Subtask: 真实设备 sendfile 首轮验证
- **Status**: In Progress
- **Environment**:
  - 已安装 `openclaw`
  - 已安装并登录 `openclaw-weixin`
  - 已复用微信凭证启动本项目 bridge
- **Observed Result**:
  - 微信端成功收到 `/sendfile /mnt/f/wechat-cli-bridge/README.md` 触发的文件消息
  - 但手机端当前无法下载查看文件
- **Follow-up**:
  - 已将 `ILinkClient` 的 `base_info`、`X-WECHAT-UIN`、`from_user_id` 对齐到官方插件实现
  - 已完成第二轮重发，等待下次人工确认下载效果

### Task: M001 升级里程碑规划
- **Status**: Complete
- **Agent**: Human + Codex
- **Result**: 基于 `gsd-2` 模式重新组织下一里程碑，锁定 5 个 slices
- **Scope**: 规划、验证、文档重构

### Subtask: 现状审计
- **Status**: Complete
- **Files**: `core.ts`, `cli-adapter.ts`, `types/index.ts`, `context/manager.ts`, `logger.ts`, `storage.ts`
- **Findings**:
  - 权限模式仅停留在 session 状态层，未接入执行层
  - CLI 默认参数仍带危险 bypass 标志
  - `logger/storage` 模块存在导入时写 home 目录的副作用
  - README/GSD 之间出现状态漂移
- **Key Insight**: 下一阶段应先解决“可验证的底座”和“真实权限协议”，再扩展功能面

### Subtask: 重新定义里程碑
- **Status**: Complete
- **Files**: `GSD/ROADMAP.md`, `GSD/STATE.md`
- **Changes**:
  - 新增当前里程碑 `M001 / v1.2 Permission-Control Hardening`
  - 引入 5 个 slices 顺序：S01 → S05
  - 将验证门前置到每个 slice，而不是只在版本末尾补检查
- **Result**: 规划从“功能清单”升级为“带依赖和验收口径的执行计划”

### Subtask: 里程碑产物落盘
- **Status**: Complete
- **Files**:
  - `GSD/milestones/M001-v1.2-permission-control-hardening/ROADMAP.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/CONTEXT.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/RESEARCH.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S01-PLAN.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S01-UAT.md`
- **Result**: 形成 milestone 级路线图、上下文、研究记录和首个 slice 的执行计划

### Subtask: S01 Runtime Base & Testability 实施
- **Status**: Complete
- **Files**:
  - `src/utils/paths.ts`
  - `src/utils/logger.ts`
  - `src/utils/storage.ts`
  - `src/index.ts`
  - `src/setup.ts`
  - `bin/daemon.js`
  - `src/utils/bootstrap.test.ts`
  - `src/utils/paths.test.ts`
  - `src/utils/storage.test.ts`
- **Changes**:
  - 新增统一 bridge path 解析层，支持 `WECHAT_CLI_BRIDGE_HOME`
  - 将 logger 改为显式初始化，并在未初始化时回退到 console logger
  - 将 storage 改为 lazy singleton，移除模块导入时目录创建副作用
  - 启动入口、setup、daemon 统一采用新的路径约定
  - 为导入无副作用和路径推导增加测试
- **Result**: `build/lint/test` 自动化验证通过，S01 的工程底座目标达成

### Subtask: S02 Permission Contract 实施
- **Status**: Complete
- **Files**:
  - `src/permissions/contract.ts`
  - `src/types/index.ts`
  - `src/commands/handler.ts`
  - `src/context/manager.ts`
  - `src/bridge/core.ts`
  - `src/context/manager.test.ts`
  - `src/commands/handler.test.ts`
- **Changes**:
  - 新增统一 permission contract 常量与描述
  - 将审批请求纳入 session state 持久化
  - 补齐 `/pending`、`/approve`、`/deny` 命令
  - 修复 `ContextManager.load()` 默认值覆盖已保存 session 的问题
  - 为审批请求 round-trip、歧义解析、默认值一致性补测试
- **Key Insight**: S02 解决的是“权限语义不一致”和“命令面缺失”，不是执行前门控本身
- **Result**: 权限契约成为单一事实源，S03 可以在此基础上实现状态机

### Subtask: S03 Approval State Machine 实施
- **Status**: Complete
- **Files**:
  - `src/permissions/policy.ts`
  - `src/permissions/policy.test.ts`
  - `src/types/index.ts`
  - `src/context/manager.ts`
  - `src/context/manager.test.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
  - `src/bridge/ilink-client.ts`
- **Changes**:
  - 新增 bridge 级任务分类策略与审批触发规则
  - 将待执行任务持久化到 session state，并与 approval request 关联
  - 在加载 session 时自动处理过期审批
  - 在 bridge 中实现“申请审批 -> 等待 -> 批准后恢复执行”
  - 新增 `y/yes/n/no` 快捷审批语义
- **Key Insight**: S03 解决的是“审批流是否真实存在”，不是“各 CLI 如何映射权限 flags”
- **Result**: bridge 层审批闭环已形成，S04 可以专注于 agent 参数和模式细化

### Subtask: S04 Agent Enforcement 实施
- **Status**: Complete
- **Files**:
  - `src/agents/cli-permissions.ts`
  - `src/agents/cli-permissions.test.ts`
  - `src/agents/cli-adapter.ts`
  - `src/agents/cli-adapter.test.ts`
  - `src/agents/index.ts`
  - `src/types/index.ts`
  - `src/bridge/core.ts`
  - `src/bridge/core.test.ts`
- **Changes**:
  - 新增 CLI permission profile 与 mode-to-args 构造器
  - 将默认 agent 配置从静态危险参数改为受 permission mode 驱动
  - 在 `CLIAdapter` 中接入 profile 解析、旧参数去重和 bridge-approved 自动升级
  - 增补已批准任务在 mode 变更后仍可恢复执行的保护逻辑
  - 为参数构造和 adapter spawn 参数新增单元测试
- **Key Insight**: S04 解决的是“bridge 审批语义如何真正下沉到 CLI 执行参数”，而不是再造一层审批
- **Result**: `interactive / acceptEdits / auto / plan` 在 bridge 与 CLI 执行层已基本对齐

### Subtask: S05 Release Gate 实施
- **Status**: Complete
- **Files**:
  - `.github/workflows/ci.yml`
  - `README.md`
  - `README_CN.md`
  - `package.json`
  - `src/index.ts`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/RELEASE-CHECKLIST.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S05-PLAN.md`
  - `GSD/milestones/M001-v1.2-permission-control-hardening/S05-UAT.md`
- **Changes**:
  - CI 扩展为 Ubuntu / Windows x Node 18 / 20，并纳入 `build/lint/test`
  - README 与 README_CN 同步到当前权限协议、命令面、已知限制和验证方式
  - 版本号和启动 banner 升级到 `v1.2.0`
  - 增加 milestone release checklist
- **Result**: M001 进入“实现完成，等待手工 UAT/发布”的状态

### Subtask: 现实验证复核
- **Status**: Complete
- **Verification**:
  - `node -e "yaml.parse(...)"` → workflow ok
  - `npm run build` → passed
  - `npm run lint` → passed
  - `npm test -- --runInBand --ci` → 68 tests passed
- **Result**: S01/S02/S03/S04/S05 当前自动化验证全部通过

### Subtask: 用户反馈问题入账
- **Status**: Complete
- **Issues**:
  - 电脑文件无法通过 ClawBot 下发到手机微信端
  - 无法通过邮件发送信息或文件
- **Decision**: 这两个问题不属于 S01 范围，先记录为后续能力缺口，待 S02 以后评估是否纳入新里程碑

---

## 2026-03-25

### Task: 稳定性和代码质量优化
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: v1.1 稳定性优化完成，项目更健壮
- **Scope**: 连接重连、进程管理、测试框架、安全防护

### Subtask: 指数退避重连机制
- **Status**: Complete
- **Files**: `ilink-client.ts`
- **Changes**:
  - 添加 `INITIAL_RETRY_DELAY` (1s) 和 `MAX_RETRY_DELAY` (60s) 常量
  - 实现 `retryDelay` 和 `consecutiveErrors` 追踪
  - 成功时重置延迟，失败时指数增长
- **Key Insight**: 避免服务器压力过大，智能退避

### Subtask: 心跳检测机制
- **Status**: Complete
- **Files**: `ilink-client.ts`
- **Changes**:
  - 30s 心跳间隔 (`HEARTBEAT_INTERVAL`)
  - `startHeartbeat()` / `stopHeartbeat()` 生命周期管理
  - `isHealthy()` 健康状态判断
  - `getStats()` 连接统计信息
- **Key Insight**: 主动监控连接健康，及时发现问题

### Subtask: 任务超时状态清理
- **Status**: Complete
- **Files**: `cli-adapter.ts`
- **Changes**:
  - 添加 `isTimedOut` 标志防止重复处理
  - 超时后先 SIGTERM，5s 后 SIGKILL
  - 确保 `activeProcess = null` 状态清理
- **Key Insight**: 双阶段终止避免僵尸进程

### Subtask: ESLint 配置
- **Status**: Complete
- **Files**: `.eslintrc.json`, `package.json`
- **Changes**:
  - TypeScript ESLint 规则
  - 测试文件排除配置
  - 新增 `npm run lint` 和 `npm run lint:fix` 脚本
- **Result**: 代码风格一致性保障

### Subtask: 单元测试框架
- **Status**: Complete
- **Files**: `jest.config.js`, `handler.test.ts`, `storage.test.ts`
- **Changes**:
  - Jest + ts-jest 配置
  - 33 个测试用例
  - 覆盖命令解析和存储模块
- **Result**: `npm test` 全部通过

### Subtask: 命令注入防护
- **Status**: Complete
- **Files**: `cli-adapter.ts`
- **Changes**:
  - `DANGEROUS_PATTERNS` 危险模式检测
  - `sanitizeInput()` 输入消毒函数
  - Windows/Unix 双平台转义
  - 警告日志输出
- **Key Insight**: 防御性编程，主动检测风险

---

## 2026-03-24

### Task: 修复消息输出丢失问题
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: CLI 输出完整发送，不再只发送摘要
- **Root Cause**: `handleTask` 中只使用了 `result.summary`，忽略了 `result.output`
- **Solution**: 将 `result.output` 包含在响应中

### Task: 长消息分片发送
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 长消息自动分片发送，每片带序号标记
- **Files**: `ilink-client.ts` 新增 `splitMessage` 和 `sendLongMessage`

### Task: iFlow CLI 参数传递修复
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 单行和多行任务都能正确执行
- **Root Cause**: 多行任务作为位置参数传递时 Windows shell 转义失败
- **Solution**: 单行任务用位置参数 `iflow "task"`，多行任务用 `-p` + stdin

### Task: 上下文格式修复
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 新会话不传空上下文，避免误导
- **Root Cause**: `[上下文摘要]` 标记被 iFlow 当作任务内容
- **Solution**: 改用清晰分隔符，新会话返回空字符串

### Task: CLI 权限参数同步
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 所有 CLI Agent 自动跳过权限确认
- **Solution**: 各 CLI 配置对应参数 (iFlow/Gemini: -y, Claude: --dangerously-skip-permissions, Codex: --dangerously-bypass-all)

### Task: 超时时间增加
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 复杂任务有更充足的执行时间
- **Solution**: 从 5 分钟增加到 10 分钟

### Task: GitHub 发布准备
- **Status**: Complete
- **Agent**: Human + iFlow
- **Result**: 项目打包并完善文档
- **Files**: 完善 README.md 和 README_CN.md

---

## 2026-03-23

### Task: 项目架构设计
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 确定了三层架构：Bridge Core + Context Manager + Agent Adapters

### Task: iLink API 客户端实现
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 实现了正确的 API 格式、认证方式、消息收发
- **Key Insight**: iLink API 是独立协议，不依赖 OpenClaw

### Task: CLI Agent 适配器
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 支持 iFlow、Claude、Codex、Gemini 四个 CLI
- **Key Insight**: Windows 需要 shell: true 才能找到 npm 全局命令

### Task: 上下文管理器
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 实现了 GSD 风格的状态追踪
- **Files**: STATE.md, HISTORY.md, CONTEXT.md

### Task: 二维码登录流程
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 扫码获取 token、accountId、userId

### Task: Windows 兼容性修复
- **Status**: Complete
- **Agent**: Human + Claude
- **Result**: 解决了命令执行、stdin 传递问题

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-25 | 指数退避重连 1s→60s | 避免暴力重连，保护服务器 |
| 2026-03-25 | 心跳间隔 30s | 平衡监控频率和资源消耗 |
| 2026-03-25 | SIGTERM + SIGKILL 双阶段终止 | 给进程清理机会，强制兜底 |
| 2026-03-25 | 危险模式检测而非完全禁止 | 灵活性与安全性平衡 |
| 2026-03-25 | GSD 状态追踪更新 | 保持项目上下文连续性 |
| 2026-03-24 | iFlow 使用 `-y` 参数 | --yolo 模式自动接受操作 |
| 2026-03-24 | 多行任务用 `-p` + stdin | 避免 Windows shell 转义问题 |
| 2026-03-24 | 新会话不传空上下文 | 避免误导 Agent |
| 2026-03-24 | 超时设为 10 分钟 | 支持复杂任务执行 |
| 2026-03-23 | 使用 TypeScript | 类型安全 |
| 2026-03-23 | 移除 sessionResume | 改用上下文注入 |
| 2026-03-23 | Windows 使用 shell: true | npm 命令查找 |

---

**Last Updated**: 2026-03-27

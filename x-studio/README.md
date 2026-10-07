# X Studio · AI 创作工作台

以 X 为主的私人创作工作区。当前版本包含 AIHOT 雷达、X 与抖音视频线索、选题与证据、单帖/线程编辑、短视频制作方案、创作指令、业务与声音设置、审核、人工发布记录与导出。

## 需求与范围（2026-10-03）

- Problem Statement：AI 线索、自己的实践、稿件和业务入口分散，缺少能持续使用的创作流程。
- Proposed Solution：以可保存的内容任务为核心，雷达选题→事实核验→脚本/分镜→自动剪辑决策表→人工审核→X 发布→手动结果记录。业务与作者声音自动进入创作指令。
- Technical Constraints：Windows UTF-8；React/Vinext、Cloudflare Worker、D1；私人 Sites 访问策略。草稿和设置由数据库保存，冲突返回 409，不覆盖另一窗口修改。第一版模型执行通过当前 Codex 项目衔接，网站不假装已运行 Skill。
- Non-goals：情感风险工具、批量搬运、自动互赞/私信、后台定时发布、自动花费接口额度、全站爆款覆盖、未经授权下载或复用抖音/X原视频、订单系统。
- Success Criteria：真实 AIHOT 数据有出处；选题可编辑保存并在刷新后恢复；业务和声音设置可保存；审核必须完成检查；人工发布记录需 X 原帖链接；没有配置的连接显示待接入；窄屏布局可用。

## 运行

使用 Node 22.13+。标准命令：`npm run install:ci`、`npm run dev`、`npm run build`。

本机 npm CMD 包装器存在路径异常时，可通过 Node 直接调用 npm-cli.js；依赖已按锁文件校验。开发预览地址由服务输出。`.openai/hosting.json` 仅保存平台标识和 D1 声明。

本地 D1：生成迁移 `npm run db:generate`，构建后按顺序执行 `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sweet_captain_stacy.sql`。不要重复执行已应用迁移。

## X 接入

1. 在 https://developer.x.com/ 创建开发者应用，开启 OAuth 2.0。适用于 Web 应用的 Client ID / Client Secret 保存在服务端，不能放浏览器代码。
2. 回调 URL 精确配置为 `https://x-studio-ai-sun.sunmillionai.chatgpt.site/api/x/callback`。
3. 在 Sites 的运行环境里设置：`APP_ORIGIN` 为本站来源；`X_CLIENT_ID`；保密客户端的 `X_CLIENT_SECRET`；随机且足够长的 `X_TOKEN_SECRET`（建议至少 32 字节随机数）。密钥标记为 secret。应用重新部署后生效。
4. 点击连接 X，采用 OAuth 2.0 PKCE S256、一次性 state、HttpOnly Cookie。当前只申请 tweet.read、users.read、offline.access。
5. 可选 `X_BEARER_TOKEN` 支持应用级公开数据查询。接口可用性仍取决于权限与余额。

令牌经 AES-GCM 加密后保存在 D1，过期时尝试刷新；账号信息与凭据分表行，浏览器永远不接收令牌。断开连接删除本站令牌和 X 查询缓存；用户也可在 X 的应用设置撤销上游授权。当前没有自动发帖接口。

X 雷达调用近 24 小时搜索，每批最多 30 条，先按相关性取得结果，再按赞/转帖/回复合计排列；它不是全站榜单。全球话题榜调用 `/2/trends/by/woeid/1`。页面打开时可每 15 分钟更新，关闭页面后不运行。当前没有 X 开发者凭据，因此只能验证未配置状态和本地协议逻辑，真实授权与数据待配置后验收。

官方文档：
- https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- https://docs.x.com/x-api/posts/search-recent-posts
- https://docs.x.com/x-api/trends/trends-by-woeid/introduction
- https://docs.x.com/x-api/getting-started/pricing

## 视频雷达与自动剪辑

- X 视频雷达调用官方 Recent Search，自动补上 `has:videos`，只查近 24 小时，按点赞、转帖、回复排序，并保留帖子原链接与视频封面。它是“这批查询结果里的高互动线索”，不是 X 全站热榜；没有 X 凭据时只显示待接入状态。
- 抖音先支持粘贴分享链接、标题和热度信号，保存为待核验线索。官方的 `video.search` 需要在抖音开放平台申请“与我相关”的关键词视频权限，搜索结果只返回最近 1 天的公开视频，因此不绕过权限做页面抓取。接通后可把人工入口替换为官方关键词搜索。
- 每条视频线索都能生成 30–60 秒、9:16 的原创制作方案：3 秒钩子、口播、分镜、字幕、音效、CTA、事实检查和 FFmpeg/Remotion 编辑决策表。方案默认使用原创录屏、截图、图表和口播，不复制原视频。
- 队列数据保存为 `records.kind=video_lead`，支持从“捕捉”到“已出方案/剪辑中/已完成”的阶段更新。

官方抖音说明：
- https://open.douyin.com/platform/resource/docs/ability/search-management/video/
- https://open.douyin.com/platform/resource/docs/openapi/video-management/douyin/search-video/video-data

## GitHub 开源视频 Skill 研究

已验证的候选：
- [remotion-dev/skills](https://github.com/remotion-dev/skills)：约 4.8k stars，官方 Agent Skills，覆盖 Remotion 结构、字幕、渲染、Studio 和多媒体；适合把制作方案落成可重复渲染的 React 视频。
- [Sampet/claude-code-skills 的 video-editing](https://github.com/Sampet/claude-code-skills/blob/main/.agents/skills/video-editing/SKILL.md)：强调“转写/结构/编辑决策表 → FFmpeg → Remotion → 配音/字幕 → 最终检查”，适合真实素材的压缩和再编排。
- [ElSalvatore-sys/video-editor-plugin](https://github.com/ElSalvatore-sys/video-editor-plugin)：FFmpeg、Remotion、Whisper 三引擎，包含剪切、转码、自动字幕和程序化片头片尾命令。
- [docusphere/claude-skill-motion-graphics](https://github.com/docusphere/claude-skill-motion-graphics)：用 beat sheet、风格锁定、素材生成与 Remotion 组装长成片，适合后续做系列化栏目。

工作台当前先输出制作方案和可复制指令，渲染层按“Whisper 转写 → FFmpeg 粗剪 → Remotion 字幕/版式 → 人工检查 → 导出 9:16”接入。这样能把热点研究、事实核验和剪辑执行分开，便于替换模型与控制版权风险。

## AIHOT

匿名 GET `/api/v1/items?mode=selected&window=24h&limit=30`，保留原文与 AIHOT 来源。缓存 15 分钟，支持 ETag/304；失败时保留旧数据并显示过期提示。内部研究使用，外部商业用途须按 https://aihot.news/terms 取得适用授权。

## 创作 Skill

当前聊天项目的 `.agents/skills` 已安装 aihot、content-strategy、social、humanizer-zh。网页里的“复制创作指令”会带入选题、证据、业务与作者声音；把它交给此 Codex 项目，确认结果后回填网页。网页不会直接运行本地 Skill 文件。`stage_x_draft` WebMCP 工具在支持的浏览器中将返回稿件填入编辑器，不自动保存或发布。

## 数据与维护

- `records`：草稿、业务与声音设置；乐观版本锁。
- `cache`：AIHOT/X 接口缓存，不含个人授权凭据。
- `connections`：加密令牌、授权临时状态、已连接的账号简介。
- 访问边界由 owner-private Sites 提供，所有写操作检查同源。若以后改变访问范围，需要增加多用户归属和授权，不可直接把现有单人数据库公开。
- 内容库可导出 JSON 备份；发布后的曝光、点击与咨询由用户手动记录，未知指标保持空值。

本版本优先支持中文图文。后续可继续增加模型执行桥、图片与视频、后台监测、发布队列和网站转化数据。

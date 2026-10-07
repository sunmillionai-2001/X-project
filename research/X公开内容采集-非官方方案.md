# X 公开内容采集：非官方方式实测

测试日期：2026-10-05，北京时间。结论：不用 X 官方开发者 API，也能取得公开推文。已经验证了单帖、账号近期帖子、关键词搜索和 RSS。当前成果是研究原型，尚未接入生产工作台。

更新约束：用户随后明确排除了登录其个人 X 账号及使用其登录会话的采集方式。因此下文的个人登录浏览器、Cookie 和账号会话路线只保留为此前的研究记录，已经从实施方案中排除。后续测试只使用无需用户登录的公开接入方式。

后续已完成十二天历史、身份核对、原文核验和代理复测，最新结论请看 [十二天实测报告](C:/Users/孙宝刚/Documents/ChatGPT/生财有术/research/X公开内容采集-十二天实测报告.md)。

## 1. 已经实际取到什么

使用开源项目 [FxEmbed](https://github.com/FxEmbed/FxEmbed) 的公共服务。本次请求未提供用户 Cookie、X API Key 或付费凭据。

| 账号 | 服务返回记录 | 通过基础字段校验 | 作者属于该账号的记录 |
| --- | ---: | ---: | ---: |
| @ChatGPT | 20 | 20 | 13 |
| @OpenAI | 17 | 17 | 16 |
| @dotey（宝玉） | 22 | 22 | 19 |
| @karpathy | 20 | 18 | 12 |

共 77 条通过基础字段校验的时间线记录，含回复、转帖，并可能与其他账号的记录重复；不能称为 77 条原创或 77 条独立事件。基础校验只检查 ID、作者、非空正文、时间和链接一致性，不代表核实了内容中的事实。

- 宝玉样本推文返回 3,909 个 Unicode 字符。单帖接口与账号时间线中的正文完全一致。
- ChatGPT 样本返回超过 280 字符的长推文，带展开后的外部链接。
- 返回字段包括原帖 ID、作者、正文、发布时间、图片/视频地址及部分互动数据。互动数据只是服务当时返回的观测值。
- 搜索 `from:OpenAI` 返回 5 条记录；ChatGPT RSS 返回 10 条。
- 另行验证了 ChatGPT 的线程读取接口，HTTP 200，返回包含主帖和后续一帖的两帖数组。这个线程样本说明，只读后续帖会漏掉主帖中的适用地区等前提。

可复核入口及上游说明：

- [账号时间线](https://api.fxtwitter.com/2/profile/dotey/statuses?count=10)，[接口文档](https://docs.fxembed.com/api/twitter/operations/2profilehandlestatuses/)。
- [中文长推文样本](https://x.com/dotey/status/2106635352609865925)。
- [ChatGPT RSS](https://fxtwitter.com/ChatGPT/feed.xml?count=10)，[RSS 文档](https://docs.fxembed.com/guide/advanced/rss-atom-feeds/)。
- [接口总览](https://docs.fxembed.com/api/introduction/)。这是 FxEmbed 的非官方接口，不是 X 官方开发者接口。

## 2. “自己的办法”可以分成两条路线

**先取得可用内容：本机运行采集程序，读取非官方公共服务。**

我们自己维护账号名单、采集、校验、去重、存储和选题流程，上游读取仍依赖 FxEmbed。这条已经实测成功，不需要交出 X 登录凭据，也无需开通 X 开发者服务。它不是完全独立采集，公共服务的故障、缓存和字段变化会影响我们。

**已排除的历史路线：通过个人登录会话读取 X 网页。**

本地浏览器打开指定账号页面，读取页面已经展示的推文或浏览器正常收到的内容，保存到本地数据库。可以自写仅针对 X 页面的采集扩展，也可以参考 [OpenCLI](https://github.com/jackwener/OpenCLI) 的浏览器桥接机制。上游项目提供 Windows 安装说明及 X 读取命令，但本机尚未连接已登录的 X 浏览器，不能把它写成已跑通。

这条路线曾列入初步研究，尚未实测。用户随后明确排除个人登录会话，因此不再实施，也不要求用户完成登录或提供会话。

还可以自建 FxEmbed。已核查其账号时间线源码，流程是查询账号 ID、读取 X 网页所用的 GraphQL 时间线、解析帖子和游标、标准化为 JSON/RSS。源码同时包含访客请求和账号会话路径。公共服务读取成功，不等于不配会话的自建服务一定成功。自建部署尚未实测，不能承诺零配置。

- [时间线源码，固定提交](https://github.com/FxEmbed/FxEmbed/blob/e035b0e28bb417b67cc63759647d540ae03af6c6/packages/atmosphere/src/providers/twitter/userStatuses.ts)。
- [自建说明](https://docs.fxembed.com/deployment/)，[凭据说明](https://docs.fxembed.com/deployment/credentials/)。

## 3. 其他方式的测试边界

| 方式 | 本次结果 | 适用性 |
| --- | --- | --- |
| FxEmbed 公共 JSON/RSS | 成功 | 目前最方便的接入路径 |
| VxTwitter 单帖解析 | 成功，但同一帖漏掉了正文中的外部链接 | 可补充单帖，不能默认与原文等价；未验证账号监控 |
| Jina Reader 读取 X 账号页 | 本机连接超时 | 本次不可作为主要来源，不表示全球都不可用 |
| 三处 Nitter 公共 RSS | 两处超时，一处连接重置 | 本次不可作为主要来源 |
| 直接请求 X 公开账号 HTML | 本机连接超时 | 本次未验证出可读时间线 |
| OpenCLI / twitter-cli / Twikit | 核查了开源文档，未使用用户登录凭据实测 | 可用于本地登录会话路线；“没有 API Key”不等于“无需登录” |

[twitter-cli](https://github.com/public-clis/twitter-cli) 和 [Twikit](https://github.com/d60/twikit) 都有读取账号帖子的方法，需要可用的登录会话。尚未安装这些工具，也没有提取本机浏览器 Cookie。

## 4. 接入现有雷达时的方案

采用已跑通的公共服务，并用无需登录的公开原页辅助核验；具体以新的十二天实测报告为准。以下为首轮接入草案，尚未修改生产配置。

- **Problem Statement：** AIHOT 的精选材料不能覆盖我们自行挑选的全部 X 账号，需要直接取得原帖并能追溯来源。
- **Proposed Solution：** 增加“X 观察账号”配置和采集状态；先从少量账号读取近期页面。逐条保留作者、原帖 URL、发帖时间、采集时间、采集方式和正文；按原帖 ID 去重，保留主帖与自回复关系，再进入现有选题流程。
- **Technical Constraints：** 使用现有 Windows、Node 和 SQLite。第一阶段读取公共 JSON/RSS，不配置 X 官方开发者 API。点击刷新时采集；常驻定时采集需另行确定。来源失败、字段无效与没有新帖必须区分。
- **Non-goals：** 第一阶段不抓全站，不保证秒级实时或历史完整覆盖，不采私信和私密账号，不自动发帖。
- **Success Criteria：** 选定账号可以取得带原帖链接的近期内容；中文长文能保留；重复帖不会重复进入材料池；转帖不会误标原作者；断网或上游失败时界面显示真实错误；仅有摘要或缺正文时标明缺口。

有三点需要特别处理：

1. 时间线可能按置顶帖、线程、转帖混合排列。不能把第一条的时间当作全部帖子的时间，也不能把 `count=10` 当成严格返回 10 条的保证；本次接口多次返回超过请求数的记录。
2. 需要保留作者的自回复。完全删除回复，可能漏掉发布范围、限制、入口等决定选题准确性的细节。
3. 读取一页近期内容不等于完整监控。后续需以 ID 去重、记录抓取边界，并在漏抓风险或分页不足时显示覆盖范围。

## 5. 复现与结果文件

在项目根目录运行：

```powershell
node research/x-source-probe.mjs
```

加入 `--extra` 会同时测试直接 HTML、Jina 和三处 Nitter RSS。程序最多同时发出两个请求，不调用写作模型，不修改生产数据库或模型配置。每次运行会更新同目录的 `x-source-probe-results.json`。

- [实测脚本](C:/Users/孙宝刚/Documents/ChatGPT/生财有术/research/x-source-probe.mjs)。
- [本次结果及取得的原始正文](C:/Users/孙宝刚/Documents/ChatGPT/生财有术/research/x-source-probe-results.json)。

报告中的 3,909 字符和时间线计数来自结果文件中的实际响应。当前只证明这些样本和路径在本次测试可用，尚未完成长期稳定性、独立自建和生产工作台的验收。

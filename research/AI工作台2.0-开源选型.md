# AI 工作台 2.0 开源核查

核查日期：2026-10-04。GitHub API 实时元数据仅作为规模线索，不能证明效果。已读取代码、许可证和安装资料。

| 项目 | 本次 stars | 用途与结论 |
|---|---:|---|
| [obsidian-creator-workbench](https://github.com/fengjunchengCode/obsidian-creator-workbench) | — | MIT。复用抓取器、素材组织与方法库，吸收排期和复盘结构，不复制虚构账号数据 |
| [cheat-on-content](https://github.com/XBuilderLAB/cheat-on-content) | 7,205 | MIT。完整仓库已安装到项目技能目录，保留子技能和相对引用。早期评分作为假设，不照搬营销增长承诺 |
| [dbskill](https://github.com/dontbesilent2025/dbskill) | 10,409 | CC BY-NC 4.0。相关技能已下载到 research/skills-disabled 供研究，不自动加载到账号运营执行。README 允许个人学习，商业用途要求单独授权；尚未获得商用授权 |
| [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 128,215 | MIT。已读视频、语音服务和 Agent Skill。默认素材源需要 Key，完整项目含多种提供商依赖。本轮复用其采用的 edge-tts / FFmpeg 组件，未声称接通整个项目 |
| [NarratoAI](https://github.com/linyqh/NarratoAI) | 11,275 | MIT。侧重原视频分析与解说，需要模型服务及原视频。作为视频片段阶段候选，未安装 |
| [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) | 66,137 | 非商业学习许可。涉及平台登录态，不默认集成到运营流程 |
| [TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader) | 16,476 | GPL-3.0。下载器不等于热榜发现，也不提供素材再利用权，本轮未启用 |
| [edge-tts](https://github.com/rany2/edge-tts) | 12,156 | 主体 LGPLv3，字幕模块 MIT。已安装；晓晓中文声音实际生成成功。依赖在线服务，免费可用不等于 SLA |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 25,683 | MIT。适合真实录音转写；当前配音已有时间戳，无需重复识别，本轮不增加此依赖 |

## 采用的实现

- 保留旧版数据与程序，2.0 本机服务在 x-studio/local；提供导入旧版草稿入口，非破坏迁移。
- 复用 MIT 抓取器，保留许可证。推荐按主题及可展示性初筛，注明不是全网热榜、增速榜。
- follow-builders 是有限覆盖的 X Feed，不保证包含视频；抖音自动捕获尚未接通。
- SQLite 保存任务、素材和指标快照，确认绑定内容版本。发布前判断锁定后不可覆盖，复盘另存。
- edge-tts 生成真实语音与时间戳；Pillow 排版；imageio-ffmpeg 提供 FFmpeg。当前支持图片与上传 MP4 分镜合成；没有自动语义选段或完整长视频剪辑。
- Ollama 接口已实现；运行时和模型未就绪时显示待接入。可导出创作任务给现有 AI 助手并导入结构化脚本，该备用方式不算网页内自动生成。

## 不照搬的部分

dbskill 的先有产品再做内容框架不能覆盖用户已确认的账号目标。方法库中的比例、时间和评分仅作实验，不当成平台规则。安装技能不等于网页执行技能，也不包含作者的真实账号数据。

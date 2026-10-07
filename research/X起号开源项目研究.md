# X 起号与图文复刻：开源候选研究

核对日期：2026-10-06。定位：面向普通人的 AI 热点、工具和玩法，中文 X 中长文图文。用户已澄清是「复刻爆款」，不涉及付费订阅。

结论：没有在这批候选中确认一个能同时满足匿名取 X、研究对标、中文长文、原创配图和人工发布的现成整套工具。比较适合本工作台的是组合其内容方法：用 x-skills 拆开头和结构，用宝玉 Skills 的布局与提示词组织配图，用营销 Skills 规划内容与图文层级，用 X-growth-skills 的经验清单组织起步和复盘。这是依据下面已读文件作出的适配判断。

源码读取与安装是两回事。未执行上游脚本，没有部署要求 X 登录或官方 API 的发布系统。研究副本、许可证、版本和校验值保存在 x-growth-upstream。

## 逐项源码核对

### JimLiu/baoyu-skills：长文配图与知识图解

[项目](https://github.com/JimLiu/baoyu-skills)。许可：MIT。状态：已适配。核对版本：`1567581c26ec29f4216c6e6835415bf30343b0e3`；Star 26359 是当时快照，不是质量评分。

学习点：文章结构决定图的位置；图的类型、风格与色板分别约束。

实际处理与边界：配图方案与提示词已适配；继续使用工作台已有图片 API。

已读文件依据：

- [skills/baoyu-article-illustrator/SKILL.md](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-article-illustrator/SKILL.md)
- [skills/baoyu-article-illustrator/references/prompt-construction.md](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-article-illustrator/references/prompt-construction.md)
- [skills/baoyu-cover-image/SKILL.md](https://github.com/JimLiu/baoyu-skills/blob/1567581c26ec29f4216c6e6835415bf30343b0e3/skills/baoyu-cover-image/SKILL.md)

### sergebulaev/x-skills：开头、结构与账号门面

[项目](https://github.com/sergebulaev/x-skills)。许可：MIT。状态：已适配。核对版本：`c4ac9bac771733d7716b3143c7c2ef1bac9899f6`；Star 117 是当时快照，不是质量评分。

学习点：从参考帖提取可填空的骨架，再用自己的事实写正文。

实际处理与边界：只接入文字拆解方法；上游没有内置帖子读取器，发布依赖 Publora。

已读文件依据：

- [skills/x-hook-extractor/SKILL.md](https://github.com/sergebulaev/x-skills/blob/c4ac9bac771733d7716b3143c7c2ef1bac9899f6/skills/x-hook-extractor/SKILL.md)
- [skills/x-profile-optimizer/SKILL.md](https://github.com/sergebulaev/x-skills/blob/c4ac9bac771733d7716b3143c7c2ef1bac9899f6/skills/x-profile-optimizer/SKILL.md)

### kangarooking/X-growth-skills：中文冷启动与对标研究

[项目](https://github.com/kangarooking/X-growth-skills)。许可：MIT。状态：已适配。核对版本：`cfd2f44a2427437b8583bc302f29e1561c703c9b`；Star 69 是当时快照，不是质量评分。

学习点：按曝光到关注的路径找问题，对标后改变人群、场景或角度。

实际处理与边界：二次提炼的作者经验；固定增长数字、互关方案和精确算法权重不作为工作台结论。

已读文件依据：

- [x-benchmark-research/SKILL.md](https://github.com/kangarooking/X-growth-skills/blob/cfd2f44a2427437b8583bc302f29e1561c703c9b/x-benchmark-research/SKILL.md)
- [x-data-review/SKILL.md](https://github.com/kangarooking/X-growth-skills/blob/cfd2f44a2427437b8583bc302f29e1561c703c9b/x-data-review/SKILL.md)

### coreyhaines31/marketingskills：内容支柱与轮播叙事

[项目](https://github.com/coreyhaines31/marketingskills)。许可：MIT。状态：已适配。核对版本：`dda3841f0b294e01e93b1541486beefbfab0915e`；Star 53386 是当时快照，不是质量评分。

学习点：把内容分成稳定支柱；选择对应叙事结构并用真实数据复盘。

实际处理与边界：用于内容规划与统一视觉提示；不自动发布或回复。

已读文件依据：

- [skills/social/SKILL.md](https://github.com/coreyhaines31/marketingskills/blob/dda3841f0b294e01e93b1541486beefbfab0915e/skills/social/SKILL.md)
- [skills/social/references/carousel-frameworks.md](https://github.com/coreyhaines31/marketingskills/blob/dda3841f0b294e01e93b1541486beefbfab0915e/skills/social/references/carousel-frameworks.md)

### xai-org/x-algorithm：推荐机制的代码参考

[项目](https://github.com/xai-org/x-algorithm)。许可：Apache-2.0。状态：解释已接入。核对版本：`b412112d03f27acbfd668e0cc040abcafa1080c1`；Star 33514 是当时快照，不是质量评分。

学习点：代码为展开图片、停留、主页点击、关注等动作设置独立预测项。

实际处理与边界：仅能确认评分结构，不能把某一权重或发布时间当作所有账号的增长公式。

已读文件依据：

- [home-mixer/scorers/value_model.rs](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/scorers/value_model.rs)
- [home-mixer/scorers/phoenix_scores_ranking_scorer.rs](https://github.com/xai-org/x-algorithm/blob/b412112d03f27acbfd668e0cc040abcafa1080c1/home-mixer/scorers/phoenix_scores_ranking_scorer.rs)

### ibrahimahmed/growthmate：X 选题、写作、排程与分析

[项目](https://github.com/ibrahimahmed/growthmate)。许可：MIT。状态：仅研究。核对版本：`aea4fcdab135a2d4921cd03257eb7135e0baba62`；Star 4 是当时快照，不是质量评分。

学习点：区分灵感库、正文草稿、发布队列和表现数据。

实际处理与边界：核心检索和生成路由要求 X OAuth；没有部署原应用。

已读文件依据：

- [src/app/api/writer/generate/route.ts](https://github.com/ibrahimahmed/growthmate/blob/aea4fcdab135a2d4921cd03257eb7135e0baba62/src/app/api/writer/generate/route.ts)
- [src/app/api/viral/route.ts](https://github.com/ibrahimahmed/growthmate/blob/aea4fcdab135a2d4921cd03257eb7135e0baba62/src/app/api/viral/route.ts)

### gitroomhq/postiz-app：多平台发布排程

[项目](https://github.com/gitroomhq/postiz-app)。许可：AGPL-3.0。状态：仅研究。核对版本：`86b3c3dd55d38fbed77fdbf82a21bfc1a169cac6`；Star 36730 是当时快照，不是质量评分。

学习点：草稿与发布队列分开，发布后形成记录。

实际处理与边界：X provider 使用 OAuth 和官方接口；本轮保留人工发布，未接账号。

已读文件依据：

- [libraries/nestjs-libraries/src/integrations/social/x.provider.ts](https://github.com/gitroomhq/postiz-app/blob/86b3c3dd55d38fbed77fdbf82a21bfc1a169cac6/libraries/nestjs-libraries/src/integrations/social/x.provider.ts)

### HeyPortal/open-scrl：本机图文排版与图片导出

[项目](https://github.com/HeyPortal/open-scrl)。许可：MIT。状态：仅研究。核对版本：`821cf089cc6ef1af5b46c0a994eb2d84b2b192e6`；Star 3 是当时快照，不是质量评分。

学习点：内容与页面布局分离，用统一画幅导出多页图文。

实际处理与边界：已有本机编辑与导出代码；没有部署这个独立编辑器。

已读文件依据：

- [src/export/ExportController.ts](https://github.com/HeyPortal/open-scrl/blob/821cf089cc6ef1af5b46c0a994eb2d84b2b192e6/src/export/ExportController.ts)
- [src/export/canvas2d/render.ts](https://github.com/HeyPortal/open-scrl/blob/821cf089cc6ef1af5b46c0a994eb2d84b2b192e6/src/export/canvas2d/render.ts)

### UitbreidenOS/Slidr：主题驱动的图文卡片

[项目](https://github.com/UitbreidenOS/Slidr)。许可：AGPL-3.0 + CC BY-SA 4.0。状态：仅研究。核对版本：`19b87ed3cad56a0e647f1b6173d5b6ce01e3a3fc`；Star 3 是当时快照，不是质量评分。

学习点：以设计说明保存风格、布局和统一画幅。

实际处理与边界：代码 AGPL-3.0，内容 CC BY-SA 4.0，不能按 MIT 一键复制；未部署。

已读文件依据：

- [LICENSE-CODE](https://github.com/UitbreidenOS/Slidr/blob/19b87ed3cad56a0e647f1b6173d5b6ce01e3a3fc/LICENSE-CODE)
- [LICENSE-CONTENT](https://github.com/UitbreidenOS/Slidr/blob/19b87ed3cad56a0e647f1b6173d5b6ce01e3a3fc/LICENSE-CONTENT)
- [src/app/api/images/generate/route.ts](https://github.com/UitbreidenOS/Slidr/blob/19b87ed3cad56a0e647f1b6173d5b6ce01e3a3fc/src/app/api/images/generate/route.ts)

### robort-gabriel/Carousel-Post-Generator-AI-Agent：文章到多页图片的工作流

[项目](https://github.com/robort-gabriel/Carousel-Post-Generator-AI-Agent)。许可：未声明。状态：仅研究。核对版本：`7feaae0810b091bb133a9b151126460fe46ba9cb`；Star 0 是当时快照，不是质量评分。

学习点：读取文章、生成分镜、逐张生图、保存输出分别处理。

实际处理与边界：源码可读，但未见 LICENSE；只学习流程，没有复制实现或安装。

已读文件依据：

- [carousel_post_generator_agent.py](https://github.com/robort-gabriel/Carousel-Post-Generator-AI-Agent/blob/7feaae0810b091bb133a9b151126460fe46ba9cb/carousel_post_generator_agent.py)
- [main.py](https://github.com/robort-gabriel/Carousel-Post-Generator-AI-Agent/blob/7feaae0810b091bb133a9b151126460fe46ba9cb/main.py)

### inbharatai/SocialFlow：资讯到内容的流程引擎

[项目](https://github.com/inbharatai/SocialFlow)。许可：未声明。状态：仅研究。核对版本：`d450ae0584cccd81923ac7b99f6fd98e2d17d69d`；Star 36 是当时快照，不是质量评分。

学习点：收集、规划、创作、审稿、发布、分析分步存档。

实际处理与边界：未见 LICENSE；X 创作默认短帖，发布依赖登录态，未部署。

已读文件依据：

- [backend/agents/creator.py](https://github.com/inbharatai/SocialFlow/blob/d450ae0584cccd81923ac7b99f6fd98e2d17d69d/backend/agents/creator.py)

## 具体取舍

1. **x-skills** 的 hook extractor 接受用户粘贴或外部采集结果，不自带完整帖子读取器。保留它的开头作用、填空结构和换自己声音的方法；本工作台用已有公开缓存提供输入。
2. **宝玉 Skills** 把图的类型、风格、色板和提示词分区分别约束。适配到原创图文生成：封面提出任务，正文图解释步骤或选择，同篇统一标签与色板。没有照搬上游执行器，也不改用户已配置的图片服务。
3. **marketing skills** 提供内容支柱和轮播图文框架。本工作台把这些用于普通受众的 AI 图文，而不是强制推销产品。
4. **X-growth-skills** 是对课程和作者经验的二次提炼。将定位、主页承接、对标和复盘作为待检验的方法；固定涨粉数字、互关套路、固定发布时间和算法权重不作为本工作台结论。
5. **x-algorithm** 的当前评分代码通过 value_model 汇总预测项。能确认回复、点击、分享、停留等出现在评分结构中；不能仅靠公开代码推出普通账号的精确增长公式，也不据此宣称某一指标的固定权重。
6. **Growthmate / Postiz** 的真实 X 集成路由依赖认证或官方接口。只参考创作、队列和复盘的流程划分，保持用户要求的匿名采集与人工发布。
7. **open-scrl / Slidr / Carousel Agent / SocialFlow** 可参考多页布局、从文案到配图的步骤以及计划和审核分离。Slidr 的代码和内容许可不同；后两项没有找到 LICENSE，应称源码可读的候选，不能声称可自由复制实现。

## X 方法论原始材料

精选了 6 篇当前实际取得的作者文字，下面是短摘要，不保存整篇复刻文案。

- [从起号到变现的一年复盘](https://x.com/AI_Jasonyu/status/2104911243739853231)，鱼总聊AI，2026-09-29。重点学习定位、主页承接、冷启动内容与真实讨论。作者的收入和涨粉属于自述，不作为你的预期结果；算法权重相关说法需另行核实。 当前范围：长文文字已取得；图片未分析。
- [持续提供价值与账号定位](https://x.com/AI_Jasonyu/status/2105159557970329823)，鱼总聊AI，2026-09-30。把面向谁、提供什么内容与长期定位连在一起。作者个人变现路径不能直接推成所有账号的路线。 当前范围：主帖文字已取得。
- [余温对鱼总复盘的增量解读](https://x.com/gkxspace/status/2104926272099090464)，余温，2026-09-29。可以观察怎样引用原文后补观点与编号清单。曝光、主页承接、回复是可测试方向，具体权重与收益例子不能直接照搬。 当前范围：主帖文字已取得；引用内容分别归属。
- [怎样降低日常经验分享的成本](https://x.com/dotey/status/2106153681423130801)，宝玉，2026-10-03。从真实使用、把不同观察串联，以及分享结果和提示词三个方面组织创作记录。适合转成自己的素材笔记流程。 当前范围：主帖文字已取得。
- [持续输出与拆解账号的经验](https://x.com/gkxspace/status/2103792240523104346)，余温，2026-09-26。把没有流量时的观察和调整记录下来，研究同类账号的内容与逻辑。文中个人收入只是作者声明。 当前范围：主帖文字已取得。
- [标题从夸张形容词回到具体用途](https://x.com/GitHub_Daily/status/2103477139991564538)，GitHubDaily，2026-09-25。观察工具介绍怎样先提出读者痛点，再说明入口与用法。标题应具体且能够被正文兑现。 当前范围：主帖文字已取得。

鱼总长文的作者文字已经取得，图片未分析。作者的收入、粉丝和算法说法分别处理：收入和粉丝归为自述，算法数字未经确认不采用。余温的评论只归因自己的文字，不把被引用长文归给余温。宝玉的日常分享方法与 GitHubDaily 的具体标题方法作为经验参考，不推出因果。

此外，网页从当前公开缓存筛出最多 24 条运营、写作或复盘相关候选，标为「候选·未逐篇核对」。这不是 X 全站资料库；精选四组之外的内容需要继续核对。

## 已在网页生效的能力

- 20 条有出处的方法，按定位、选题、复刻、图文、节奏、互动、复盘筛选；学习标记存入本机。
- 6 篇精选原帖，可送入复刻工作台；动态候选从现有 X 信号源更新。
- 写作模型拆单篇作者文字，输出 3—6 步结构与占位模板，短引文必须能在当次输入逐字找到，引用合计限 24 字符。
- 新帖必须单独填写自己的材料，不将参考帖自动作为事实。生成 800—1500 字符中文稿、备选标题及封面/解释图提示词。长句重合检查只提示风险，不能证明原创。
- 修改与版本留存，转入已有稿件流程；提纲、正文和图方案仍需分别确认。API 图片自动保存或手动导入。
- 起步清单和真实数据快照，未知指标不写成零，显示帖龄和可计算的收藏/阅读比例。
- 11 个研究候选的项目入口、源码证据、许可和已接入范围均在网页显示。

## 后续值得用真实数据决定的扩展

先积累自己的发布记录，再决定是否增加轮播编辑器、结构检索和账号实绩基线。当前没有自己的可比历史，不生成阅读量预测，不标注“必爆”，不自动互关或发布。

## 验证记录

自动化覆盖原句造假、参考/事实分离、指标未知与零、乐观版本冲突、草稿转入与确认门槛、持久化和已有功能回归。真实写作模型的试跑摘要另见 x-growth-live-verification.json；图片 API 已真实返回并保存测试 PNG。

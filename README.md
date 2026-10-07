# X Project · 私人 AI 内容创作工作台

面向普通人的 AI 热点、工具与玩法，支持选题、公开信号采集、参考内容研究、原创图文写作、配图和人工发布记录。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `x-radar/` | 当前使用的 X 选题雷达，含今日雷达、X 信号源、爆款创作、X 起号、稿件、模型配置和费用记录 |
| `x-studio/local/` | 工作台 2.0 的本机 Python 服务、页面与测试，包含视频制作流程 |
| `x-studio/app/` 等 | 早期 React/Vinext 网页版本与数据库迁移 |
| `.agents/skills/` | 已安装的内容研究、写作与资讯技能，保留各自来源和许可 |
| `research/` | 项目需求、研究文档和采集／验收脚本；实际抓取快照不入库 |
| `video_edit/` | 本机视频检查与剪辑辅助脚本；输入视频和生成媒体不入库 |

## 启动当前 X 选题雷达

需要 Node.js 24.11 或以上。

```sh
npm --prefix x-radar install
node start-x-radar.cjs
```

打开 http://127.0.0.1:8770/ 。Windows 也可以双击 `启动X选题雷达.cmd`。

第一次使用时，在“模型与风格”配置自己的写作服务和密钥。图片支持兼容图片 API，也支持复制提示词到 ChatGPT 网页生成后导入。

详细说明见 [X 选题雷达](x-radar/README.md)、[爆款创作](x-radar/爆款创作使用说明.md) 和 [X 起号](x-radar/X起号使用说明.md)。

## 本机数据与研究案例

密钥、SQLite、草稿、上传图片和模型调用记录保存在 `.x-radar/`；工作台 2.0 数据在 `.workbench-v2/`。这些目录被 Git 排除，每台电脑需要自行配置，不能通过仓库获得原电脑的密钥或草稿。

包含抓取全文的低粉研究快照 `x-radar/data/low-follower-studies.json` 也只保留本机。新克隆时该案例列表为空，其他模块可以正常使用，仍可在复刻工作台选择公开帖子或粘贴原文进行拆解。已有本机快照会继续读取。可以用 `XRADAR_RESEARCH` 指定自己的研究 JSON 路径；格式为 `{ "studies": [], "criteria": "样本范围说明" }`，条目结构可参考合成测试输入 `x-radar/tests/growth-fixture.mjs`。

研究目录中的采集和报告脚本可能依赖此前生成的原始快照；这些快照需要重新获取，不是启动网页所需的文件。

## 测试

```sh
npm --prefix x-radar test
python -m unittest discover -s x-studio/local/tests -p "test_*.py"
```

自动测试使用隔离数据目录、模拟网络和合成研究样本，不需要生产密钥。工作台 2.0 的依赖和运行方式见 [本机执行服务](x-studio/local/README.md)。早期网页版本的安装、构建和迁移说明见 [X Studio](x-studio/README.md)。

## 来源与许可

各目录中的第三方技能、模板和代码保留原有许可证，不能把整个仓库视为统一的 MIT 项目。尤其 `dbskill` 按 CC BY-NC 4.0 使用，商业用途需取得适用许可。依赖许可和来源详见 [第三方说明](THIRD_PARTY_NOTICES.md)。

公开 X 信号源使用匿名公开来源，不要求登录个人 X；完整性和可用性按采集状态显示。所有账号发布保持人工操作。

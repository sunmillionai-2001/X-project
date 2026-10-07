# 爆款创作 API 配图验收

日期：2026-10-06（北京时间）。

## 模型验证

OpenAI 官方提供 [GPT Image 2.5 Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) 与 [GPT Image 2.5 Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare)。

用户已配置的 `https://api.yunmeng.sale/v1` 在当前密钥下只列出 `gpt-image-2` 图片模型。实际请求两个 2.5 模型均返回 404，没有可用渠道；记录见 `image-2.5-provider-check.json`。这次验证没有更换原来的可用配置，当前继续用 `gpt-image-2`。

## 页面与运行验证

从「爆款创作 → 写自己的帖子 → 配图制作」点击第一张图的「使用 API 生成这张图」。真实请求成功，自动保存为 `../.x-radar/assets/053d708e-72c4-4066-897a-6221d6c5804e.png`。页面显示 1/3 张已保存、图片预览、下载与查看大图，同时保留复制提示词、ChatGPT 网页入口及手动导入。

正文、提纲和已有稿件未被自动确认或发布。图片保存到当前草稿；转入稿件的复用行为已在隔离测试中验证，保留原有确认步骤。

## 自动化验证

执行 `node --test x-radar/tests/*.test.mjs`，36 项通过，0 项失败。新增覆盖：

- 批量生图中途失败，已成功图片仍保存。
- 重试仅补缺失图片，已完成项不会重复请求。
- 生成时禁止其他窗口覆盖该草稿正文与提示词。
- 正文、提示词与图片绑定；变更后旧图留作历史。
- 手动导入与 API 并存，图片及来源重启后仍保存。
- 带图转入稿件，图方案审批保留，已有用户上传图不被替换。
- 页面显示预览、下载、API 生图，以及保留的网页路径。

修改文件均为 UTF-8 without BOM，中文重新读取正常。截图见 `viral-api-images-20261006.jpg`。

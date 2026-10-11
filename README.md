# Journal

个人技术知识笔记，使用 TypeScript 和 VitePress 构建。

配套 Skill（Private）：[sklme/journal-skills](https://github.com/sklme/journal-skills)

## 本地预览

```bash
pnpm install
pnpm docs:dev
```

## 检查

```bash
pnpm check
```

仓库内容提交前必须完成脱敏和人工复核。

## 导航维护

文章文件和 URL 保持稳定，主题导航由 `docs/.vitepress/navigation.mts` 统一维护。

- 新增文章后，在对应主题的专题分组中登记标题、摘要和原始链接；主题卡片、文章列表、顶部导航高亮和独立侧栏会使用同一份目录。
- 主题首页放在 `docs/knowledge/topics/<topic>/index.md`，用 `TopicArticles` 展示专题文章。它们是导航页，不增加内容日志条目。
- 内容日志保持按月份倒序、每篇文章一个原始 URL 的规则，导航调整不修改日志分类或收录时间。
- `pnpm check` 验证所有文章恰好归属一个主题、侧栏只显示当前主题、主题入口与站内锚点有效，并检查构建后的日志链接。

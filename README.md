# Journal

个人开发记录与知识笔记，使用 VitePress 构建并发布到 GitHub Pages。

- 站点：<https://sklme.github.io/journal/>
- 内容目录：[`docs/`](./docs/)
- 写作模板：[`templates/`](./templates/)
- 发布原则：仓库中只保存已经脱敏、可以公开到互联网的内容

## 本地使用

需要 Node.js 22 或更高版本，以及 pnpm 10。

```bash
pnpm install
pnpm docs:dev
```

提交前执行完整检查：

```bash
pnpm check
```

安装依赖时会把 `.githooks/` 配置为本仓库的 Git hooks 目录。提交前钩子会自动检查暂存文件中的常见凭据、个人信息、内网地址和本机路径。

## 新增内容

1. 从 `templates/` 复制合适的模板。
2. 开发记录放入 `docs/devlog/<年份>/`。
3. 可复用知识放入 `docs/knowledge/<分类>/`。
4. 运行 `pnpm check`。
5. 推送分支；所有分支都会构建检查，只有 `main` 会发布到 GitHub Pages。

## 发布前检查

- 不包含密码、Token、Cookie、私钥或真实配置值。
- 不包含内网域名、服务名、仓库地址、员工信息或用户标识。
- 不粘贴原始日志、请求包、数据库数据、协议文件或公司代码。
- 示例使用 `example.com`、`192.0.2.1`、`<USER_ID>` 等公开占位符。
- 截图必须裁剪、打码并移除无关元数据。
- 无法确定是否敏感的内容不发布。

自动扫描只能作为辅助，不能代替人工复核和所在组织的保密规定。

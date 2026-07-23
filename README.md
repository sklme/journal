# Journal

个人开发记录与知识笔记，使用 TypeScript 和 VitePress 构建并发布到 GitHub Pages。

- 计划站点：<https://sklme.github.io/journal/>（当前暂停）
- 仓库可见性：Private
- 内容目录：[`docs/`](./docs/)
- 写作模板：[`templates/`](./templates/)
- 发布原则：仓库中只保存已经脱敏、可以公开到互联网的内容

> [!WARNING]
>
> 仓库为 Private 不代表 GitHub Pages 站点也会自动成为私有。当前账号套餐不支持从 Private 仓库发布 Pages，自动发布已通过 `ENABLE_GITHUB_PAGES` 仓库变量暂停。无论后续采用何种发布方式，所有 `docs/` 内容仍按照互联网公开标准管理。

## 本地使用

需要 Node.js 22 或更高版本，以及 pnpm 10。VitePress 配置、主题和工程脚本均使用 TypeScript，并开启严格类型检查；工具脚本直接使用 Node.js 的 TypeScript 类型擦除能力运行。

```bash
pnpm install
pnpm docs:dev
```

提交前执行完整检查，包括敏感信息扫描、TypeScript 类型检查和 VitePress 生产构建：

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

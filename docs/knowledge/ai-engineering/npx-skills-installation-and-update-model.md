---
title: npx skills 的安装与更新原理：远端解析、目录替换与软链接
date: 2026-08-25
tags:
  - Agent Skills
  - CLI
  - Package Management
description: 解释 Vercel Skills CLI 如何发现、安装和更新 Skill，以及 copy、symlink 与目录替换的实际语义
---

# npx skills 的安装与更新原理：远端解析、目录替换与软链接

## 要解决的问题

执行下面的命令时，安装器究竟是在更新一个 Git 工作区，还是在重新部署一份目录？

```bash
npx skills add <SOURCE> \
  --skill code-review \
  --agent codex \
  --global \
  --yes
```

这个区别会直接影响几个判断：

- 能不能直接修改 Agent 当前读取的 Skill 目录；
- 重新安装是否会保留本地手工修改；
- `copy` 和 `symlink` 模式分别复制或链接了什么；
- `npx skills update` 是增量补丁，还是重新执行安装；
- 怎样才能让 Skill 更新可复现、可审核并且容易回滚。

截至 2026-08-25，npm Registry 的公开版本为 `skills@1.5.23`；本文同时用公开仓库提交
[`435076e`](https://github.com/vercel-labs/skills/tree/435076e78988e1e6ec40d00b0b1d76bdbbc5419a)
核对实现语义。发布包和仓库主线可能存在细微时差，后续版本也可能调整目录和更新行为。

## 核心结论

`npx skills` 更像一个 **Skill 分发器**，不是安装目录里的 Git 客户端。远端安装的核心过程可以概括为：

```text
Git / 下载地址 / 本地来源
          │
          ▼
临时检出、下载或读取来源
          │
          ▼
发现并解析 SKILL.md
          │
          ▼
选择 Skill、Agent 和 Project / Global 作用域
          │
          ▼
计算 canonical 目录和 Agent 消费目录
          │
          ▼
清理旧目标目录
          │
          ▼
复制新内容，必要时创建软链接
          │
          ▼
记录来源和内容 Hash，供后续检查更新
```

所以，“重新安装”的直觉基本正确：**重新取得上游内容，再用它替换本地安装结果**。它通常不是进入安装目录执行 `git pull`，也不会把本地修改自动合并回上游。

## 三种目录不要混为一谈

| 层次 | 用途 | 是否应该直接修改 |
| --- | --- | --- |
| 源码仓库 | 编写、评审、提交和发布 Skill | 是 |
| 临时来源目录 | 安装器用于发现和读取 Skill | 否，任务结束后会清理 |
| Agent 安装目录 | Agent 实际扫描和加载的运行时副本 | 不应作为长期修改源 |

正确的维护路径是：

```text
修改源码仓库
    ↓
校验、提交并推送
    ↓
从固定来源重新安装或执行 update
    ↓
验证 Agent 实际读取的目录
```

如果直接修改安装目录，下一次安装时这些变化通常会被删除。即使临时生效，也无法可靠地分享、审查或重建。

## 来源发现与目标计算

[Skills CLI 文档](https://github.com/vercel-labs/skills/blob/435076e78988e1e6ec40d00b0b1d76bdbbc5419a/README.md)
支持 Git 仓库、任意 Git URL、本地目录和直接下载地址。安装器先获取来源，再搜索有效的 `SKILL.md`，然后根据参数选择具体 Skill。

目标位置由两个维度决定：

- **作用域**：Project 写入当前项目，Global 写入用户级目录；
- **Agent**：不同 Agent 有自己的消费目录，一部分 Agent 也支持通用的 `.agents/skills` 目录。

安装器会区分：

- **canonical 目录**：一份可被多个 Agent 共用的内容副本；
- **Agent 目录**：Agent 实际扫描的位置，可以是副本，也可以是指向 canonical 目录的软链接。

## Copy 模式：先清理，再复制

在 copy 模式下，[安装器源码](https://github.com/vercel-labs/skills/blob/435076e78988e1e6ec40d00b0b1d76bdbbc5419a/src/installer.ts)
会先递归删除目标目录，再重新创建目录并复制新内容。

```text
旧 Agent 目录
    ↓ 删除
空目录
    ↓ 复制
新 Skill 内容
```

先删除而不是直接覆盖有一个重要目的：如果上游重命名或删除了文件，旧文件不会残留在安装目录中。

代价同样明确：

- 安装目录里的本地修改会丢失；
- 这不是目标目录级的原子切换，进程中断可能留下空目录或不完整副本；
- 安装结果是部署产物，不是带历史和合并能力的 Git 工作区。

当只选择一个 Agent，或者所有目标 Agent 共用同一个 Skill 目录时，copy 与 symlink 没有实际去重差异。[`add.ts`](https://github.com/vercel-labs/skills/blob/435076e78988e1e6ec40d00b0b1d76bdbbc5419a/src/add.ts)
会跳过没有意义的模式选择。

## Symlink 模式：复制一份 canonical 内容，再链接给 Agent

多 Agent 场景中，默认推荐的 symlink 模式不是把 Agent 目录直接链接到原始 Git 仓库，而是：

1. 清理并重建 canonical 目录；
2. 把 Skill 内容复制到 canonical 目录；
3. 从各 Agent 消费目录创建指向 canonical 目录的软链接；
4. 如果创建软链接失败，则回退为复制。

```text
                 ┌─ Agent A / skills / code-review
canonical copy ──┼─ Agent B / skills / code-review
                 └─ Agent C / skills / code-review
```

这种设计减少了多 Agent 重复副本，并为它们提供一份本地事实源。但 canonical 内容仍然是安装结果；重新安装时它同样会被清理并替换。

对于本身就直接读取通用 canonical 目录的 Agent，全局安装后不需要再创建一层指向自己的软链接。

## Update 本质上仍然是重新安装

`npx skills update` 会读取安装记录中的来源和内容 Hash，检查上游是否发生变化。发现更新后，它会再次调用 `skills add`，用记录的来源刷新 Skill。

```text
读取 lock 记录
    ↓
重新解析来源并计算内容 Hash
    ↓
没有变化 → 跳过
    ↓
发现变化 → 再次调用 add
    ↓
清理并重建安装结果
```

因此，`update` 的核心不是文件级合并，而是“检测变化 + 重新安装”。这也解释了为什么安装目录里的手工修改不属于可靠更新流程。

需要注意一个版本边界：截至本文验证基线，更新路径会重新执行 `add`，但安装记录没有完整保存所有安装模式信息。公开的
[`#1199`](https://github.com/vercel-labs/skills/issues/1199)
记录了 copy 安装在更新后变成 symlink 的情况。如果项目明确要求实体副本，应在更新后检查目录类型，必要时显式使用 `--copy` 重新安装。

## 最小使用方式

### 安装到 Codex 全局目录

```bash
npx skills add https://github.com/example-org/example-skills.git \
  --skill code-review \
  --agent codex \
  --global \
  --yes
```

### 更新已记录来源的 Skill

```bash
npx skills update code-review --global --yes
```

### 验证实际安装结果

```bash
npx skills ls -g
ls -ld ~/.agents/skills/code-review
readlink ~/.agents/skills/code-review || true
```

`ls -ld` 可以区分普通目录和软链接，`readlink` 可以确认链接最终指向哪里。不要只根据命令成功提示推断 Agent 一定能发现 Skill。

## 可复现更新需要固定来源

如果安装来源只指向一个持续变化的默认分支，同一条命令在不同时间可能得到不同内容。需要可复现时，应固定 tag 或 commit，并保存至少三类信息：

| 信息 | 解决的问题 |
| --- | --- |
| 来源 URL 与 Skill 路径 | 从哪里取得内容 |
| tag 或 commit | 取得哪个源码状态 |
| 内容 Hash 或 digest | 实际安装内容是否一致 |

安装器的 lock 记录可以帮助检查来源变化，但它不能替代源码提交、发布版本、更新 Diff 和回滚策略。需要更强治理时，应在安装前展示 `SKILL.md`、脚本、依赖和权限变化，并保留上一版本用于回退。

## 常见误区

### 把安装目录当成源码仓库

安装目录没有上游合并语义。直接修改后重新安装，变化会被上游内容覆盖。应修改真正的源码仓库，再重新部署。

### 认为重新安装只是复制同名文件

安装器会先清理目标目录。这能删除上游已经移除的文件，但也意味着任何额外本地文件都会消失。

### 认为 symlink 一定指向原始仓库

symlink 通常指向安装器维护的 canonical copy，不一定指向开发者正在编辑的 Git 工作区。

### 把 `npx` 下载的 CLI 版本当成 Skill 版本

`skills@1.5.23` 是安装器版本，Skill 内容来自另一个仓库和提交。两套版本生命周期相互独立。

### 认为 update 一定保持原安装模式

当前实现会重新调用 `add`。当 copy 或 symlink 是部署契约的一部分时，更新后应显式验证，而不是只检查内容是否变新。

## 安全边界

Skill 不只有 Markdown 指令，还可能包含脚本、参考资料、依赖声明和工具调用要求。重新安装远端 Skill 等于接受一份新的可执行工作流定义。

在受控环境中，建议至少做到：

- 更新前查看来源 commit 和内容 Diff；
- 单独审查 `scripts/`、依赖和新增权限；
- 不从未经确认的移动分支自动更新；
- 安装后验证目标路径、目录类型和关键文件；
- 保留上一版本的来源标识，以便快速回滚。

## 公开参考

- [Vercel Skills CLI README](https://github.com/vercel-labs/skills/blob/435076e78988e1e6ec40d00b0b1d76bdbbc5419a/README.md)
- [Skills CLI 安装器源码](https://github.com/vercel-labs/skills/blob/435076e78988e1e6ec40d00b0b1d76bdbbc5419a/src/installer.ts)
- [Skills CLI 添加流程源码](https://github.com/vercel-labs/skills/blob/435076e78988e1e6ec40d00b0b1d76bdbbc5419a/src/add.ts)
- [更新后安装模式可能变化的问题记录](https://github.com/vercel-labs/skills/issues/1199)

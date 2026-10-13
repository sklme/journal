---
title: pnpm 原生发布管理：定位、Changesets 差异与选型建议
date: 2026-10-13
tags:
  - pnpm
  - Changesets
  - Monorepo
  - 版本管理
description: 理解 pnpm 原生变更记录、版本计算和发布能力，比较 Changesets 的配置、预发布与自动化边界，并给出接入和迁移建议。
---

# pnpm 原生发布管理：定位、Changesets 差异与选型建议

**对于已经统一使用 pnpm、发布规则相对简单的包仓库，可以优先采用 pnpm 原生发布管理。** 它已能承担变更记录、工作区版本计算、依赖联动、变更日志和包发布，不必为了这些基础能力再安装 Changesets CLI。已有 Changesets 项目则应先对照发布计划和预发布需求，确认迁移收益。

本文核对日期为 **2026-10-13**，调研版本为 **pnpm 12.11.2、Changesets CLI 3.0.3**。原生工作区发布管理从 pnpm **11.13.0** 加入；本文使用的 `pnpm change check` 从 **12.4.0** 加入。升级工具时应重新核对命令和默认行为。[pnpm 发布管理](https://pnpm.io/versioning)、[pnpm change](https://pnpm.io/cli/change)

## 要解决的问题：包管理器能否同时负责版本发布

多包仓库的一次发布通常包含几类不同工作：

| 工作 | 要回答的问题 | 应由谁负责 |
| --- | --- | --- |
| 变更意图 | 哪些包变了，应该升 patch、minor 还是 major？ | 开发者与代码评审 |
| 版本计算 | 哪些依赖方要跟着升级，哪些包必须保持同版本？ | 版本管理工具 |
| 版本产物 | 如何更新 manifest、依赖范围和 changelog？ | 版本管理工具与包管理器 |
| 包发布 | 哪些版本尚未上传，使用哪个 registry 和 dist-tag？ | 包管理器或发布工具 |
| 交付验证 | 构建是否正确，发布后能否安装，下游是否兼容？ | 项目的测试与 CI 流程 |

pnpm 的新能力把中间几项纳入同一工具。开发者仍然需要判断变更的语义，项目仍然需要测试、发包权限、CI 编排和发布后的安装验证。是否只用 pnpm，取决于这些职责能否组合成符合项目要求的流程。

## 设计定位：兼容变更文件，提供原生发布引擎

先区分两个容易混用的概念：

- **changeset 文件**：一段可提交到 Git 的变更说明，记录包名、版本变更级别和正文。
- **Changesets 工具链**：读取这些文件的 CLI，以及它自己的配置、预发布状态、changelog 扩展和自动化集成。

pnpm 原生读取和写入 `.changeset/*.md`，不需要安装 `@changesets/cli`。例如，一条变更可以这样表达：

```md
---
"@example/parser": patch
---

修复空输入导致的解析失败。
```

文件格式兼容，意味着现有的变更说明可以继续利用；发布规则则由 pnpm 自己执行，配置位于 `pnpm-workspace.yaml` 的 `versioning` 下。因此，迁移需要核对配置与状态，而不仅是把命令名称替换掉。[pnpm 与 Changesets](https://pnpm.io/using-changesets)、[pnpm 版本配置](https://pnpm.io/settings/versioning)

命令名称也要分清：`pnpm change` 是 pnpm 的原生命令；`pnpm exec changeset` 执行的是项目安装的 Changesets CLI。

## pnpm 已覆盖哪些能力

| 阶段 | 原生命令或配置 | 结果 |
| --- | --- | --- |
| 记录变更 | `pnpm change` | 将发布意图与代码一起提交 |
| 查看计划 | `pnpm change status` | 看到待处理变更及预计升级的包 |
| 检查版本约束 | `pnpm change check` | 检查 manifest 中的版本是否满足 fixed 分组与 epic 规则 |
| 预演版本 | `pnpm version -r --dry-run` | 在写入前查看发布计划 |
| 应用版本 | `pnpm version -r` | 更新版本、依赖、变更日志和消费记录 |
| 管理预发布 | `pnpm lane` | 将指定包切换到命名预发布轨道 |
| 上传包 | `pnpm publish -r` | 发布工作区中尚未存在于 registry 的版本 |

这些命令分别解决记录、计算和分发问题，可以按项目需要接入 CI。[change](https://pnpm.io/cli/change)、[version](https://pnpm.io/cli/version)、[lane](https://pnpm.io/cli/lane)、[publish](https://pnpm.io/cli/publish)

`pnpm change check` 需要特别说明：它检查的是已经写入 manifest 的版本约束，不能单独证明“这个 PR 的每项代码变更都写了 changeset”，也不能检查 API 的语义兼容性。需要强制变更说明时，应另设 PR 规则。[检查已提交版本](https://pnpm.io/cli/change#check)

## 与 Changesets 的主要差异

| 比较项 | pnpm 原生发布管理 | Changesets CLI |
| --- | --- | --- |
| 工具定位 | 与 pnpm 工作区和发布命令一体化 | 独立的版本与变更说明工具链 |
| 变更输入 | 兼容 `.changeset/*.md` | 使用 `.changeset/*.md` |
| 配置入口 | `pnpm-workspace.yaml` 的 `versioning` | `.changeset/config.json` |
| 同版本发布 | `versioning.fixed` | `fixed`；另有不同语义的 `linked` |
| 变更日志 | 默认存入发布包，可选提交到仓库 | 默认生成包内 changelog，可配置生成器 |
| 消费状态 | 使用提交到 Git 的 `ledger.yaml` 记录 | 使用自身的变更文件消费和预发布状态机制 |
| 预发布模型 | 包级 lane，允许工作区内不同发布轨道并存 | 通过 `pre enter`、`pre exit` 切换预发布模式 |
| 临时快照 | 本文核对的原生命令没有 Changesets 式 `--snapshot` 流程 | 有专门的 snapshot 版本与发布流程 |
| 自动化接入 | 用原生命令组织项目自己的 CI | 可沿用 Changesets Action、Bot 和 changelog 扩展 |

配置和基础行为依据：[pnpm 版本配置](https://pnpm.io/settings/versioning)、[Changesets 配置](https://changesets.dev/guide/config)。预发布和快照差异见下文。

### 同版本发布：fixed 可以对应，linked 不能直接照搬

如果 `@example/parser` 与 `@example/cli` 总是作为一套 SDK 交付，可以使用 fixed：其中一个包需要发布，整组采用共同版本。

Changesets 的 `linked` 则允许组内包参考共享版本基线，但不会因为某个包升级就强制所有成员一起发布。迁移时把 `linked` 改成 `fixed`，会扩大每次发布的包集合，应先判断这是否符合交付契约。[Changesets Fixed Packages](https://changesets.dev/guide/fixed-packages)、[Changesets Linked Packages](https://changesets.dev/guide/linked-packages)

### changelog：要在 Git 中评审，就显式选择 repository

pnpm 默认的 `registry` 模式在发布时组装 changelog 并放入 tarball；希望版本 PR 直接展示每个包的变更日志，应配置：

```yaml
versioning:
  changelog:
    storage: repository
```

这能让版本号、变更说明和代码一起接受评审。原先使用 Changesets 自定义 changelog 生成器的项目，还需要单独核对格式、贡献者和链接等要求，不能假设插件自动迁移。[pnpm changelog 存储](https://pnpm.io/settings/versioning#versioningchangelogstorage)、[Changesets changelog 配置](https://changesets.dev/guide/config#changelog)

### ledger：记录变更已经被哪个包的哪个版本消费

pnpm 将变更消费信息写入 `.changeset/ledger.yaml`，按包与版本记录处理过的 intent。它为分支合并、回合并以及不同发布轨道提供去重依据，应与版本修改一起提交。迁移后不要让两个引擎轮流处理同一组待发布文件，它们并不共享完整的发布状态模型。[pnpm ledger](https://pnpm.io/versioning#the-ledger)

### 预发布：lane 和 snapshot 满足不同需求

需要持续打磨某个未来版本，例如依次交付 `1.4.0-alpha.0`、`1.4.0-alpha.1`，适合使用 pnpm lane。lane 按包配置；fixed 组中的成员需要一起切换。Changesets 则有自己的预发布模式和状态文件，迁移时应先完成当前预发布周期，或专门验证状态转换。[pnpm lane](https://pnpm.io/cli/lane)、[Changesets Prereleases](https://changesets.dev/guide/prereleases)

“让每个 PR 或每次提交都生成一个临时可安装版本”是另一类需求。Changesets 提供 `version --snapshot`，默认使用 `0.0.0-<tag>-<datetime>` 一类版本，适合预览包。该命令会修改工作副本中的版本，应在独立的分支、工作目录或 CI 检出中执行。[Changesets Snapshot Releases](https://changesets.dev/guide/snapshot-releases)

如果选择只用 pnpm，仍然可以为临时版本添加一层很薄的项目脚本，但需要明确版本生成、包间依赖、重复执行和 dist-tag 规则。lane 的存在并不意味着已获得逐提交快照策略。

还要区分两种时间：Changesets 模板中的 `{timestamp}` 来自**发布时刻**，并非提交时间。因此，同一提交重复构建可能产生不同版本。需要“一次提交对应一个固定版本”时，应自行定义确定性的命名策略。[Changesets snapshot 配置](https://changesets.dev/guide/config#snapshot)

## 推荐接入方式：先建立一条简单的稳定发布流程

下面以两个需要同版本交付的公开包为例。`@example/parser` 和 `@example/cli` 均为示例名称。

### 1. 固定工具版本和包的关系

在根 `package.json` 中固定经过验证的 pnpm 版本，避免本地与 CI 使用不同的发布语义：

```json
{
  "private": true,
  "packageManager": "pnpm@12.11.2"
}
```

配置 `pnpm-workspace.yaml`：

```yaml
packages:
  - packages/*

versioning:
  fixed:
    - ['@example/parser', '@example/cli']
  changelog:
    storage: repository
```

只有必须整套交付的包才放入 fixed。可独立演进的包保持独立版本，避免为了配置整齐扩大发布范围。需要 workspace 依赖时，显式使用 `workspace:` 协议，并检查打包后的依赖范围。

### 2. 让变更说明进入日常代码评审

修复解析器后记录 intent：

```bash
pnpm change --bump patch --summary '修复空输入导致的解析失败' @example/parser
pnpm change status
pnpm change check
```

把生成的 `.changeset/*.md` 与实现一起提交。评审者同时确认代码行为、版本级别和对使用者的说明，发布时无需重新从提交历史推断影响。

假设这两个包的 `1.2.0` 已发布，并且本次只有这一项 patch 变更，fixed 规则会让两者一起进入 `1.2.1`。**首次发布需要另看初始版本**：pnpm 从 11.16.0 起会查询 registry，对尚未发布的当前版本按 manifest 原值首发。因此，不应把“新包写成 `0.0.0`，加一个 minor intent 就一定首发 `0.1.0`”当成默认规则。[pnpm 首次发布](https://pnpm.io/versioning#first-releases)

### 3. 生成可评审的版本修改

从包含变更说明的干净检出开始：

```bash
pnpm version -r --dry-run
pnpm version -r
pnpm install --lockfile-only --no-frozen-lockfile
pnpm change check
```

检查版本、包间依赖、changelog、ledger 和 lockfile，再运行项目已有的测试与构建。递归 `version` **不会自动创建 Git commit 或 tag**，所以应由项目流程提交这些修改，并明确何时创建发布标签。[pnpm version](https://pnpm.io/cli/version)

这种分步方式便于区分“版本计划有误”和“构建或上传失败”，也便于先通过版本 PR，再由受控任务发包。

### 4. 发布后验证消费者实际能安装的包

在版本提交通过测试、registry 与权限均已配置后，执行稳定版本发布：

```bash
pnpm publish -r --tag latest --report-summary
```

预发布使用明确的测试 dist-tag，例如 `alpha`，避免将试用版本指向稳定入口。保留发布摘要，并用一个干净的消费项目安装**精确版本**，运行最小导入和功能检查。[pnpm publish](https://pnpm.io/cli/publish)

测试应用和镜像构建也应使用精确包版本与 lockfile。`alpha`、`dev` 等标签方便发现新包，但标签会移动，单靠它无法定位某次构建究竟安装了哪一份产物。

## 能否直接从 Changesets 换过来

### 推荐优先只用 pnpm 的情况

- 项目已经统一使用较新的 pnpm，团队愿意固定并维护工具版本。
- 主要需求是变更说明、独立版本或 fixed 组、常规预发布与 npm 包发布。
- CI 流程较简单，尚未深度依赖 Changesets Action、Bot 或自定义 changelog 插件。
- 希望减少发布依赖，同时保留可评审的变更文件。

这些条件下，pnpm 原生方案可以作为默认选择。即使需要少量包装脚本，也应让脚本只负责项目特有的构建、校验和编排，把通用版本计算留给工具。

### 继续使用 Changesets 有价值的情况

- 多个仓库使用不同包管理器，希望共享独立的发布工具约定。
- 已经有稳定的 Changesets 自动化、插件或快照发布流程。
- 使用 `linked`、复杂内部依赖规则或特殊 changelog，需要保持原有语义。
- 当前预发布周期尚未结束，切换状态模型的收益不足以抵消验证成本。

是否迁移应比较**少维护了什么**与**需要重新验证什么**。仅减少一个开发依赖，并不足以证明替换已有稳定流程值得。

### 迁移顺序

1. **盘点现状**：记录 fixed、linked、ignore、私有包版本规则、依赖联动、预发布和快照需求，以及 CI 如何消费这些状态。
2. **在独立检出中配置 pnpm**：保留已有变更说明，显式设置 changelog 存储；逐项映射配置，未找到等价项的规则单独处理。
3. **对照发布计划**：用同一组输入分别运行两套工具，比较版本、发布包集合、依赖范围和日志内容，不在同一个工作副本连续消费。
4. **验证消费与重跑**：检查第二次执行是否重复升级，包产物能否被干净项目安装，以及首次发布与部分发布后的处理结果。
5. **切换唯一入口**：确认符合预期后，再移除 Changesets CLI、旧状态处理和 CI 入口；把必要的版本提交、标签和发布记录接入新流程。

配置同名也不保证语义一致。例如，pnpm 的 `ignore` 是从版本计算和依赖传播中排除包；Changesets 将 `ignore` 定位为临时跳过发布。两边对私有包的版本处理默认值也不同，应放入对照用例。[pnpm ignore](https://pnpm.io/settings/versioning#versioningignore)、[pnpm 私有包行为](https://pnpm.io/cli/version#recursive-releases)、[Changesets 配置](https://changesets.dev/guide/config)

## 验证依据与成熟度边界

本次调研结合官方文档、命令帮助和隔离的多包样本。样本验证了 fixed 组统一版本、变更日志与 ledger 生成，以及已消费意图不会在紧接着的重复执行中再次升级；Changesets 对照覆盖了 fixed 与 snapshot 的版本生成。**这些结果证明基础版本流程可用，不能推导出任意 registry、复杂依赖图和 CI 组合都已验证。**

在具体仓库采用前，可以保留以下小规模验收矩阵：

| 场景 | 应检查的结果 |
| --- | --- |
| 只修改 fixed 组中的一个包 | 整组版本一致，发布范围符合约定 |
| 修改被依赖包 | 依赖方是否升级、范围如何改写，与发布契约一致 |
| 从预发布转为稳定版 | 版本基线、包间依赖和 dist-tag 正确 |
| 包当前版本尚未发布 | 首发采用的版本符合预期 |
| 重复版本计算或恢复部分发布 | 不重复消费意图，不覆盖已发布版本 |
| 从 registry 安装精确版本 | 文件完整、入口可加载、声明可用、依赖可解析 |

私有包适合无发包的版本计算实验，但它们会跳过首次发布的 registry 查询，不能代表可发布包的完整行为。远端验收应使用专门的测试包。

registry 兼容性属于另一层：递归发布可能部分成功；上传后查询暂时不可见，也不代表上传没有发生。pnpm 的发布等待选项可以检查元数据和 tarball 的可访问性，但需要完整产物校验时，仍要下载并验证。`--batch` 还要求 registry 支持专用协议，不能作为通用 npm 服务的默认前提。[pnpm 发布选项](https://pnpm.io/cli/publish)

因此，可以把 pnpm 定位为**具备完整基础发布能力、适合按项目验证后采用的原生方案**。新项目优先试用，已有项目按迁移成本决策；不要把“功能已内置”直接等同于所有发布场景都能无差异替换。

## 公开参考

- [pnpm：Release management](https://pnpm.io/versioning)
- [pnpm：Using Changesets with pnpm](https://pnpm.io/using-changesets)
- [pnpm：change](https://pnpm.io/cli/change)、[version](https://pnpm.io/cli/version)、[lane](https://pnpm.io/cli/lane)、[publish](https://pnpm.io/cli/publish)
- [pnpm：Versioning Settings](https://pnpm.io/settings/versioning)
- [Changesets：Configuration File](https://changesets.dev/guide/config)
- [Changesets：Fixed Packages](https://changesets.dev/guide/fixed-packages)、[Linked Packages](https://changesets.dev/guide/linked-packages)
- [Changesets：Prereleases](https://changesets.dev/guide/prereleases)、[Snapshot Releases](https://changesets.dev/guide/snapshot-releases)

[返回工程基础](/knowledge/topics/engineering-foundations/#package-releases)

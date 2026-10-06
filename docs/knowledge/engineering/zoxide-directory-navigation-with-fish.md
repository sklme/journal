---
title: zoxide 与 fzf：Fish 目录导航与交互搜索实践
date: 2026-10-05
tags:
  - macOS
  - Terminal
  - Fish
  - zoxide
  - fzf
description: 安装 zoxide 与 fzf 并接入 Fish，使用 z 和 zi 切换目录，通过快捷键选择文件、搜索历史，并统一交互配色。
prev:
  text: "01 · 终端基础"
  link: /knowledge/engineering/ghostty-fish-starship-terminal-workflow
next:
  text: "03 · 文件浏览"
  link: /knowledge/engineering/eza-file-browsing-with-fish
---

# zoxide 与 fzf：Fish 目录导航与交互搜索实践

> [现代终端工作流 · 系列目录](./index.md#terminal-workflow) · 第 2 / 6 篇：导航与选择

终端里经常需要在几个项目之间切换。项目目录一深，重复输入完整路径就成了额外负担。zoxide 会记住访问过的目录，让之后的跳转只需要几个关键词。

本篇承接[用 Ghostty、Fish 和 Starship 创建终端工作流](./ghostty-fish-starship-terminal-workflow.md)，分两步建立目录导航与交互选择：**第一次访问用 `cd`，之后用 `z` 快速返回；候选较多时用 `zi` 自己选择**。随后把 fzf 接入文件选择和历史检索。配置保持 `cd` 原有行为。

本文示例以 macOS、Homebrew 和 Fish 为基础，验证版本为 zoxide 0.10.0、fzf 0.74.4、Fish 4.9.3。Ghostty 和 Starship 可以继续使用现有配置，zoxide 也可以在其他终端应用中工作。

## 1. 为什么选择 zoxide

为常用目录写别名，需要自己维护“缩写 → 完整路径”的对应关系。zoxide 通过访问记录积累目录，再从匹配结果中选出更常用、最近使用过的目标，适合经常切换项目的工作方式。

| 场景 | 使用方式 | 好处 |
| --- | --- | --- |
| 反复进入较深的项目目录 | `z 项目名` | 减少完整路径输入 |
| 多个项目都有 `api` 目录 | `z 项目名 api` | 用上下文区分同名目录 |
| 临时离开项目后返回 | `z -` | 在前后两个目录之间切换 |
| 记得部分路径，不确定目标 | `zoxide query -l 关键词` | 先查看候选，再决定跳转 |

zoxide 查询的是已记录目录，不会搜索整个磁盘。它适合“回到曾经去过的地方”；第一次寻找未知目录时，仍需要路径补全或文件搜索工具。[官方介绍与用法](https://github.com/ajeetdsouza/zoxide#readme)

## 2. 安装并接入 Fish

### 用 Homebrew 安装

在已有终端中运行：

```sh
brew install zoxide
zoxide --version
brew list --versions zoxide
```

Homebrew 负责程序的安装与更新，Fish 配置负责启用目录记录和 `z` 命令。只安装程序，还不能在当前 Shell 中直接使用 `z`。

若提示找不到 `brew` 或 `zoxide`，先确认 Homebrew 的环境已初始化；基础教程中的 `brew shellenv fish | source` 会处理工具路径。

### 在 Fish 配置末尾添加初始化

编辑 `~/.config/fish/config.fish`，在已有初始化之后加入以下内容，仅保留一处：

```fish
# 目录导航：记住访问过的目录，通过 z 关键词跳转。
if status is-interactive
    if type -q zoxide
        zoxide init fish | source
    end
end
```

如果文件末尾已有 `if status is-interactive` 区块，可以把内部的 `if type -q zoxide ... end` 放进去。保留既有 Homebrew、Starship 和其他工具配置，不要用这个片段覆盖整个文件。

这个区块做了三件事：

- 仅在交互 Shell 中启用目录导航。
- 找得到 zoxide 时才执行初始化，避免卸载程序后启动报错。
- 注册 `z` 命令与目录变化钩子，让普通 `cd` 也能贡献记录。

这里采用官方的 [Fish 初始化方式](https://github.com/ajeetdsouza/zoxide#installation)，没有使用会替换 `cd` 的 `--cmd cd`。

### 让当前窗口生效

以下命令在 Fish 中执行：

```fish
fish --no-execute ~/.config/fish/config.fish
source ~/.config/fish/config.fish
type z
```

第一条检查语法，第二条加载配置，第三条应显示 `z` 是一个 Fish 函数。新开的 Fish 窗口也会自动加载，不需要额外修改 Ghostty 或 Starship。

到这里，普通 `z` 跳转已经可以使用。[第 7 节](#fzf-setup)继续安装 fzf，启用 `zi` 和 Fish 交互搜索；想先熟悉目录记忆，也可以完成前六节后再接入。

## 3. 三分钟体验：进入、记住、返回

在已经加载配置的 Fish 窗口中执行：

```fish
cd ~/Documents
cd ~/Downloads
z Documents
pwd
z -
pwd
```

预期过程：

1. 前两次 `cd` 让 zoxide 记录目录。
2. `z Documents` 返回文档目录。
3. `z -` 返回刚才的下载目录。

`z -` 的含义是上一个工作目录，不是上一次执行 `z` 的目标。因此，即使中间使用的是普通 `cd`，也可以返回。

随后照常工作即可。数据库从使用过程积累记录，没必要提前导入所有目录。Fish 私密模式下，当前版本的集成不会自动记录目录变化；日常学习记录应在普通会话中验证。

## 4. 常用命令速查

### 日常跳转

| 命令 | 含义 |
| --- | --- |
| `z project` | 跳到已记录目录中最匹配 `project` 的目标 |
| `z shop api` | 使用多个关键词缩小匹配范围 |
| `zi` | 安装 fzf 后，从已记录目录中交互选择 |
| `zi api` | 安装 fzf 后，从匹配 `api` 的目录中选择 |
| `z -` | 返回上一个工作目录 |
| `z ..` | 返回上一级，也可继续用 `cd ..` |
| `z` | 回到用户主目录 |
| `z ./api` | 按明确路径进入当前目录下的 `api` |
| `z "/path/to/My Project"` | 进入含空格的明确路径 |

### 查询和维护记录

| 命令 | 含义 |
| --- | --- |
| `zoxide query project` | 查询匹配目标，不改变当前目录 |
| `zoxide query -l project` | 列出所有匹配目标 |
| `zoxide query -ls` | 列出目录及评分 |
| `zoxide add /path/to/project` | 添加记录，已有记录则提高其排名 |
| `zoxide remove /path/to/project` | 移除记录，不删除实际文件夹 |

`/path/to/...` 是占位路径，使用时需要换成真实存在的目录。`query`、`add` 和 `remove` 的参数可分别通过 `zoxide <子命令> --help` 查看。

## 5. 关键词如何匹配

理解下面几条规则，就能减少跳错目录的情况：

- 关键词匹配不区分大小写，可以使用目录名的一部分。
- 多个关键词按它们在完整路径中出现的顺序匹配。
- 最后一个关键词的最后一段，要匹配目标目录的最后一级。
- 多个目录都匹配时，排名综合访问频率和最近访问时间。

例如，已记录 `/path/to/shop/api` 时，`z shop api` 可以匹配它；`z api shop` 不符合路径顺序。单独使用 `z shop` 也不会把这个 `api` 子目录当作 `shop` 目录。[官方匹配与排序规则](https://github.com/ajeetdsouza/zoxide/wiki/Algorithm)

另外有两点容易混淆：

**明确存在的路径优先。** 当前目录下如果就有名为 `api` 的文件夹，`z api` 会按路径进入它。想访问其他项目的同名目录时，使用更具体的组合，例如 `z blog api`。

**查询结果不总与跳转结果相同。** 关键词跳转会排除当前目录，而普通 `zoxide query` 不会自动排除；加上路径优先规则，二者在某些位置执行时可能给出不同结果。需要模拟关键词跳转的查询时可以用：

```fish
zoxide query --exclude "$PWD" blog api
```

这条命令仍只查询，不实际跳转。

## 6. 常见使用场景

### 场景一：在两个项目的 API 目录之间切换

下面使用独立的示例目录，不需要真实业务项目。若主目录下已有同名 `zoxide-demo`，可先换一个示例名称。

```fish
mkdir -p ~/zoxide-demo/shop/api ~/zoxide-demo/blog/api
cd ~/zoxide-demo/shop/api
cd ~/zoxide-demo/blog/api
cd ~

z shop api
pwd
z blog api
pwd
z -
pwd
```

前两次跳转应分别进入 `shop/api` 和 `blog/api`，最后返回 `shop/api`。如果数据库中已有其他相同关键词的路径，可以进一步限定：

```fish
z zoxide-demo blog api
```

实际工作中可以把 `shop`、`blog` 换成项目目录名。尽量使用能区分项目的名称，不要只用 `src`、`api` 或单个字母。

### 场景二：不确定目标，先看候选

```fish
zoxide query -l api
```

确认候选后，再组合关键词：

```fish
z blog api
```

这个方法适合多个项目同时开发、旧目录仍保留记录的情况。误跳时可用 `z -` 返回，再调整关键词。

### 场景三：目录名包含空格或中文

```fish
mkdir -p "$HOME/zoxide-demo/示例项目/My Notes"
cd "$HOME/zoxide-demo/示例项目/My Notes"
cd ~

z 示例项目 "My Notes"
pwd
```

路径里有空格时，用引号把它作为一个参数传入。中文可以直接作为匹配关键词，无需改名或额外插件。

### 场景四：为常用项目预先登记

已经知道完整路径，希望以后直接用关键词进入时，可以手动登记：

```fish
zoxide add "/path/to/project"
```

这只修改目录记录，不改变当前工作目录。适合少量确定会使用的项目；大批加入从未使用的目录会让候选列表变得嘈杂。

### 场景五：清理不再需要的记忆

```fish
zoxide remove "/path/to/old-project"
```

这不会删除文件夹，也不是永久屏蔽：之后再次进入该目录，自动记录仍可能把它加回来。项目移动或改名后，先用 `cd` 进入新位置，再视需要删除旧记录。

## 7. 安装 fzf，启用交互选择 {#fzf-setup}

### 先分清 z、zi 和 fzf

| 入口 | 候选从哪里来 | 确认后做什么 |
| --- | --- | --- |
| `z api` | zoxide 的目录记录，或明确存在的路径 | 自动进入匹配目标 |
| `zi api` | zoxide 的目录记录 | 用 fzf 展示候选，选中后跳转 |
| `fzf` | 默认遍历当前目录；有管道输入时读取管道候选 | 输出选中的文本或路径 |
| Fish 的 fzf 快捷键 | 文件遍历或 Fish 命令历史 | 按快捷键用途插入文本或切换目录 |

**fzf 是独立工具，zi 是使用它的一个入口。** zoxide 负责目录记忆和跳转，fzf 负责显示选择界面。`zi` 不是另一个要安装的软件包，也不会因此搜索整个磁盘。

### 安装程序

```sh
brew install fzf
fzf --version
```

zoxide 已初始化、`fzf` 能在 PATH 中找到时，`zi` 就能调用它。**`zi` 不依赖 `fzf --fish` 初始化**；后者用于启用 Fish 的快捷键和补全集成。[zoxide 可选依赖说明](https://github.com/ajeetdsouza/zoxide#installation)

### 合并 Fish 集成与配色

在 `~/.config/fish/config.fish` 中，将前面单独的 zoxide 初始化区块替换为下面的组合区块。放在 Homebrew 环境初始化之后；已有 Starship 初始化时，接在其后即可。每种初始化只保留一处。

```fish
if status is-interactive
    # fzf：统一界面和 Fish 快捷键。
    if type -q fzf
        set -gx FZF_DEFAULT_OPTS (string join ' ' -- \
            '--height=40% --layout=reverse --border=rounded --info=inline' \
            '--color=fg:#e0def4,bg:-1,hl:#8cf0a4,fg+:#e0def4,bg+:#403d52,hl+:#8cf0a4,border:#a29db8,info:#a29db8,prompt:#d8b4fe,pointer:#7ddcff,marker:#ffe08a,spinner:#d8b4fe,header:#7ddcff')
        set -gx FZF_CTRL_T_OPTS '--walker-skip=.git,node_modules,target'
        set -gx FZF_ALT_C_OPTS '--walker-skip=.git,node_modules,target'
        fzf --fish | source
    end

    # zoxide：z 自动跳转，zi 使用 fzf 选择目录。
    if type -q zoxide
        zoxide init fish | source
    end
end
```

这是一份可独立合并的基础配置。若已经设置过 `FZF_DEFAULT_OPTS` 或快捷键选项，应先合并已有参数，避免直接覆盖个人偏好。

配色延续基础终端主题：匹配字符亮绿，输入提示亮紫，选中标记亮青；`bg:-1` 沿用终端背景，选中行使用深紫背景。列表默认从上往下排列，普通选择界面使用终端高度的 40%。zoxide 和 Shell 集成还会附加自己的界面参数、最小高度等，最终大小以相应入口为准。

`FZF_CTRL_T_OPTS` 与 `FZF_ALT_C_OPTS` 让文件和子目录选择跳过 `.git`、`node_modules`、`target`。它们不影响 zoxide 已记录目录，也不等于按项目 `.gitignore` 过滤所有候选。本篇无需额外安装 `fd`、`ripgrep`、`bat` 或 Fish 插件管理器。

保存后，在 Fish 中运行：

```fish
fish --no-execute ~/.config/fish/config.fish
source ~/.config/fish/config.fish
type zi
```

接入后 `Ctrl + R` 改用 fzf 历史搜索。普通 `Tab`、自动建议和 `↑` / `↓` 仍沿用 Fish 行为。验证版本的官方集成还提供 `Shift + Tab` 模糊补全；在已有补全菜单中则保留相应的菜单行为。[Fish 集成说明](https://junegunn.github.io/fzf/shell-integration/)

### 操作选择界面

| 操作 | 作用 |
| --- | --- |
| 输入关键词 | 持续筛选候选 |
| `↑` / `↓` | 移动到其他候选 |
| `Enter` | 确认选中项，由调用入口执行后续动作 |
| `Esc` 或 `Ctrl + C` | 取消选择 |

进入选择界面后，关键词按 fzf 的搜索规则解释，不要将其与前面 `z` 的路径匹配规则混为一谈。比如在 `zi` 列表中输入 `blog api`，可以进一步筛选显示的路径；在 Shell 中输入的 `zi api` 则先限定目录候选。

## 8. zi 与 fzf 的使用场景

### 场景一：几个项目都有 api，让自己来选

完成前面的示例目录访问后运行：

```fish
zi api
```

界面中应能看到符合条件的已记录目录。继续输入 `blog` 缩小范围，选中 `blog/api` 后按 `Enter`，再运行 `pwd` 确认位置。

直接运行 `zi` 可以浏览已记录目录，不必预先知道关键词。它适合项目名只记得一部分、多个目录同名，或者不想依赖自动排名的情况。按 `Esc` 取消时，当前目录保持不变。

### 场景二：在当前项目内找子目录

在命令行为空时按 **左 Option + C**，输入目录名，再按 `Enter` 进入。

这里通过 fzf 遍历当前目录下的子目录，不要求它们事先进入 zoxide 数据库。与 `zi` 的区别是：**`zi` 从访问记录找目录，Option + C 从当前文件树找目录。** 当前输入含路径时，集成也可能据此选择搜索起点；初次练习可先清空输入行。

在 Ghostty 中，需要 `macos-option-as-alt = left` 才能将左 Option 作为 Alt 使用；基础教程已经给出这项配置。

### 场景三：找文件并把路径放进命令

准备阅读某个文本文件时，在命令行输入 `cat `，先不要回车，再按 **Ctrl + T**。输入文件名片段，选中后按 `Enter`。

选中的路径会填入命令行，包含空格的路径会被正确转义。此时仍可以检查或修改命令，再按回车执行。这个过程只用来选择参数，不会自动打开编辑器或执行 `cat`。

只想找文件路径，也可以独立运行：

```fish
fzf
```

在 Git 项目中只选择已跟踪文件，可以运行：

```fish
git ls-files -z | fzf --read0 --print0 | string split0
```

这里用 NUL 分隔传递路径，避免把文件名中的换行拆成不同候选。选中后输出路径，不会自动打开文件。

### 场景四：找一条以前执行过的长命令

按 **Ctrl + R**，输入记得的命令名或参数片段，等候选加载后选择结果。

在选择界面按 `Enter` 后，命令会回到 Fish 输入行，**不会立即执行**。可以先修改目录、参数或目标，再按回车运行。取消时保留原来的输入。

独立使用下面的管道也可以检索历史，但它只输出选择结果，不会像快捷键那样放回当前输入行：

```fish
history | fzf
```

这条最小示例按行提供候选；包含多行的历史命令优先使用官方 `Ctrl + R` 集成，让它处理完整历史条目。

### 场景五：把任意候选变成一个选择菜单

```fish
printf '%s\n' apple banana orange | fzf
```

输入 `ora`，选中后终端输出 `orange`。这说明 fzf 可以处理任意按行提供的文本，不局限于文件或目录。

例如，只查看并选择一个本地 Git 分支名：

```fish
git branch --format='%(refname:short)' | fzf
```

这条命令只返回选择结果，不切换分支。将选择结果交给下一条命令时，应先检查是否取消选择，再决定是否执行。

这些例子都遵循同一种组合方式：**上游提供候选，fzf 完成筛选，下游决定动作**。按文件路径筛选与搜索文件内容是两件事；代码内容搜索需要由 `ripgrep` 等工具提供命中结果，本篇暂不扩展。[fzf 独立用法](https://github.com/junegunn/fzf#usage)

## 9. 遇到问题怎么排查

| 现象 | 可能原因 | 处理方式 |
| --- | --- | --- |
| `zoxide` 找不到 | 程序未安装或 Homebrew 路径未加载 | 检查 `brew list --versions zoxide`、`type -a zoxide` |
| `z` 找不到 | 当前窗口尚未初始化 | 在 Fish 中重新加载配置，或新开窗口 |
| `no match found` | 目录未记录，或关键词不匹配 | 先用 `cd` 进入一次，再用 `zoxide query -l` 检查 |
| 关键词跳到了其他项目 | 关键词过宽，或存在同名相对路径 | 增加项目关键词；需要确定路径时使用 `cd` |
| 当前目录明明有记录，仍提示无匹配 | 关键词跳转排除了当前目录，且无其他候选 | 当前已在目标目录，无需再次跳转 |
| 目录始终学不会 | 私密模式，或自动记录钩子未加载 | 用普通 Fish 会话重新加载配置并验证 |
| `zi` 提示缺少 `fzf` | fzf 未安装或不在 PATH 中 | 检查 `fzf --version`、`type -a fzf`，按第 7 节安装 |
| `zi` 列表里没有目标目录 | zoxide 尚未记录目标，或启动关键词筛掉了它 | 先用 `cd` 访问；运行不带关键词的 `zi` 检查 |
| `Ctrl + R` 仍是原生历史界面 | 尚未加载 fzf 集成，或后续配置覆盖键位 | 新开窗口，检查 `bind ctrl-r` 是否指向 `fzf-history-widget` |
| 左 Option + C 输入了特殊字符 | 终端未将左 Option 作为 Alt | 检查 Ghostty 的 `macos-option-as-alt = left` |
| 文件或目录候选中没有依赖目录 | 配置的 walker 跳过了相应目录 | 检查 `FZF_CTRL_T_OPTS` / `FZF_ALT_C_OPTS`，需要时调整 skip 列表 |
| 其他终端或 SSH 会话不能使用 `z` | 该 Shell 或远端未安装、未初始化 | 在对应环境单独配置；本地配置不会自动传到远端 |

自查命令：

```fish
zoxide --version
type -a zoxide
type z
functions --query __zoxide_hook
echo $status
```

最后输出 `0` 表示钩子函数存在。要确认它真正记录了目录，还需用 `cd` 切换一次，再执行 `zoxide query -l` 查看结果。

## 10. 验收与使用边界

配置完成后按下面的顺序检查：

| 验收动作 | 预期结果 |
| --- | --- |
| 新开 Fish 窗口，执行 `type z` | `z` 函数已加载 |
| 用普通 `cd` 访问示例目录，再离开 | 查询列表中出现该目录 |
| 执行 `z shop api` | 跳到匹配目录 |
| 执行 `z -` | 回到前一个目录 |
| 使用中文和带空格的示例 | 路径完整且跳转正确 |
| 查询不存在的关键词 | 报告无匹配，工作目录不变 |
| 删除一条记录 | 文件夹仍存在，记录从查询中消失 |
| 执行 `zi`，筛选并确认 | 跳到选中的已记录目录 |
| 在 `zi` 中按 `Esc` | 工作目录不变 |
| 输入 `cat `，按 `Ctrl + T` 选择文件 | 路径插入命令行，没有自动执行 |
| `Ctrl + R` 选中历史命令 | 完整命令回到输入行，没有自动执行 |
| 空输入行按左 Option + C 选择子目录 | 进入该子目录 |

本篇实践使用独立测试数据库验证了自动记录、关键词跳转、多关键词匹配、返回上一目录、中文和空格路径，以及查询失败时不改变工作目录；同时确认初始化未替换原有 `cd`。fzf 集成进一步在独立测试数据库和私密 Fish 会话中验证了 `zi` 的选择与取消、中文及空格路径、`Ctrl + T` 路径插入、`Ctrl + R` 恢复历史但不执行，以及 Option + C 子目录跳转；新会话自动加载也已验证。

有三条使用边界需要保留：

- **脚本使用确定路径。** `z` 的结果依赖个人访问记录，自动化脚本和 CI 应继续使用明确的 `cd` 路径并处理失败。
- **目录记录属于本机用户数据。** macOS 默认存放在 `~/Library/Application Support/zoxide`；记录包含访问路径，不应直接当作公开配置文件上传。Fish 的命令历史与这份目录数据库是两种数据。
- **选择结果的后续动作由入口决定。** 独立 `fzf` 通常输出结果，`Ctrl + R` / `Ctrl + T` 写回命令行，`zi` / Option + C 则直接切换目录。先确认当前入口的行为，再按回车。

日常可以按目标选择入口：明确的常用目录用 `z`，多个历史目录中挑选用 `zi`，当前项目内找子目录用 Option + C，选择文件路径用 Ctrl + T，复用长命令用 Ctrl + R。

## 公开参考

- [zoxide 官方仓库：安装、Shell 接入、用法和环境变量](https://github.com/ajeetdsouza/zoxide)
- [zoxide 匹配与排序算法](https://github.com/ajeetdsouza/zoxide/wiki/Algorithm)
- [Homebrew：zoxide](https://formulae.brew.sh/formula/zoxide)

- [fzf 官方仓库：独立使用、搜索和配置](https://github.com/junegunn/fzf)
- [fzf Shell 集成：Fish 初始化与快捷键](https://junegunn.github.io/fzf/shell-integration/)

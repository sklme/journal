---
title: bat：终端文件阅读与 fzf 预览实践
date: 2026-10-06
tags:
  - macOS
  - Terminal
  - Fish
  - bat
  - fzf
description: 使用 Homebrew 安装 bat，沿用终端配色，通过语法高亮、分页搜索、指定行读取和 fzf 预览阅读配置与代码。
prev:
  text: "03 · 文件浏览"
  link: /knowledge/engineering/eza-file-browsing-with-fish
next:
  text: "05 · 搜索定位"
  link: /knowledge/engineering/fd-ripgrep-search-with-fish
---

# bat：终端文件阅读与 fzf 预览实践

> [现代终端工作流 · 系列目录](./index.md#terminal-workflow) · 第 4 / 6 篇：文件阅读

进入项目、找到文件之后，下一步是读懂内容。bat 为终端里的文本阅读增加语法高亮、行号、Git 修改标记和自动分页，适合快速检查配置和代码。

本文记录安装、最小配置和一套逐步练习的流程。前提是 macOS 已安装 Homebrew 和 Fish；fzf 只在预览练习中需要。

## 1. 为什么选择 bat

阅读配置时，颜色帮助区分注释、字符串与字段；根据报错定位代码时，行号和范围读取减少无关内容；文件较长时，分页器提供翻页与搜索。

在终端工作流中，几个工具各自负责一件事：

| 工具 | 用途 |
| --- | --- |
| `z` / `zi` | 进入项目目录 |
| eza / `ll` / `lt` | 看文件列表与目录结构 |
| bat | 阅读文件内容 |
| fzf | 筛选文件等候选项，可调用 bat 预览 |
| 编辑器 | 修改文件 |

完整的使用顺序是「进入项目 → 浏览文件 → 阅读内容 → 按需编辑」。前两步参考 [zoxide 与 fzf 实践](./zoxide-directory-navigation-with-fish.md) 和 [eza 文件浏览实践](./eza-file-browsing-with-fish.md)。

## 2. 通过 Homebrew 安装

```fish
brew install bat
bat --version
command -v bat
```

本文验证版本为 bat 0.26.1、Fish 4.9.3；安装时使用 Homebrew 当前提供的版本即可。以后通过同一个包管理器更新：

```fish
brew upgrade bat
```

bat 是独立程序，不需要额外的 Fish 插件。保留原来的 `cat`，阅读时显式使用 `bat`。

## 3. 配置颜色与分页

先查看配置文件位置：

```fish
bat --config-file
```

使用默认配置目录时，文件位于 `~/.config/bat/config`。先创建目录，再用编辑器创建或修改文件；已有配置时合并选项，不要覆盖其他内容。

```fish
mkdir -p ~/.config/bat
```

配置文件填写：

```text
# 使用终端的 ANSI 调色板。
--theme=ansi

# 文件较长时自动分页。
--paging=auto
```

选择内置的 `ansi` 主题，是为了沿用 Ghostty 的终端颜色；终端基础配色可参考 [Ghostty、Fish 与 Starship 工作流](./ghostty-fish-starship-terminal-workflow.md)。不另加字体或下载主题，默认行号、文件标题与 Git 修改标记也继续保留。

这里没有设置 `--style`，因此使用 bat 的默认样式。Fish 的命令输入高亮与 bat 的文件内容高亮是两层配置，修改其中一层不会自动修改另一层。

保存后，下一次运行 bat 就会读取配置，无需重启终端。可以直接检查：

```fish
bat ~/.config/bat/config
```

## 4. 实践一：阅读与搜索配置

如果已经完成终端基础配置，先读取 Fish 文件：

```fish
bat ~/.config/fish/config.fish
```

观察文件标题、行号和语法颜色。内容超过一屏时，默认通过 `less` 分页；下面的按键适用于这个分页器。自定义过 `BAT_PAGER` 或 `PAGER` 时，以实际分页器为准。

| 按键 | 操作 |
| --- | --- |
| 空格 | 下一页 |
| `b` | 上一页 |
| `/fzf`，回车 | 向后搜索 fzf |
| `n` / `N` | 下一个 / 上一个匹配 |
| `g` / `G` | 文件开头 / 结尾 |
| `q` | 退出阅读 |

推荐实际做一次「搜索 fzf → 找下一个匹配 → 返回文件开头 → 退出」。短文件可能直接输出后返回提示符，此时无需按 `q`。

若想让内容全部输出并留在终端中，可以关闭这一次的分页：

```fish
bat --paging=never ~/.config/starship.toml
```

这些配置文件不存在时，换成任意已有文本文件即可。bat 不会创建被读取的文件，也不会编辑其内容。

## 5. 实践二：定位一段内容

当错误信息指向某一行，先查看附近范围：

```fish
bat --line-range=30:60 ~/.config/fish/config.fish
```

这会读取第 30～60 行，保留原文件行号。想只保留行号、简化装饰时：

```fish
bat --style=numbers --line-range=30:60 ~/.config/fish/config.fish
```

如果需要复制内容而不带行号和标题：

```fish
bat --plain --paging=never ~/.config/starship.toml
```

`--plain` 控制装饰，`--paging=never` 控制分页；需要显式关闭颜色时再加 `--color=never`。

## 6. 实践三：从文件列表进入阅读

配置过 eza 的 `ll` 后，可以先查看目录：

```fish
ll ~/.config/fish
bat ~/.config/fish/config.fish
```

在普通项目里也是相同流程：先用 `ll` / `lt` 找入口，再把实际文件路径传给 bat。带空格的路径需要加引号。

Git 项目中，bat 可以显示相对于暂存区的修改标记，帮助阅读时找到变化位置；完整检查改动仍使用 `git status` 和 `git diff`。

## 7. 实践四：fzf 中边选边预览

下面的命令只把两个配置文件作为候选，容易观察，也不需要额外的文件搜索工具。前提是这两个文件存在、bat 和 fzf 均已安装。

```fish
printf '%s\n' ~/.config/fish/config.fish ~/.config/starship.toml |
    fzf --height=80% \
        --preview 'bat --color=always --decorations=always --paging=never --style=numbers --line-range=:200 -- {}'
```

按 ↑↓ 切换候选，观察预览内容变化；输入 `starship` 筛选；按回车输出所选路径，或按 Esc 退出。此命令只预览并返回路径，不会自动打开编辑器。

各参数有明确分工：

| 参数 | 作用 |
| --- | --- |
| `--height=80%` | 给选择界面和预览留出空间 |
| `--color=always` | 让预览命令的管道输出保留颜色 |
| `--decorations=always` | 在预览中保留指定的行号装饰 |
| `--paging=never` | 由 fzf 管理预览，不再套一层分页器 |
| `--style=numbers` | 只显示行号和内容 |
| `--line-range=:200` | 限制预览范围为前 200 行 |
| `-- {}` | `--` 结束 bat 选项；fzf 将 `{}` 替换为转义后的所选路径 |

这条临时命令只对本次选择生效。希望每次按 `Ctrl + T` 都能预览时，可按[文件与目录预览配置](./zoxide-directory-navigation-with-fish.md#ctrl-t-preview)添加独立脚本：文件交给 bat，目录交给 eza，再通过 `FZF_CTRL_T_OPTS` 接入。历史搜索和 `zi` 沿用各自的交互。

## 8. 实践五：阅读管道输出

从标准输入读取时，可以明确指定语言：

```fish
printf '{"name":"demo","enabled":true}\n' |
    bat --language=json
```

bat 负责着色，不会自动把单行 JSON 排版成多行。格式化和查询 JSON 可交给专用工具；本篇只记录高亮阅读。

反过来，将 bat 的输出送入普通管道或重定向时，默认会回到无颜色、无装饰的原文输出。前面的 fzf 预览命令显式开启颜色和装饰，因此属于刻意改变这一默认行为。

## 9. 检查与常见问题

| 现象 | 检查方式 |
| --- | --- |
| `bat` 找不到 | 用 `command -v bat` 检查 PATH，确认 Homebrew 环境初始化正常 |
| 配色没有变化 | 检查 `bat --config-file` 的结果，以及是否设置了 `BAT_THEME` 或 `BAT_CONFIG_PATH` |
| 没有进入分页 | 短文件可能直接显示；检查是否传入 `--paging=never` 或配置了 `BAT_PAGING` |
| 搜索按键无效 | 确认仍处于 `less`，而不是已经返回 Fish 提示符 |
| fzf 显示读取失败 | 确认候选是存在且可读的文本文件；目录需要其他预览方式 |
| 文件没有语法高亮 | 检查识别的语言，必要时使用 `--language` 明确指定 |

安装配置已验证：Fish 新会话能找到 bat，`ansi` 主题配置可以解析，指定行读取与 JSON 高亮正常，普通管道输出保持原文，系统 `cat` 仍保持原入口。本文 Fish 示例另外通过语法检查。

分页按键和 fzf 交互可按前面的流程在自己的终端验收。主题观感取决于终端调色板；bat 适合阅读文本，不能代替编辑器、JSON 格式化器或完整的 Git 差异工具。

## 公开参考

- [bat 官方项目与基本用法](https://github.com/sharkdp/bat)
- [bat 与 fzf 集成](https://github.com/sharkdp/bat#fzf)
- [bat 配置与主题](https://github.com/sharkdp/bat#customization)
- [fzf 预览窗口](https://github.com/junegunn/fzf#preview-window)

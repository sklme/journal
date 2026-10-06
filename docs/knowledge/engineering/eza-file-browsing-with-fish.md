---
title: eza：Fish 文件浏览与目录树实践
date: 2026-10-06
tags:
  - macOS
  - Terminal
  - Fish
  - eza
description: 使用 Homebrew 安装 eza，为 Fish 配置 ll 和 lt，通过详细列表、目录树、排序与 Git 状态浏览项目文件。
prev:
  text: "02 · 导航与选择"
  link: /knowledge/engineering/zoxide-directory-navigation-with-fish
next:
  text: "04 · 文件阅读"
  link: /knowledge/engineering/bat-file-reading-with-fish
---

# eza：Fish 文件浏览与目录树实践

> [现代终端工作流 · 系列目录](./index.md#terminal-workflow) · 第 3 / 6 篇：文件浏览

进入一个目录之后，通常需要回答三个问题：里面有什么、项目如何组织、哪些文件值得先看。eza 把文件属性、目录树和 Git 状态放进终端，让这些信息更容易浏览。

本文完成 eza 安装与 Fish 接入，再用一组可以亲手操作的练习建立日常用法。前提是 macOS 已安装 Homebrew 和 Fish；终端基础可参考 [Ghostty、Fish 与 Starship 工作流](./ghostty-fish-starship-terminal-workflow.md)。

## 1. 工具选择与分工

选择 eza，主要看重它的彩色文件列表、树状视图，以及对 Git 状态和忽略规则的支持。它不需要常驻服务，可以逐步加入已有命令行习惯。

| 工具 | 职责 | 使用时机 |
| --- | --- | --- |
| Ghostty | 显示终端内容，提供窗口、字体和调色板 | 整个终端会话 |
| Fish | 接受命令，提供补全、函数与输入高亮 | 输入命令时 |
| Starship | 显示当前目录与项目上下文 | 查看提示符时 |
| zoxide 的 `z` / `zi` | 跳转到访问过的目录 | 进入项目时 |
| eza | 展示文件、属性和目录结构 | 进入目录之后 |
| fzf | 交互筛选候选项 | 需要从很多候选中选择时 |

目录导航和选择工具的配置见 [zoxide 与 fzf 实践](./zoxide-directory-navigation-with-fish.md)。本篇只增加文件浏览能力。

## 2. 使用 Homebrew 安装

在 Fish 中执行：

```fish
brew install eza
eza --version
command -v eza
```

能够看到版本和可执行文件路径，说明安装与 PATH 正常。本文验证版本为 eza 0.23.5、Fish 4.9.3；无需刻意锁定这些版本。

后续更新仍由 Homebrew 管理：

```fish
brew upgrade eza
```

## 3. 为 Fish 配置 ll 与 lt

编辑 `~/.config/fish/config.fish`，在已有的 `if status is-interactive` 区块内加入下面内容；如果没有交互区块，可以完整加入此示例。已有同名自定义函数或缩写时，先合并定义，避免多个入口互相覆盖。

```fish
if status is-interactive
    # ll：详细列表，包含隐藏文件；lt：两层目录树，遵循 Git 忽略规则。
    if type -q eza
        function ll --wraps=eza --description '详细文件列表（eza）'
            command eza --long --all --header --group-directories-first $argv
        end
        function lt --wraps=eza --description '两层项目目录树（eza）'
            command eza --tree --level=2 --git-ignore --group-directories-first $argv
        end
    end
end
```

保存后，先检查语法：

```fish
fish --no-execute ~/.config/fish/config.fish
```

没有报错时，在 Ghostty 新开窗口。然后运行：

```fish
type ll
type lt
ll
lt
```

这两个入口是 Fish 函数。`$argv` 把追加的路径和选项传给 eza，`--wraps=eza` 让函数复用 eza 的补全信息。它们不会改写系统 `ls`。

| 入口 | 固定行为 | 适合做什么 |
| --- | --- | --- |
| `eza` | 默认简洁列表 | 快速看看当前目录 |
| `ll` | 详细列表、隐藏文件、列标题、目录优先 | 查看属性与配置文件 |
| `lt` | 两层目录树、目录优先、过滤 Git 忽略的内容 | 了解项目结构 |

这里的默认值有意不同：`ll` 尽量看全当前层；`lt` 控制递归深度，减少大项目产生的输出。

## 4. 五分钟动手练习

下面在系统临时目录建立一个小型 Git 项目，不需要修改已有项目，也不需要提交记录。请在同一个 Fish 会话中按顺序执行。

### 创建练习目录

```fish
set eza_demo (mktemp -d)
mkdir -p "$eza_demo/src" "$eza_demo/docs" "$eza_demo/node_modules" "$eza_demo/notes with spaces"
printf '# Demo\n' > "$eza_demo/README.md"
printf 'print("hello")\n' > "$eza_demo/src/main.py"
printf '# Guide\n' > "$eza_demo/docs/guide.md"
printf 'node_modules/\n' > "$eza_demo/.gitignore"
printf 'ignored sample\n' > "$eza_demo/node_modules/sample.txt"
printf 'hello\n' > "$eza_demo/notes with spaces/note.txt"
git -C "$eza_demo" init -q
cd "$eza_demo"
```

### 先看列表，再看结构

```fish
ll
lt
```

观察两个结果：

- `ll` 显示 `.gitignore`、`.git` 和 `node_modules`，因为它包含隐藏文件，也没有开启 Git 忽略过滤。
- `lt` 显示 `src/main.py`、`docs/guide.md` 等两层结构；隐藏项默认不显示，`node_modules` 则被 Git 忽略规则过滤。

只看目录，以及浏览带空格的路径：

```fish
lt --only-dirs
ll 'notes with spaces'
```

### 在列表中查看 Git 状态

先暂存 README，再修改它：

```fish
git add README.md
printf '\nMore notes\n' >> README.md
ll --git
git status --short
```

`ll --git` 增加 Git 状态列。可以和 `git status --short` 对照理解，但两者覆盖的信息和显示形式不同；查看完整变更仍应使用 `git status` 和 `git diff`。

练习结束后运行 `cd -` 返回原目录。练习目录保留在系统临时目录中；同一会话里可用 `printf '%s\n' "$eza_demo"` 查看其位置。

## 5. 日常使用场景

### 进入项目后建立整体印象

已经配置 zoxide 时，先运行 `zi` 选择项目，然后依次浏览：

```fish
ll
lt
ll --git
```

先看当前层文件和属性，再看目录组织，最后检查 Git 状态。没有安装 zoxide 时，用 `cd` 进入项目即可。

### 阅读更深的结构

需要三层时直接写出完整命令，避免依赖快捷函数里的固定深度：

```fish
eza --tree --level=3 --git-ignore --group-directories-first
```

项目没有配置忽略规则，或还需要额外排除目录时：

```fish
lt --ignore-glob='node_modules|dist|build'
```

引号中的 `|` 是 eza 的模式分隔符。保留引号，避免 Fish 把它理解成管道。

### 查找最近修改的文件

```fish
eza -l --sort=modified --reverse ~/Downloads
```

按修改时间排序，最新的在前。这里没有启用目录优先，让文件与目录一起参与时间排序。

### 查找体积较大的文件

```fish
eza -l --only-files --sort=size --reverse ~/Downloads
```

只查看当前层文件，按大小从大到小排列。它不会递归列出所有子目录内的文件，也不是磁盘空间分析工具。

### 浏览终端配置目录

```fish
ll ~/.config
lt ~/.config
```

`ll` 适合检查具体文件的权限、大小和修改时间；`lt` 适合查看配置文件的组织方式。阅读文件内容需要另外使用文件阅读工具。

## 6. 颜色、参数与适用边界

- **输入高亮和输出颜色分开管理。** Fish 决定输入中的命令颜色；eza 决定文件列表的颜色，Ghostty 负责渲染。macOS `ls` 的 `LSCOLORS` 不等于 eza 主题配置。本次使用 eza 默认配色，没有另装图标字体或添加 eza 专属主题。
- **颜色默认随输出环境切换。** 在终端中显示颜色，重定向或普通管道输出通常不带颜色转义码。需要生成纯文本时可显式加 `--color=never`。
- **`-h` 表示列标题。** eza 的 `-h` 是 `--header`；文件大小默认已使用易读单位，不要直接套用所有 `ls` 参数习惯。
- **隐藏与忽略是两个条件。** `-a` 显示隐藏项；`--git-ignore` 应用 Git 忽略规则。`lt` 没有 `-a`，因此不会显示普通隐藏项。
- **目录条目的大小不是目录总占用。** 需要统计目录占用时可用 `du -sh`，不要把普通列表中的目录大小当成总文件大小。
- **保留原始工具入口。** `ls` 仍可直接使用；脚本不要依赖交互函数 `ll`、`lt`，需要 eza 时显式调用它。

常见问题可以按下面的顺序排查：

| 现象 | 检查方法 |
| --- | --- |
| `eza` 找不到 | 用 `command -v eza` 检查 PATH，确认 Homebrew 环境已初始化 |
| `ll` 仍调用 `ls` | 新开 Fish 窗口，用 `type ll` 查看实际函数，再检查是否有同名缩写或后续定义 |
| `lt` 看不到某个文件 | 检查两层深度、隐藏属性和 Git 忽略规则 |
| 项目树仍显示依赖目录 | 检查项目忽略规则，或显式使用 `--ignore-glob` |
| 路径含空格时被拆开 | 把整个路径放进引号，例如 `ll 'notes with spaces'` |

## 7. 验证与复现

这份配置已在 macOS 的 Fish 4.9.3 与 eza 0.23.5 环境验证：新会话加载、`ll` 的隐藏文件与标题、`lt` 的深度和 Git 忽略规则、中文及空格路径传参、Git 状态列、仅目录视图，以及颜色与纯文本输出。

换机器后，按「Homebrew 安装 → Fish 配置 → 语法检查 → 新开窗口 → 临时目录练习」复现即可。练习目录和示例文件都不依赖个人项目；实际颜色还会受终端主题影响。

## 公开参考

- [eza 官方项目](https://github.com/eza-community/eza)
- [eza 命令参数](https://github.com/eza-community/eza/blob/main/man/eza.1.md)
- [eza 颜色配置](https://github.com/eza-community/eza/blob/main/man/eza_colors.5.md)
- [Fish 函数与 wraps](https://fishshell.com/docs/current/cmds/function.html)

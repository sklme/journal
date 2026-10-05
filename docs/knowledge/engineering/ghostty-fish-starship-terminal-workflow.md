---
title: 用 Ghostty、Fish 和 Starship 创建终端工作流
date: 2026-10-05
tags:
  - macOS
  - Terminal
  - Ghostty
  - Fish
  - Starship
description: 从工具分工到安装配置，创建具有原生补全、清晰提示符和统一配色的 macOS 终端工作流。
---

# 用 Ghostty、Fish 和 Starship 创建终端工作流

这套工作流由三个部分组成：**Ghostty 提供终端窗口，Fish 负责命令输入与执行，Starship 展示当前工作上下文**。完成后，打开窗口即可使用语法高亮、自动建议、补全和历史检索；提示符会显示目录、Git 状态及相关项目环境。

本文按创建顺序记录安装、配置和使用方法。范围到基础交互与视觉统一为止，目录跳转、增强文件查看、额外搜索工具和配置仓库管理留待后续实践。

## 1. 先理解工具分工

| 层次 | 选择 | 负责什么 | 选择它的理由 |
| --- | --- | --- | --- |
| 终端应用 | Ghostty | 窗口、字体、快捷键、终端颜色与字符显示 | 默认配置即可使用，再用少量文本配置调整外观与启动行为 |
| Shell | Fish | 解析命令、补全、历史记录、输入高亮 | 常用交互能力原生提供，减少维护额外插件的需要 |
| 提示符 | Starship | 目录、Git、运行环境、执行结果 | 将上下文集中在一个可独立配置的提示符中 |
| 软件安装 | Homebrew | 安装和更新工具 | Fish 与 Starship 使用同一种更新方式，便于检查版本与路径 |

日常操作可以理解为：

```text
打开 Ghostty
    → 启动 Fish
        → 初始化 Starship
        → 输入、补全、执行命令
        → Starship 根据执行结果刷新提示符
```

例如，输入中的 `git` 是否变绿由 Fish 决定；上一条命令失败后 `❯` 是否变红由 Starship 决定；`ls` 输出所使用的 ANSI 蓝色最终显示成什么颜色由 Ghostty 决定。

因此，统一主题需要同时处理这三层。只换 Ghostty 主题，并不等于所有程序都会自动采用相同的颜色。

Fish 的原生交互能力见 [Fish 教程](https://fishshell.com/docs/current/tutorial.html)，Starship 的接入方式见 [安装指南](https://starship.rs/guide/)。

## 2. 安装并确认路径

### 适用环境

以下可直接执行的配置以 **Apple Silicon Mac、Homebrew 安装前缀 `/opt/homebrew`** 为基准，配置目录使用默认位置。参考验证版本为 Ghostty 1.3.1、Fish 4.9.3、Starship 1.26.0；这些是验证记录，不要求锁定安装这些版本。

Intel Mac 应先运行 `brew --prefix`，再将配置中的 `/opt/homebrew` 调整为实际安装前缀。不要在还没安装 Fish 时先修改 Ghostty 的启动命令。

准备一个当前账户可正常使用的 Homebrew。尚未安装时，先按 [Homebrew 官方安装说明](https://docs.brew.sh/Installation) 完成安装及其提示的 PATH 初始化。

### 安装工具

在已有终端中执行；这些命令可以在 Zsh 或 Fish 中运行：

```sh
brew install --cask ghostty
brew install fish starship
brew --prefix
/opt/homebrew/bin/fish --version
/opt/homebrew/bin/starship --version
```

如果 Ghostty 已通过官方应用包安装，直接使用现有安装即可。Fish 与 Starship 统一使用 Homebrew 版本。

暂时启动一次 Fish：

```sh
/opt/homebrew/bin/fish
```

后文标记为 `fish` 的命令都在这个 Shell 中运行。Fish 有自己的配置语法，Zsh 的配置文件不能直接 `source` 到 Fish 中。

### 准备三个配置文件

```fish
mkdir -p "$HOME/Library/Application Support/com.mitchellh.ghostty" ~/.config/fish
touch "$HOME/Library/Application Support/com.mitchellh.ghostty/config.ghostty"
touch ~/.config/fish/config.fish ~/.config/starship.toml
```

| 文件 | 用途 | 修改后如何生效 |
| --- | --- | --- |
| `~/Library/Application Support/com.mitchellh.ghostty/config.ghostty` | Ghostty 外观、快捷键与启动 Shell | 按 `⌘⇧,` 重载；启动命令等设置需要新窗口 |
| `~/.config/fish/config.fish` | 环境初始化、输入高亮、缩写 | 新开窗口，或在 Fish 中重新 `source` |
| `~/.config/starship.toml` | 提示符内容与颜色 | 下一次提示符刷新时读取 |

使用文本或代码编辑器，将后文的对应内容保存为 UTF-8 纯文本。已有配置时先备份、按段合并，尤其不要重复初始化 Starship。

Ghostty 也支持 `~/.config/ghostty/`。本教程只使用上表中的 macOS 路径；若两处都存在配置，需要检查覆盖关系，macOS 专用路径后加载。详见 [Ghostty 配置位置与重载规则](https://ghostty.org/docs/config)。

## 3. 配置 Ghostty：窗口、显示与启动行为

将下面内容写入 `config.ghostty`：

```ini
# 主题与字体：沿用内置 JetBrains Mono
# Rose Pine 提供深色背景，再覆盖强调色。
theme = Rose Pine
background-opacity = 1
font-size = 14
adjust-cell-height = 4%

# ANSI 配色：同时设置普通色和亮色，避免程序切换色号后变暗。
palette = 1=#ff7b86
palette = 2=#8cf0a4
palette = 3=#ffe08a
palette = 4=#7ddcff
palette = 5=#d8b4fe
palette = 6=#ffb3da
palette = 9=#ff7b86
palette = 10=#8cf0a4
palette = 11=#ffe08a
palette = 12=#7ddcff
palette = 13=#d8b4fe
palette = 14=#ffb3da

# 窗口留白
window-padding-x = 12
window-padding-y = 10
window-padding-balance = true

# 左 Option 作为 Alt；右 Option 保留 macOS 特殊字符输入。
macos-option-as-alt = left

# 下拉终端：Control + ` 呼出或收起。
keybind = global:ctrl+backquote=toggle_quick_terminal
quick-terminal-position = top
quick-terminal-screen = mouse
quick-terminal-animation-duration = 0.15
quick-terminal-autohide = true

# 新终端使用 Homebrew 安装的 Fish。
command = /opt/homebrew/bin/fish --login
```

这份配置选用不透明深色背景，减少背景内容对文字的干扰；14pt 字号、轻微增加的行高和窗口留白用于改善连续阅读。无需额外安装字体即可先完成本文的配置。

全局下拉终端快捷键需要 macOS 的辅助功能权限。开启后，按 **Control + 反引号** 即可呼出顶部终端；失去焦点时自动隐藏，正在运行的命令继续执行。若快捷键被其他应用占用，可修改 `keybind`。

这里通过 Ghostty 的 `command` 指定 Fish，**不需要运行 `chsh`**。操作系统账户的登录 Shell 与 Ghostty 内启动的 Shell 是两个设置；其他终端应用需要分别配置。

完成三个配置文件后，按 `⌘⇧,` 重载 Ghostty，再按 `⌘N` 打开新窗口。下拉终端位置等不能即时更新的设置，需完全退出并重新打开应用。各选项的生效条件见 [Ghostty 配置参考](https://ghostty.org/docs/config/reference)。

## 4. 配置 Fish：输入体验与常用缩写

### 确定颜色的含义

颜色用于区分信息类型；输入命令保持正常字重，目录和提示符适当加粗。

| 信息 | 颜色 | 字重或样式 |
| --- | --- | --- |
| 有效命令 | 亮绿 `#8cf0a4` | 正常 |
| 目录 | 亮青 `#7ddcff` | 提示符及文件列表中加粗 |
| 参数选项、成功提示符 | 亮紫 `#d8b4fe` | 提示符加粗 |
| 引号字符串、Git 状态 | 金色 `#ffe08a` | 正常 |
| 输入错误、失败提示符 | 红色 `#ff7b86` | 加粗 |
| 自动建议、注释 | 灰紫 `#a29db8` | 正常 |
| 普通参数与正文 | 浅色 `#e0def4` | 正常 |

### 写入 Fish 配置

将下面内容写入 `~/.config/fish/config.fish`。这是独立的基础示例，开发语言版本管理器不在本篇初始化。

```fish
# 环境：由 Homebrew 提供工具搜索路径。
if test -x /opt/homebrew/bin/brew
    /opt/homebrew/bin/brew shellenv fish | source
end

# 交互配置只用于交互 Shell。
if status is-interactive
    # 命令位置的缩写：空格后会展开成真实命令。
    abbr --add --position command gs 'git status'
    abbr --add --position command gd 'git diff'
    abbr --add --position command gl 'git log --oneline --graph --decorate'
    abbr --add --position command gsw 'git switch'
    abbr --add --position command .. 'cd ..'

    # 输入高亮：有效命令不加粗。
    set -g fish_color_normal e0def4
    set -g fish_color_command 8cf0a4
    set -g fish_color_param e0def4
    set -g fish_color_option d8b4fe
    set -g fish_color_quote ffe08a
    set -g fish_color_redirection d8b4fe
    set -g fish_color_end d8b4fe
    set -g fish_color_operator d8b4fe
    set -g fish_color_escape ffb3da
    set -g fish_color_error ff7b86 --bold
    set -g fish_color_comment a29db8
    set -g fish_color_autosuggestion a29db8
    set -g fish_color_valid_path --underline
    set -g fish_color_selection e0def4 --background=403d52
    set -g fish_color_search_match e0def4 --background=403d52

    # 补全菜单
    set -g fish_pager_color_prefix 7ddcff --bold
    set -g fish_pager_color_completion e0def4
    set -g fish_pager_color_description a29db8
    set -g fish_pager_color_progress d8b4fe
    set -g fish_pager_color_selected_background --background=403d52
    set -g fish_pager_color_selected_prefix 7ddcff --bold
    set -g fish_pager_color_selected_completion e0def4
    set -g fish_pager_color_selected_description e0def4

    # macOS 系统 ls / Fish 内置 ll 的输出配色。
    set -gx CLICOLOR 1
    set -gx LSCOLORS Exfxcxdxbxegedabagacadah

    # 提示符交给 Starship，保留一处初始化。
    if type -q starship
        starship init fish | source
    end
end
```

`fish_color_command` 只影响正在编辑的命令。`ll` 执行后的目录颜色来自 `ls`：上面 `LSCOLORS` 开头的 `Ex` 指定目录为加粗蓝色、默认背景，再由 Ghostty 把 ANSI 蓝色映射为亮青色。

`LSCOLORS` 是 macOS/BSD `ls` 的规则，GNU `ls` 使用另一套 `LS_COLORS`。本文的字符串按验证环境的 macOS 格式编写；不同系统应以本机 `man ls` 为准。这里没有设置 `CLICOLOR_FORCE`，避免把颜色强行写入管道或文件。

## 5. 配置 Starship：用两行读懂上下文

第一行放目录、Git 和必要的项目环境，第二行只保留输入标记。示意如下，版本和状态会随实际目录变化：

```text
…/demo main [!?] node vX.Y.Z 3s
❯ git status
```

`!` 表示存在修改，`?` 表示未跟踪文件；耗时达到 2 秒才显示。成功后的输入标记为紫色，失败后变成红色，避免让每一条普通命令都显得像告警。

将下面内容写入 `~/.config/starship.toml`：

```toml
"$schema" = 'https://starship.rs/config-schema.json'
format = '$username$hostname$directory$git_branch$git_commit$git_state$git_status$nodejs$python$rust$golang$cmd_duration$line_break$character'
palette = 'terminal'
add_newline = true

[palettes.terminal]
text = '#e0def4'
muted = '#a29db8'
love = '#ff7b86'
gold = '#ffe08a'
rose = '#ffb3da'
foam = '#7ddcff'
iris = '#d8b4fe'

# 目录与身份
[directory]
style = 'bold foam'
truncation_length = 3
truncation_symbol = '…/'
truncate_to_repo = true
read_only = ' ro'
read_only_style = 'love'
format = '[$path]($style)[$read_only]($read_only_style) '

[username]
show_always = false
style_user = 'iris'
style_root = 'bold love'
format = '[$user]($style) '

[hostname]
ssh_only = true
format = '[@$hostname](muted) '

# Git 上下文
[git_branch]
symbol = ''
style = 'iris'
truncation_length = 24
format = '[$branch]($style) '

[git_commit]
only_detached = true
format = '[@$hash](iris) '

[git_state]
style = 'gold'
format = '[\($state( $progress_current/$progress_total)\)]($style) '

[git_status]
style = 'gold'
format = '([\[$all_status$ahead_behind\]]($style) )'
conflicted = '='
untracked = '?'
modified = '!'
staged = '+'
renamed = '»'
deleted = '×'
stashed = '*'
ahead = '↑${count}'
behind = '↓${count}'
diverged = '↑${ahead_count}↓${behind_count}'

# 仅在相关项目中显示；显示版本不等于安装或切换版本。
[nodejs]
symbol = 'node '
style = 'foam'
format = '[$symbol$version]($style) '

[python]
symbol = 'py '
style = 'rose'
format = '[${symbol}${version}( \($virtualenv\))]($style) '

[rust]
symbol = 'rust '
style = 'rose'
format = '[$symbol$version]($style) '

[golang]
symbol = 'go '
style = 'foam'
format = '[$symbol$version]($style) '

# 耗时与执行结果
[cmd_duration]
min_time = 2000
style = 'muted'
format = '[$duration]($style) '

[character]
success_symbol = '[❯](bold iris)'
error_symbol = '[❯](bold love)'
vimcmd_symbol = '[❮](bold iris)'
```

这里显式列出需要的模块，使用 `node`、`py` 等文字标识。语言模块按目录内容及环境检测是否显示；Starship 展示检测结果，不负责安装语言运行时。`vimcmd_symbol` 只是预留样式，并未开启 Fish 的 Vi 键位。

格式字段、模块检测和自定义调色板见 [Starship 配置参考](https://starship.rs/config/)。

## 6. 日常怎么使用

### 输入：先补全，再执行

| 操作 | 方法 |
| --- | --- |
| 补全命令、路径、选项 | 按 `Tab`，有多个候选时继续选择 |
| 接受整条灰色建议 | 光标位于行尾时按 `→` |
| 逐词接受建议 | 左 `Option + →` |
| 查找之前输入的命令 | 输入关键词后按 `↑` / `↓`；多行输入时也承担行间移动 |
| 打开历史搜索 | `Ctrl + R` |
| 到行首 / 行尾 | `Ctrl + A` / `Ctrl + E` |
| 删除到行首 | `Ctrl + U` |
| 取消当前输入或中断前台命令 | `Ctrl + C` |
| 清理当前显示 | `Ctrl + L`；不会清除命令历史 |

自动建议只是候选文本，接受后仍需要按回车执行。先通过 `Tab` 和历史记录复用已有信息，比反复手动输入路径更省事。以上交互以 Fish 默认键位为准，详见 [Fish 交互使用文档](https://fishshell.com/docs/current/interactive.html)。

### Git：缩写展开成看得见的命令

| 输入后按空格 | 展开结果 | 用途 |
| --- | --- | --- |
| `gs` | `git status` | 查看工作区状态 |
| `gd` | `git diff` | 查看未暂存修改 |
| `gl` | `git log --oneline --graph --decorate` | 浏览简洁提交图 |
| `gsw` | `git switch` | 补上分支名后切换分支 |
| `..` | `cd ..` | 回到上一级目录 |

缩写只在交互输入的命令位置展开，脚本里继续写完整命令。以 `gsw` 为例：输入 `gsw`、按空格，看到 `git switch` 后再补全分支名并执行。

### 一次实际操作

在已有 Git 项目里完成以下动作：

1. 用 `cd` 进入项目，观察提示符中的目录和分支。
2. 输入 `gs`，按空格检查展开结果，再按回车。
3. 输入 `gd` 查看修改；若进入分页器，按 `q` 退出。
4. 输入曾经执行过的命令前几个字符，尝试用 `→` 接受建议。
5. 输入 `ll` 查看长格式文件列表；目录应为亮青色加粗。

`ll` 使用 Fish 自带的函数，调用系统 `ls`，本篇没有额外安装文件列表工具。

### Fish 与脚本的边界

交互 Shell 选择 Fish，不会要求项目脚本都改成 Fish。现有 Bash 脚本继续用明确的解释器运行：

```fish
bash ./script.sh
```

不要把 Bash/Zsh 脚本 `source` 进 Fish。临时设置环境变量可以使用 `env NAME=value command`；需要在当前 Fish 会话导出变量时，使用 `set -gx NAME value`。

## 7. 验证配置是否真正生效

### 先做配置与路径检查

在新打开的 Ghostty 窗口中执行：

```fish
status fish-path
fish --version
starship --version
type -a fish starship
fish --no-execute ~/.config/fish/config.fish
/Applications/Ghostty.app/Contents/MacOS/ghostty +validate-config
```

`status fish-path` 应指向 Homebrew 提供的 Fish，可能显示 `/opt/homebrew/bin/fish` 或其解析后的 Cellar 路径。最后两项不应报告配置语法错误。`echo $SHELL` 可能仍显示系统登录 Shell，不能用来判断当前是不是 Fish。

查看 Ghostty 合并后的配置：

```fish
/Applications/Ghostty.app/Contents/MacOS/ghostty +show-config
```

检查其中的 `theme`、`command` 和 `palette`。这一步证明文件被解析；要确认正在打开的窗口应用了新设置，还需重载并进行下面的视觉检查。

### 再做交互验收

| 验证动作 | 预期结果 |
| --- | --- |
| 输入 `echo "hello"` | 命令亮绿、正常字重，引号字符串为金色 |
| 输入一个不存在的命令，暂不执行 | 命令呈红色；按 `Ctrl + C` 取消 |
| 执行 `false` | 下一次提示符 `❯` 为红色 |
| 执行 `true` | 下一次提示符恢复紫色 |
| 执行 `sleep 3` | 下一次提示符显示约 3 秒耗时 |
| 进入 Git 项目 | 显示实际分支及工作区状态 |
| 执行 `ll` | 目录为亮青色加粗 |
| 输入 `gs` 后按空格 | 展开为 `git status` |
| 按 `Tab`、`↑`、`Ctrl + R` | 补全和历史检索可用 |
| 新开一个窗口 | 仍进入 Fish，配置持续生效 |

本篇配置依据已完成的本机实践整理：Ghostty 配置解析、Fish 语法、Starship 的成功/失败配色以及 `ll` 输出的目录颜色控制序列均做过验证，用户也确认过视觉效果。本文重新整理的示例仍需在读者自己的版本、字体和显示器上完成上述检查。

## 8. 常见问题按哪一层排查

| 现象 | 先检查 | 处理方式 |
| --- | --- | --- |
| 改了主题但窗口没变化 | Ghostty 是否加载了目标文件 | 检查 `+show-config`，重载后新建窗口 |
| 新窗口仍进入其他 Shell | `command` 路径与 Fish 是否存在 | 确认 Homebrew 前缀，修正启动路径 |
| 命令没有高亮 | 当前 Shell 和 Fish 配置 | 检查 `status fish-path`、`fish_color_command` |
| `ll` 输出颜色没变化 | `LSCOLORS` 和 Ghostty ANSI 色板 | 重载 Ghostty，同时新开 Fish 会话 |
| 提示符不是两行 | Starship 初始化与配置路径 | 检查 `type -a starship` 和 `STARSHIP_CONFIG` 是否被另行设置 |
| 普通目录没有语言版本 | 项目检测条件 | 进入对应项目验证；不要为了显示版本而安装无关运行时 |
| 左 Option 无法逐词移动 | `macos-option-as-alt` 与当前键位 | 确认设为 `left`，新开窗口测试 |
| Fish 配置更新后旧窗口没变 | 当前会话尚未重读配置 | 执行下方命令，或新开窗口 |

```fish
source ~/.config/fish/config.fish
```

排错时每次只调整对应层：窗口和输出调色板看 Ghostty，输入交互看 Fish，上下文提示看 Starship。本文到此完成基础工作流；后续增强应在实际使用后单独记录。


## 下一步：目录导航

基础工作流配置完成后，可以继续阅读 [zoxide 的安装、Fish 接入与日常实践](./zoxide-directory-navigation-with-fish.md)，用已访问目录的关键词减少重复路径输入。

---
title: fd 与 ripgrep：Fish 文件查找与内容搜索实践
date: 2026-10-07
tags:
  - macOS
  - Terminal
  - Fish
  - fd
  - ripgrep
  - fzf
description: 使用 Homebrew 安装 fd 和 ripgrep，练习文件查找、内容搜索、隐藏与忽略规则，并组合 fzf 和 bat 筛选预览。
---

# fd 与 ripgrep：Fish 文件查找与内容搜索实践

知道项目目录之后，常见的两个问题是「配置文件放在哪里」和「哪些代码使用了这个配置项」。fd 负责按名称查找文件或目录，ripgrep 的命令 `rg` 负责搜索文件内容。

本文从安装开始，用一个可重建的小项目练习搜索，再把结果交给 fzf 筛选、bat 预览。示例使用 Fish 语法；基础条件是 macOS、Homebrew、Fish 和 Git。

## 1. 选择与分工

| 工具 | 输入与结果 | 典型场景 |
| --- | --- | --- |
| fd | 名称模式 → 文件或目录路径 | 找配置、源码或某类文件 |
| rg | 文本模式 → 匹配行或文件路径 | 找函数调用、配置项或报错文字 |
| fzf | 一批候选 → 交互选择 | 从多个结果里确认目标 |
| bat | 文件路径 → 易读的内容 | 阅读命中相关文件 |

fd 提供简洁的名称、扩展名和类型筛选；rg 提供递归内容搜索、行号、上下文与语言类型过滤。两者都能利用项目忽略规则减少依赖和构建产物带来的干扰。

这一步接在 [eza 文件浏览](./eza-file-browsing-with-fish.md) 和 [bat 文件阅读](./bat-file-reading-with-fish.md) 之后。fzf 配置参考 [zoxide 与 fzf 实践](./zoxide-directory-navigation-with-fish.md)。

## 2. 通过 Homebrew 安装

```fish
brew install ripgrep fd
command -v rg
rg --version
command -v fd
fd --version
```

安装包名是 `ripgrep`，实际命令是 `rg`。本文验证版本为 ripgrep 15.2.0、fd 10.5.0、Fish 4.9.3；版本用于说明验证环境，不要求锁定安装。

在 Apple Silicon 的默认 Homebrew 安装中，命令路径通常为 `/opt/homebrew/bin/rg` 和 `/opt/homebrew/bin/fd`。如果命中了其他应用附带的版本，用 `type -a rg` 检查路径顺序，再检查 Fish 的 Homebrew 初始化。

后续更新：

```fish
brew upgrade ripgrep fd
```

两者不需要额外的 Fish 插件。本次保留默认搜索规则，没有设置全局忽略文件、rg 配置文件或新的快捷键。

## 3. 建立一个可重复练习的小项目

在同一个 Fish 会话中执行下面整段。它会创建一个独立的系统临时目录，不修改已有项目。

```fish
set search_demo (mktemp -d)
mkdir -p "$search_demo/src" "$search_demo/docs" "$search_demo/node_modules"
printf '# Search playground\n' > "$search_demo/README.md"
printf 'node_modules/\n*.log\n' > "$search_demo/.gitignore"
printf 'APP_MODE=development\n' > "$search_demo/.env.example"
printf '%s\n' \
    '"""A sample client; this file is for reading only."""' \
    '' \
    'timeout = 30' \
    'endpoint = "https://api.example.com"' \
    '' \
    'def describe():' \
    '    return f"timeout={timeout}, endpoint={endpoint}"' \
    > "$search_demo/src/app.py"
printf '{\n  "timeout": 30,\n  "retries": 3\n}\n' > "$search_demo/src/config.json"
printf 'class TimeoutError(Exception):\n    pass\n' > "$search_demo/src/worker.py"
printf '# Quick start\n\nThe timeout setting controls how long a request waits.\n' > "$search_demo/docs/quick start.md"
printf '// vendor-demo: a deliberately ignored sample\n' > "$search_demo/node_modules/vendor.js"
printf 'DEBUG: deliberately ignored log\n' > "$search_demo/debug.log"
git -C "$search_demo" init -q
cd "$search_demo"
```

初始化 Git 是为了验证项目的 `.gitignore` 行为，不需要提交记录。目录包含普通文件、隐藏文件、被忽略的文件，以及一个带空格的文档名。

以下练习均从这个目录执行。结束后用 `cd -` 返回原目录；同一会话中可用 `printf '%s\n' "$search_demo"` 查看练习目录的位置。

## 4. 用 fd 按名称查找

### 名称、扩展名和文件类型

```fish
# 文件名包含 config，且只返回普通文件。
fd -t f config

# 查找 Python 文件。
fd -e py

# 只找目录。
fd -t d

# 在 docs 内查找 Markdown 文件，点号作为匹配模式。
fd -e md . docs
```

| 命令 | 预期结果 |
| --- | --- |
| `fd -t f config` | `src/config.json` |
| `fd -e py` | `src/app.py`、`src/worker.py` |
| `fd -e md . docs` | `docs/quick start.md` |

基本形式是 `fd 模式 搜索目录`。默认递归搜索，匹配的是文件或目录的名称；需要匹配完整路径时使用 `--full-path`。

### 正则与通配符

默认模式是正则表达式。例如，精确匹配 README 文件名：

```fish
fd '^README\.md$'
```

想使用通配符时，加 `-g`，并给模式加引号，让 fd 而不是 Fish 解释星号：

```fish
fd -g '*.json'
```

## 5. 用 rg 搜索文件内容

### 找到匹配行与行号

```fish
rg -n 'timeout' src
```

输出形如 `路径:行号:内容`。本练习会命中 `src/config.json` 第 2 行，以及 `src/app.py` 第 3、7 行；结果顺序不作为判断标准。

### 缩小范围，补充上下文

```fish
# 忽略大小写，同时找到 TimeoutError。
rg -n -i 'timeout' src

# 只搜索 Python 文件。
rg -n -t py 'timeout' src

# 显示命中行前后各两行。
rg -n -C 2 'timeout' src

# 只输出包含匹配的文件路径，每个文件一次。
rg -l 'timeout' src
```

寻找函数调用时，先限定源码目录和语言类型；阅读不熟悉的匹配时，再加 `-C` 看上下文。只想确认哪些文件相关时，用 `-l` 得到更简洁的候选列表。

### 按文字原样搜索

rg 默认也使用正则表达式。搜索 URL、报错片段等原始文字时，`-F` 可以避免把句点、括号等字符解释成正则语法：

```fish
rg -n -F 'api.example.com' src
```

需要限定文件名模式时，可以使用 `-g`，例如：

```fish
rg -n -g '*.json' 'timeout' .
```

## 6. 理解隐藏文件与忽略规则

隐藏文件与忽略规则是两个独立条件。练习项目中，`.env.example` 因名称以点开头而隐藏；`node_modules/` 和 `debug.log` 则被 `.gitignore` 忽略。

### fd 对照练习

```fish
# 没有结果：隐藏文件默认不参与搜索。
fd -t f env

# 找到 .env.example。
fd -H -t f env

# 没有结果：vendor.js 在被忽略的目录中。
fd vendor

# 找到 node_modules/vendor.js。
fd --no-ignore vendor
```

### rg 对照练习

```fish
# 没有结果。
rg 'APP_MODE' .

# 包含隐藏文件，同时排除 Git 元数据目录。
rg --hidden -g '!.git/**' 'APP_MODE' .

# 没有结果。
rg 'vendor-demo' .

# 搜索被忽略目录内的示例内容。
rg --no-ignore 'vendor-demo' .
```

`--hidden` 不会自动关闭忽略规则，`--no-ignore` 也不会自动包含隐藏文件。只按需要放开对应条件，搜索范围会更容易理解。

fd 默认需要识别到 Git 仓库才应用相关 Git 忽略规则；本练习已经初始化 Git。rg 显式指定文件路径时，还可能覆盖默认过滤规则。因此，排查递归搜索与直接读取单个文件的差异时，需要同时检查搜索根目录和参数。

### 大小写行为也不同

- fd 默认采用智能大小写：模式全小写时忽略大小写；出现大写字母时区分大小写。
- rg 默认区分大小写；`-i` 忽略大小写，`-S` 使用智能大小写。

不要因为 fd 能找到大小写不同的名称，就假定 rg 的内容搜索也会如此。

## 7. 组合 fzf 与 bat 筛选预览

这一节需要已经安装 fzf 和 bat。候选只包含文件，避免把目录交给 bat 阅读。

### 从文件名筛选

```fish
fd -t f --print0 |
    fzf --read0 --height=80% \
        --preview 'bat --color=always --decorations=always --paging=never --style=numbers --line-range=:200 -- {}'
```

输入 `quick` 选择文档，或输入 `config` 选择配置；按 ↑↓ 切换候选并观察预览，回车输出路径，Esc 退出。

### 从内容匹配的文件中选择

```fish
rg -l -0 'timeout' src |
    fzf --read0 --height=80% \
        --preview 'bat --color=always --decorations=always --paging=never --style=numbers --line-range=:200 -- {}'
```

这里 rg 先筛出包含 `timeout` 的文件，fzf 再让人选择，bat 展示前 200 行。预览从文件开头开始，并不自动跳到关键词所在行。

`fd --print0` 和 `rg -0` 使用 NUL 分隔文件名，`fzf --read0` 按相同格式接收，避免候选文件名中的换行被当成新记录。fzf 的 `{}` 占位符会转义所选路径，空格文件名可以正常预览。示例的最终输出供人查看；若继续传给程序处理特殊文件名，应再考虑 `fzf --print0` 和下游的 NUL 支持。

这两条命令不会打开编辑器，也没有修改已有的 `Ctrl + T`、历史搜索或 `zi`。它们是可以按需运行的组合命令。

## 8. 日常场景与排错

| 目标 | 推荐方式 |
| --- | --- |
| 记得配置名，不记得位置 | `fd -t f config` |
| 找某种语言的文件 | `fd -e py` |
| 找配置项在哪些文件被使用 | `rg -n 'timeout' src` |
| 找原始报错文字 | `rg -n -F '报错片段' .` |
| 快速确认相关文件集合 | `rg -l 'timeout' src` |
| 候选太多，需要阅读后确认 | 把路径交给 fzf，再用 bat 预览 |

搜索无结果时，按「当前目录 → 大小写 → 正则还是原文 → 隐藏文件 → 忽略规则」检查。内容搜索还要注意文件是否为二进制；rg 默认跳过二进制文件。

rg 退出码 `1` 通常表示没有匹配，`2` 表示错误；上面刻意无结果的练习不代表安装失败。编写脚本时应区分无匹配与执行失败，而不是把两者混为一谈。

fd 和 rg 都不是语义代码分析工具：找到文字不等于证明所有调用关系；重命名符号等操作仍应结合编辑器或语言服务。

## 9. 验证与复现

已确认 Fish 中的命令来自 Homebrew，并验证了名称与扩展名过滤、隐藏文件、Git 忽略规则、大小写、原文匹配、内容命中、NUL 候选传输、带空格文件名的筛选及 bat 预览输出。文中的 Fish 代码块通过语法检查，练习项目可从创建命令重新生成。

验证版本为 fd 10.5.0、ripgrep 15.2.0、Fish 4.9.3。交互界面的布局与操作可按第 7 节在自己的终端体验。当前没有永久搜索快捷键或全局过滤配置；后续优化应以实际项目需求为依据。

## 公开参考

- [fd 官方用法](https://github.com/sharkdp/fd)
- [ripgrep 官方项目](https://github.com/BurntSushi/ripgrep)
- [ripgrep 用户指南](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)
- [fzf 预览窗口](https://github.com/junegunn/fzf#preview-window)
- [bat 与 fzf 集成](https://github.com/sharkdp/bat#fzf)

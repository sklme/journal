---
title: 终端配置同步：Git、符号链接与换机恢复
date: 2026-10-07
tags:
  - macOS
  - Terminal
  - Git
  - Dotfiles
  - Homebrew
description: 用私有 Git 仓库集中管理终端配置，通过符号链接、本机备份和 Brewfile 实现日常同步、换机恢复与回滚。
prev:
  text: "05 · 搜索定位"
  link: /knowledge/engineering/fd-ripgrep-search-with-fish
next: false
---

# 终端配置同步：Git、符号链接与换机恢复

> [现代终端工作流 · 系列目录](./index.md#terminal-workflow) · 第 6 / 6 篇：配置同步与恢复

完成 Ghostty、Fish、Starship 以及常用命令行工具的配置之后，需要让这些设置可以追踪、回滚，并能在另一台电脑上恢复。本文记录一套以私有 Git 仓库为中心的方案，适用于已经具备基本 Git 操作经验的读者。

终端配置原件放在 `~/dotfiles`，应用原来的配置位置通过符号链接指向这些原件。Git 同步内容，恢复脚本管理本机链接和备份，Brewfile 记录需要安装的工具。

示例以 Apple Silicon macOS、Fish 和默认 `~/.config` 为前提。仓库地址使用占位示例，执行前必须替换为自己的仓库。

## 1. 明确需要同步什么

| 内容 | 放在哪里 | 如何处理 |
| --- | --- | --- |
| Ghostty、Fish、Starship、bat 配置 | dotfiles Git 仓库 | 审查后提交、推送与拉取 |
| 软件安装清单 | 仓库中的 Brewfile | 换机时由 Homebrew 安装 |
| 链接建立与冲突处理逻辑 | 仓库中的恢复脚本 | 在每台电脑上单独运行 |
| 接入前的配置原文件 | 本机备份目录 | 用于撤销链接接入，不提交 Git |
| Fish 命令历史、zoxide 目录数据库 | 各工具的数据目录 | 按需另行备份 |
| SSH 密钥、认证信息、个人环境变量 | 本机或专门的凭据管理工具 | 不进入配置仓库 |

私有仓库用于控制访问范围，但提交前仍需检查内容。不要将整个 `~/.config` 或主目录直接加入 Git。

当前范围只覆盖四份配置。fzf、zoxide、eza 的初始化和交互设置集中在 Fish 配置里；fd、rg 使用默认行为。mise 的开发工具版本、编辑器配置和历史数据属于后续独立管理的范围。

## 2. 理解符号链接与 Git 的分工

以 Fish 为例：

```text
~/.config/fish/config.fish
           │ 符号链接
           ▼
~/dotfiles/fish/config.fish
           │ commit + push
           ▼
       私有 Git 远端
           │ pull
           ▼
另一台电脑的 ~/dotfiles/fish/config.fish
```

符号链接是一条指向另一个文件的路径。正常沿链接编辑时，修改的是仓库中的原件；不需要改完应用配置后再复制一份到仓库。

Git 则只有在执行相应命令时才工作：

- `commit` 把变更保存为本地版本。
- `push` 把提交发送到远端。
- `pull` 将远端变更取回并整合到本地。

因此，建立链接不等于自动同步。两台电脑也不能通过一个链接直接共享文件；它们各自拥有 Git 工作副本和本机链接。

少数编辑器或程序可能用“删除原文件再新建”的方式保存，把链接替换为普通文件。维护时需要检查链接状态，不能只看文件内容是否相同。

## 3. 统一配置入口

| 仓库文件 | 应用读取位置 |
| --- | --- |
| `ghostty/config.ghostty` | `~/.config/ghostty/config.ghostty` |
| `fish/config.fish` | `~/.config/fish/config.fish` |
| `starship/starship.toml` | `~/.config/starship.toml` |
| `bat/config` | `~/.config/bat/config` |

### Ghostty 为什么统一到 ~/.config

macOS 上 Ghostty 同时支持 XDG 配置目录和 `~/Library/Application Support/com.mitchellh.ghostty/`。如果两处都存在配置，后读取的 macOS 专用配置可能覆盖前面的设置。[Ghostty 配置说明](https://ghostty.org/docs/config)

迁移时应先比较两处文件并确认需要保留的内容，再保存备份，将有效配置统一放到 `~/.config/ghostty/config.ghostty`。旧文件移出加载目录，避免出现“改了文件却不生效”的情况；旧版名为 `config` 的入口也应一起检查。

统一入口后，在 Ghostty 用 `Command + ,` 打开配置，确认打开的是预期文件。`Command + Shift + ,` 重载配置；部分选项需要新建终端或重启应用。

如果设置过 `XDG_CONFIG_HOME`、`STARSHIP_CONFIG`、`BAT_CONFIG_PATH`，或通过额外配置文件继续加载其他设置，应先核对实际入口，不能直接照用表格中的默认路径。

## 4. 创建仓库并收集配置

推荐结构如下：

```text
dotfiles/
├── .gitignore
├── README.md
├── Brewfile
├── ghostty/config.ghostty
├── fish/config.fish
├── starship/starship.toml
├── bat/config
├── scripts/
│   ├── check.sh
│   ├── restore.sh
│   └── restore.py
└── tests/
    └── test_restore.py
```

先确认 `~/dotfiles` 尚不存在，或已确定它就是本次要管理的仓库。如果已有旧仓库，先完成第 9 节的备份与地址分离。

以下命令用于创建一个全新的目录。需要四份来源配置已经存在；任何命令失败都应停下来检查，不继续进行链接替换。

```fish
mkdir ~/dotfiles
cd ~/dotfiles
git init -b main
mkdir ghostty fish starship bat
cp ~/.config/ghostty/config.ghostty ghostty/config.ghostty
cp ~/.config/fish/config.fish fish/config.fish
cp ~/.config/starship.toml starship/starship.toml
cp ~/.config/bat/config bat/config
```

先复制、检查、提交，再处理应用入口。仓库中跟踪的是普通配置文件；符号链接建立在应用原来的配置位置。

最小 `.gitignore` 可以包含：

```gitignore
.DS_Store
__pycache__/
*.pyc
.env
.env.*
*.local.*
fish/machine.fish
fish_history
fish_variables
db.zo
backups/
*.bak
*.key
*.pem
```

忽略规则只能作为补充。它不会自动排除已经被 Git 跟踪的文件，也不能判断一份普通配置是否含有凭据。每次提交仍然需要阅读差异。

为当前仓库设置提交身份，再连接已经创建好的空私有远端：

```fish
git config user.name "Example User"
git config user.email "user@example.com"
git config pull.ff only
git remote add origin "<REPOSITORY_SSH_URL>"
```

这些命令只设置当前仓库。`<REPOSITORY_SSH_URL>` 替换为自己仓库页面提供的 SSH 克隆地址，保留引号。SSH 私钥留在本机；新机器需要单独获得仓库访问权限。

## 5. 通过备份和链接接入应用

### 先用临时文件理解过程

下面的 Fish 示例只操作新建的临时目录，不触碰真实配置：

```fish
set demo_dir (mktemp -d)
mkdir "$demo_dir/repo" "$demo_dir/app" "$demo_dir/backup"
printf 'theme = new\n' > "$demo_dir/repo/config"
printf 'theme = old\n' > "$demo_dir/app/config"

# 保留旧文件，再建立链接。
mv "$demo_dir/app/config" "$demo_dir/backup/config"
ln -s "$demo_dir/repo/config" "$demo_dir/app/config"

# 沿应用入口写入，仓库原件也会变化。
printf '# edited through link\n' >> "$demo_dir/app/config"
cat "$demo_dir/repo/config"
readlink "$demo_dir/app/config"

# 撤销链接，恢复旧文件。unlink 只移除链接。
unlink "$demo_dir/app/config"
mv "$demo_dir/backup/config" "$demo_dir/app/config"
cat "$demo_dir/app/config"
```

实际接入四份配置时，需要把这种单文件操作扩展为带检查、清单和回滚能力的脚本，避免用 `ln -sf` 直接覆盖来源不明的文件。

### 恢复脚本的职责

本方案已经实现并验证了一套自定义脚本接口。下面是接口约定，`restore.sh` 和 `check.sh` **不是系统自带命令**；复现时必须先在自己的仓库中实现这些脚本，或采用经过审查的等效实现。本文不分发个人配置仓库源码。

| 调用 | 行为 |
| --- | --- |
| `./scripts/restore.sh` | 只显示将建立的链接和需要备份的旧入口 |
| `./scripts/restore.sh --apply` | 备份冲突文件，建立四个链接 |
| `./scripts/restore.sh --status` | 检查链接是否正确，发现缺失或冲突时返回失败状态 |
| `./scripts/restore.sh --rollback /path/to/backup/manifest.json` | 根据指定批次恢复接入前的文件 |
| `./scripts/restore.sh --target-home /path/to/test-home --apply` | 在预先创建的隔离目录演练 |

脚本应遵循这些规则：

1. 操作前检查所有来源文件与目标路径；目标是目录、父目录有未经处理的链接等情况应拒绝执行。
2. 只管理明确列出的配置入口，正确链接重复执行时直接跳过。
3. 将原文件或原链接保存在 `~/.local/state/dotfiles/backups/<批次>/`，并记录目标、来源和备份位置的 manifest。
4. 先备份，后建链接；捕获到安装异常时尝试恢复已经处理的项目。
5. 回滚前统一检查。如果目标已被替换成其他文件，应停止而非覆盖后续修改。
6. 将旧 Ghostty 加载入口纳入检查；内容合并由人先完成，脚本只负责保存并移走已确认不再使用的入口。
7. 防止并发运行；不在恢复步骤中自动安装软件、修改登录 Shell 或操作 Git 远端。

备份目录保留在仓库外，不随 push 上传。脚本处理的异常回滚也不等于能保证断电或磁盘故障下的完整恢复，系统备份仍有价值。

## 6. 记录软件清单与机器差异

`Brewfile` 中只写这套终端工作流需要的工具：

```ruby
cask "ghostty"
brew "fish"
brew "starship"
brew "zoxide"
brew "fzf"
brew "eza"
brew "bat"
brew "ripgrep"
brew "fd"
```

新机器在安装 Homebrew 后执行：

```fish
brew bundle install --no-upgrade --file=Brewfile
```

`--no-upgrade` 避免顺便升级已安装工具；Brewfile 记录软件名，不锁定整套工具的精确版本。若需要项目运行时的版本约束，应另用项目环境配置管理。[Homebrew Bundle 文档](https://docs.brew.sh/Brew-Bundle-and-Brewfile)

已有机器上的 Ghostty 如果来自独立安装包，先确认是否需要交给 Homebrew 管理，不要为满足清单而覆盖应用。自定义字体也需另行记录其安装来源；配置中的字体名本身不能完成安装。

下面用通用文件名示范机器专属配置，文件名可自行约定，并与加载语句保持一致。不同机器的私有环境可以放在 `~/.config/fish/machine.fish`，主配置末尾按需加载：

```fish
if test -f $__fish_config_dir/machine.fish
    source $__fish_config_dir/machine.fish
end
```

这个文件不进入四份配置的同步映射。通用 PATH 使用 `$HOME` 等变量；对于 `/opt/homebrew/bin/fish` 这种与架构有关的路径，要明确当前方案面向 Apple Silicon，迁移 Intel Mac 前单独调整。

## 7. 日常同步：先拉取，再修改，再推送

首次把审查后的文件提交并推送：

```fish
cd ~/dotfiles
git add .gitignore README.md Brewfile ghostty/config.ghostty fish/config.fish starship/starship.toml bat/config scripts tests
git diff --cached
git diff --cached --check
git commit -m "feat: manage terminal configuration"
git push -u origin main
```

这里假定说明、脚本和测试已经按前面的结构准备完成。暂存时明确列出文件，先检查内容，再提交。

此后的日常流程：

```fish
cd ~/dotfiles
git status
git pull --ff-only

# 修改需要调整的配置，然后验证。
./scripts/check.sh
git diff
git add fish/config.fish
git diff --cached
git commit -m "config: adjust fish interaction"
git push
```

执行 pull 前应先处理未提交变更。`--ff-only` 在本地与远端提交发生分叉时停止，不替你决定合并策略。[Git pull 文档](https://git-scm.com/docs/git-pull)

另一台机器拉取后，链接仍然指向更新后的仓库文件。新开 Fish 会加载配置；Ghostty 则重载或新建窗口。新增配置文件时，还要更新恢复脚本的映射，并在每台机器重新执行接入。

遇到冲突先查看 `git status` 和 `git log --oneline --graph --all`，确认两端分别改了什么，再决定合并或变基。不要为“同步成功”直接强推，也不要用硬重置丢掉未确认的修改。

## 8. 换机恢复与两种回滚

### 换机恢复顺序

1. 准备 Git、Homebrew、Python 3 和仓库 SSH 访问。Python 3 是本方案恢复脚本的运行依赖，不假设每台 macOS 都已经具备。
2. 克隆到稳定目录：

   ```fish
   git clone "<REPOSITORY_SSH_URL>" ~/dotfiles
   cd ~/dotfiles
   ```

3. 阅读 README，检查架构、配置入口、字体和已有应用，再安装 Brewfile 中的工具。
4. 运行 `./scripts/check.sh`，通过后运行 `./scripts/restore.sh` 预览。
5. 确认预览范围，执行 `./scripts/restore.sh --apply`，保存它输出的备份清单路径。
6. 执行 `./scripts/restore.sh --status`，新开终端验证提示符、颜色、`ll`、`lt`、`z`、`zi` 和 fzf 快捷键。

建立绝对路径链接后，不要直接移动或删除仓库目录。需要搬迁时，先撤销本机链接，再从新位置重新接入。

### 撤销某次配置修改

如果配置改坏了，但仍想使用 dotfiles 管理：

```fish
git status
git log --oneline
# 将 COMMIT_SHA 替换为实际需要撤销的提交。
git revert COMMIT_SHA
./scripts/check.sh
git push
```

这会新增一条撤销提交，便于其他机器继续同步；操作前需处理未提交修改。

### 撤销本机链接接入

如果需要回到采用 dotfiles 之前的本机配置：

```fish
./scripts/restore.sh --rollback /path/to/backup/manifest.json
```

它恢复原文件，不撤销 Git 历史。之后应用读取的是恢复出来的本机文件，再修改仓库不会自动影响这些入口。

## 9. 已有旧仓库时如何保留历史

如果远端仓库名称已经被多年以前的配置占用，可以让旧仓库保留历史，再为新方案创建独立仓库：

1. 镜像克隆旧仓库，并生成包含全部 Git 引用的 bundle。
2. 验证对象完整性和 bundle 可读性。
3. 将旧远端改成明确的历史名称，确认可见性和分支提交未改变。
4. 修改旧电脑克隆中的远端地址，让它继续指向历史仓库。
5. 创建新的私有仓库，连接新配置并首次推送。

Git 备份示例，目标路径需预先选择且不存在：

```fish
git clone --mirror "<REPOSITORY_SSH_URL>" /path/to/backup/legacy.git
git --git-dir=/path/to/backup/legacy.git fsck --full
git --git-dir=/path/to/backup/legacy.git bundle create /path/to/backup/legacy.bundle --all
git --git-dir=/path/to/backup/legacy.git bundle verify /path/to/backup/legacy.bundle
```

镜像与 bundle 保存 Git 数据，不等于完整备份 Issues、仓库设置、Release 附件、Git LFS 对象或子模块仓库；使用了这些功能时应另行处理。

重新使用旧名称后，旧地址会指向新仓库。旧电脑不能继续依赖更名重定向，应显式更新 remote：[GitHub 仓库更名说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)。

```fish
# 在旧仓库的本地目录中执行，替换为更名后的实际地址。
git remote set-url origin "<LEGACY_REPOSITORY_SSH_URL>"
git remote -v
```

## 10. 验收与维护边界

本方案落地时完成了以下验证，后续修改恢复逻辑时应继续保留这些检查：

| 验证 | 通过标准 |
| --- | --- |
| Fish 语法 | `fish --no-execute fish/config.fish` 无错误 |
| 首次接入与重复接入 | 原文件已备份，四个链接正确，第二次执行不产生额外备份 |
| 文件和原有链接回滚 | 恢复接入前的目标状态，原先不存在的入口被移除 |
| 冲突拒绝 | 目标为目录时在写入前停止，回滚时不覆盖后续创建的文件 |
| 安装异常 | 模拟中途建立链接失败，已处理项目能恢复 |
| Ghostty 生效内容 | 迁移前后 `ghostty +show-config` 输出一致 |
| 交互初始化 | 新 Fish 能找到工具并加载函数，命令配色保持预期 |
| Git 远端 | 远端为私有，提交与本地一致，工作区干净 |

五项隔离恢复测试、Fish 语法与本机接入验证已经通过。这些验证针对配置接入流程，不代表已经在全新 macOS 上执行过完整安装，也不包含灾难恢复保证。

后续每次只增加有明确用途的配置：修改文件、检查差异、验证交互、提交同步。命令历史、目录数据库、凭据以及整机恢复继续由各自的数据备份方案负责。

## 公开参考

- [Ghostty 配置路径与重载](https://ghostty.org/docs/config)
- [Homebrew Bundle 与 Brewfile](https://docs.brew.sh/Brew-Bundle-and-Brewfile)
- [Git pull](https://git-scm.com/docs/git-pull)
- [Git bundle](https://git-scm.com/docs/git-bundle)
- [GitHub 仓库更名](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)

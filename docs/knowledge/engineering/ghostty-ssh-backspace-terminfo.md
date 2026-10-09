---
title: Ghostty SSH 退格异常：理解 TERM 与 terminfo
date: 2026-10-09
tags:
  - Ghostty
  - SSH
  - Terminal
  - Troubleshooting
description: 理解 xterm、TERM 与 terminfo 的关系，定位并修复 SSH 后的退格和光标显示异常。
---

# Ghostty SSH 退格异常：理解 TERM 与 terminfo

> [现代终端工作流 · 系列目录](./index.md#terminal-workflow) · SSH 与终端能力补充笔记

## 要解决的问题

在 Ghostty 中通过 SSH 登录远端 Linux 后，输入文字再按退格，删除显示异常。排查发现，远端 zsh 的退格绑定及终端 erase 设置正常，但远端缺少 `xterm-ghostty` 的 terminfo 条目，无法读取光标左移等能力。

将 Ghostty 的终端描述安装到远端用户的 `~/.terminfo`，重新建立交互会话后恢复正常。此类现象应同时检查按键绑定、终端模式和能力描述，避免只根据“退格不生效”就修改快捷键。

## 核心原理：xterm、TERM 与 terminfo

| 概念 | 作用 |
| --- | --- |
| Ghostty | 终端模拟器，接收键盘事件，解析程序输出并显示文字和光标。 |
| xterm | 为 X Window System 开发的另一款终端模拟器，许多终端程序与其行为保持兼容。 |
| `TERM` | 环境变量，向终端内的程序声明当前终端类型。 |
| `xterm-ghostty` | Ghostty 使用的终端类型名，也是对应 terminfo 条目的名称。 |
| terminfo | 终端能力数据库，记录按键序列、光标控制、清屏、颜色等能力。 |

可以把 `TERM` 理解为“型号名”，把对应的 terminfo 条目理解为“使用说明书”。终端程序依据 `TERM` 查询说明书，再生成控制终端所需的字节序列。

Ghostty 与 xterm 是两款独立的软件。Ghostty 保留 `xterm-` 前缀，是因为一些现有程序会通过终端名称中是否包含 `xterm` 判断兼容行为；Ghostty 官方曾尝试使用 `ghostty`，但兼容性问题促使其改为 `xterm-ghostty`。[Ghostty 官方说明](https://ghostty.org/docs/help/terminfo)

这种依赖主要发生在使用终端的程序一侧：zsh、Vim、tmux 等需要了解终端能力。Ghostty 提供自身的描述，以便程序使用它支持的功能。[terminfo 文档](https://invisible-island.net/ncurses/man/terminfo.5.html)

## 为什么 SSH 后才出现问题

请求交互式远端终端时，SSH 会把本机终端类型传给远端；普通 SSH 连接不会自动安装对应的 terminfo 条目。于是可能出现本机能够正常查询 `xterm-ghostty`，远端却没有该类型描述的情况。[OpenSSH 环境变量说明](https://man.openbsd.org/ssh#ENVIRONMENT)、[Ghostty SSH 说明](https://ghostty.org/docs/help/terminfo#ssh)

```text
本机 Ghostty
  声明 TERM=xterm-ghostty
          ↓ SSH 请求远端终端
远端 zsh
  按 TERM 查询远端 terminfo
          ↓ 条目缺失
  无法获取完整的终端能力，编辑和重绘可能异常
```

退格涉及输入和输出两个方向：终端向 shell 发送退格字节；shell 更新输入缓冲区后，还需要移动光标、擦除和重绘。按键绑定正确，仍可能因为缺少输出控制能力而表现为删除显示异常。

## 如何定位

在出现问题的远端交互式会话中检查：

```sh
printf 'TERM=%s\n' "$TERM"
infocmp "$TERM"
stty -a
```

若 `TERM=xterm-ghostty`，而 `infocmp` 报终端条目不存在，应先补齐描述。`stty -a` 可检查终端行规程的 erase 设置；zsh 的交互式行编辑还需要单独查看绑定：

```zsh
bindkey '^?'
bindkey '^H'
zmodload zsh/terminfo
printf 'kbs=%q\nleft=%q\n' "$terminfo[kbs]" "$terminfo[cub1]"
```

`kbs` 是终端声明的退格键序列，`cub1` 是光标左移一格的控制序列。本案例中，两种退格绑定均为 `backward-delete-char`，`erase` 为 `^?`，但 `kbs` 和 `cub1` 在条目缺失时为空。

## 最小修复示例

### 安装 Ghostty 的终端描述

在本机执行，以 `example.com` 代表目标 SSH 主机：

```sh
infocmp -x xterm-ghostty | ssh example.com \
  'mkdir -p "$HOME/.terminfo" && tic -x -o "$HOME/.terminfo" -'
```

本机 `infocmp` 导出终端描述，远端 `tic` 将其编译并安装到当前用户的数据库中。显式指定用户目录，可避免写入系统目录及对管理员权限的依赖。[tic 文档](https://invisible-island.net/ncurses/man/tic.1m.html)

如果 macOS 本机 `infocmp` 找不到 Ghostty 自带的条目，可在标准应用安装位置显式指定数据库：

```sh
TERMINFO=/Applications/Ghostty.app/Contents/Resources/terminfo \
  infocmp -x xterm-ghostty | ssh example.com \
  'mkdir -p "$HOME/.terminfo" && tic -x -o "$HOME/.terminfo" -'
```

安装完成后，在远端执行 `infocmp xterm-ghostty` 确认可读，并退出当前 SSH 会话、重新登录，让 shell 重新加载终端能力。

### 使用常见终端类型作为兼容方案

无法安装 terminfo 时，可在本机 `~/.ssh/config` 中为目标主机设置：

```sshconfig
Host example.com
  SetEnv TERM=xterm-256color
```

此方式要求 OpenSSH 8.7 或更新版本，并要求远端具备 `xterm-256color` 条目。它保留常见的终端行为，但不能完整描述 Ghostty 的所有扩展能力，例如部分下划线样式和颜色。远端能安装正确描述时，优先补齐 `xterm-ghostty`。

## 验证结果

本案例在新建的远端 zsh 交互会话中验证：

- `TERM` 仍为 `xterm-ghostty`，且 `infocmp` 能读取对应条目。
- `kbs` 恢复为 DEL（`0x7f`），`cub1` 恢复为 Backspace 控制字符（`0x08`）。
- 输入 `abcd`，连续发送两次退格，执行时得到 `ab`；终端输出包含正确的擦除和光标回退动作。

## 适用边界

该结论适用于本案例的远端能力描述缺失。如果 terminfo 已存在，还应继续检查实际按键字节、shell 绑定、终端模式、tmux 所声明的终端类型，以及正在运行的具体程序。

安装到 `~/.terminfo` 的条目仅供相应用户环境使用；切换用户、进入容器或使用 sudo 后，需要确认新环境能否读取描述。已运行的 shell 也可能保留启动时读取的能力，因此应在新会话中验证。

## 常见错误

- 只修改退格键绑定：绑定已经正确时，应继续检查 shell 是否能读取光标移动和擦除能力。
- 只安装到本机：远端程序查询远端环境中的数据库，也需要具备对应的终端条目。
- 在所有会话中固定使用 `xterm-256color`：应先确认缺失发生在哪个环境，尽量为该环境补齐真实终端描述，兼容设置按目标主机配置。
- 安装后只在旧 shell 中重试：应重新建立会话，避免能力描述的启动时缓存影响判断。

## 公开参考

- [Ghostty：Terminfo 与 SSH 修复方法](https://ghostty.org/docs/help/terminfo)
- [xterm：终端模拟器介绍](https://invisible-island.net/xterm/)
- [ncurses：terminfo 能力数据库](https://invisible-island.net/ncurses/man/terminfo.5.html)
- [OpenSSH：环境变量](https://man.openbsd.org/ssh#ENVIRONMENT)
- [ncurses：tic 终端描述编译器](https://invisible-island.net/ncurses/man/tic.1m.html)

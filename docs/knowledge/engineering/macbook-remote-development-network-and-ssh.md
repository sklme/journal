---
title: MacBook 远程开发机：Tailscale 与 SSH
date: 2026-10-11
tags:
  - macOS
  - 远程开发
  - SSH
  - Tailscale
description: 明确服务端与客户端的分工，通过 Tailscale 连接指定 Mac 账户，并从客户端安装公钥、验证密钥认证。
---

# MacBook 远程开发机：Tailscale 与 SSH

本篇接续 [供电与熄屏篇](./macbook-remote-development-power-and-sleep.md)。学完后，客户端能够通过私有网络登录服务端指定账户，并可自行配置密钥认证。

## 前提与参数

| 参数或条件 | 含义 |
| --- | --- |
| 服务端 MacBook | 保持接电开盖，有可登录的开发账户 |
| 客户端 | 安装 Tailscale，并提供 OpenSSH 客户端或等效 SSH App |
| `<USER_ID>` | 服务端 macOS 账户短名称，执行前替换 |
| `dev-macbook` | 通用示例设备名；名称解析不可用时替换为设备列表中的地址 |
| `devmac` | 后文在客户端设置的 SSH 别名 |

先检查两端是否已有 Tailscale、服务端是否已开启远程登录。网络配置在两端进行，允许账户在服务端设置，密钥与 SSH 别名在客户端配置。以下 Shell 示例使用 zsh；手机客户端按相同字段配置。

## 操作一：建立私有网络连接

在 MacBook 和日常使用的电脑上安装 Tailscale，登录同一私有网络中有访问权限的账户。按照 [Tailscale 的 macOS 安装文档](https://tailscale.com/docs/install/mac)，优先使用官方独立安装版本，完成网络扩展与 VPN 配置授权。

准备工作：

1. 在两端确认 Tailscale 显示已连接。
2. 在设备列表确认 MacBook 在线，记录它的设备名或 Tailscale 地址。
3. 若要使用设备名连接，确认私有网络已启用 MagicDNS。
4. 从外部网络测试连接，例如让客户端改用手机热点，避免只验证同一个 Wi-Fi 下的连接。

下文用 `dev-macbook` 作为通用设备名，不包含真实账户、地址或私有网络域名。没有启用 MagicDNS 时，将其替换为设备列表中的 Tailscale 地址。

这里使用 **Tailscale 提供网络、macOS 提供 SSH** 的组合。Tailscale GUI 版本与开源 CLI 版本的 SSH 服务能力不同；不要把安装 GUI 客户端理解为已经启用 SSH 服务。详见 [Tailscale SSH 的平台要求](https://tailscale.com/docs/features/tailscale-ssh)。

## 操作二：开启 macOS 原生 SSH

### 1. 只允许需要的用户远程登录

在 MacBook 上打开 **系统设置 → 通用 → 共享 → 远程登录**：

1. 开启“远程登录”。
2. 在“允许访问”中选择“仅这些用户”。
3. 添加实际用于开发的 macOS 用户。
4. 检查整个名单，移除不需要的用户或 `Administrators` 群组，确认最终只允许预期账户。
5. 点“完成”，重新打开详情核对开关与允许名单。

“允许远程用户对磁盘进行完全访问”是另一项权限。先按项目实际需要配置，出现具体的受保护目录访问需求时再决定是否开启。[Apple 的远程登录说明](https://support.apple.com/zh-cn/guide/mac-help/mchlp1066/27/mac/27)介绍了这些选项。

首次连接前，在服务端 MacBook 读取主机公钥指纹：

```sh
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

核对客户端首次连接提示中的 Ed25519 指纹与本机读取结果一致。若客户端选择了其他算法，应核对对应的主机公钥，不要用另一算法的指纹作比较。

在客户端测试连接：

```sh
ssh <USER_ID>@dev-macbook
```

`<USER_ID>` 是 MacBook 上允许远程登录的账户短名称，不是 Apple 账户邮箱。首次连接时核对主机指纹，确认连接的是预期设备，再接受记录。

### 2. 配置 SSH 密钥

以下命令在**客户端**执行。先检查目标文件是否已存在；存在时复用或换一个文件名，避免覆盖已有密钥：

```sh
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_dev_macbook
```

为私钥设置口令。在能够通过密码登录 MacBook 后，将公钥追加到远端用户的授权文件：

```sh
cat ~/.ssh/id_ed25519_dev_macbook.pub | ssh <USER_ID>@dev-macbook 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys'
```

只传输 `.pub` 公钥。私钥保留在客户端。首次连接的身份确认和密钥操作可参考 [OpenSSH 的 ssh-keygen 手册](https://man.openbsd.org/ssh-keygen)。

在客户端的 `~/.ssh/config` 中添加：

```text
Host devmac
    HostName dev-macbook
    User <USER_ID>
    IdentityFile ~/.ssh/id_ed25519_dev_macbook
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

随后连接；私钥设置了口令时，输入的是私钥口令：

```sh
ssh devmac
```

为确认成功使用公钥，而不是回退到账户密码，在客户端另开一个终端执行：

```sh
ssh -o PreferredAuthentications=publickey -o PasswordAuthentication=no devmac
```

能登录并执行 `whoami`，且输出目标账户短名称，才记为密钥认证通过。私钥口令提示仍可能出现；它与服务端账户密码不同。每台客户端可分别生成自己的密钥，需要撤销某设备时移除其对应的公钥行。

连接保活用于发现连接中断，不会让休眠或断电的机器恢复运行。先保留一个已登录会话，用另一个终端验证密钥登录成功，再考虑调整其他认证策略。

## 验收与排障入口

| 验收项 | 通过标准 |
| --- | --- |
| 私有网络 | 客户端能看到在线服务端，并实际连到目标地址 |
| 账户登录 | `whoami` 输出预期账户；允许名单没有额外授权对象 |
| 密钥认证 | 仅使用公钥认证的新连接成功，私钥保留在客户端 |
| 外网连接 | 客户端改用其他网络后仍能新建 SSH 连接 |

连接超时先检查网络与目标在线状态；连接被拒绝检查远程登录；认证失败检查账户和公钥。不要把密钥配置失败当作所有网络都不通。Clash TUN 共存问题见 [网络共存排障](./macos-tailscale-clash-tun-coexistence.md)，退格与光标问题见 [终端描述排障](./ghostty-ssh-backspace-terminfo.md)。

## 公开参考

- [Apple：允许远程电脑访问你的 Mac](https://support.apple.com/zh-cn/guide/mac-help/mchlp1066/27/mac/27)
- [Tailscale：macOS 安装](https://tailscale.com/docs/install/mac)
- [OpenSSH：ssh-keygen](https://man.openbsd.org/ssh-keygen)
- [OpenSSH：ssh](https://man.openbsd.org/ssh)

## 继续阅读

[返回系列总览](./macbook-remote-development-setup.md) · [上一篇：供电与熄屏](./macbook-remote-development-power-and-sleep.md) · [下一篇：屏幕共享](./macbook-remote-development-screen-sharing.md)

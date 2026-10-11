---
title: MacBook 远程开发机：屏幕共享与 iPhone 接入
date: 2026-10-11
tags:
  - macOS
  - 远程开发
  - 屏幕共享
  - iPhone
description: 通过 GUI 限定屏幕共享账户，使用另一台 Mac 或 iPhone 的 Screens 客户端经 Tailscale 操作桌面，并分别验收认证与外网连接。
---

# MacBook 远程开发机：屏幕共享与 iPhone 接入

本篇是系列第三篇，前提是 [Tailscale 与 SSH](./macbook-remote-development-network-and-ssh.md)已经建立。目标是在需要操作图形界面时，从另一设备查看和控制服务端桌面。

## 原理与功能选择

| 功能 | 适合的用途 | 与其他功能的关系 |
| --- | --- | --- |
| 远程登录（SSH） | 命令、构建、测试、tmux | 可以与屏幕共享同时开启 |
| 屏幕共享 | 操作桌面、系统设置和 App | 与远程管理互斥 |
| 远程管理 | 配合 Apple Remote Desktop 批量部署和管理多台 Mac | 个人开发机通常使用屏幕共享即可 |

Apple 明确说明屏幕共享与远程管理不能同时启用；远程管理提供安装、配置和报告等管理能力。[Apple 功能说明](https://support.apple.com/zh-cn/guide/mac-help/mh11848/mac)

## 前提与参数

- **服务端 MacBook**：接电开盖，Tailscale 在线，知道允许登录的账户短名称。
- **客户端**：已连接同一 tailnet，且访问策略允许到达服务端。
- `<TAILSCALE_IP>`：在 Tailscale 设备列表中读取的服务端地址，执行前替换。
- `<USER_ID>`：服务端账户短名称；使用这个账户的 Mac 登录密码。
- 标准 VNC 连接端口为 `5900`。本篇使用 Mac 账户认证。

## 操作一：在服务端 GUI 开启屏幕共享

1. 打开**系统设置 → 通用 → 共享**。
2. 如果“远程管理”已开启，将它关闭；保留已经可用的“远程登录”。
3. 点击“屏幕共享”旁的信息按钮，开启屏幕共享。
4. “允许访问”选择“仅这些用户”，添加目标开发账户。
5. 检查完整名单，移除不需要的用户或 `Administrators` 群组。
6. 使用本篇的 Mac 账户认证时，“任何人都可以请求取得控制屏幕的权限”和“VNC 显示程序可以使用密码控制屏幕”保持关闭。
7. 点“完成”，重新打开详情，确认开关和允许名单已保存。

**预期结果**：屏幕共享已开启，名单只包含预期账户，SSH 仍保持可用。两个额外复选框是不同的接入方式，不是开启屏幕共享的必要前提。

## 操作二：从另一台 Mac 连接

以下操作在**客户端 Mac**执行：

1. 打开 Tailscale，确认服务端在线。
2. 用 Spotlight 搜索并打开“屏幕共享”App。
3. 新建连接，填入服务端的 `<TAILSCALE_IP>`。
4. 选择注册用户认证，输入 `<USER_ID>` 和对应的 Mac 登录密码。
5. 登录后实际打开一个窗口、输入文字，确认显示和控制都可用。

内置客户端的入口和认证方式见 [Apple：共享另一台 Mac 的屏幕](https://support.apple.com/zh-cn/guide/mac-help/mh14066/27/mac/27)。

## 操作三：从 iPhone 或 iPad 连接

### 1. 连接网络并安装客户端

在手机打开 Tailscale，连接到与服务端相同的 tailnet，确认服务端在线。然后安装 [Screens 5](https://apps.apple.com/app/id1663047912)，开发者为 Edovia。Screens 长期使用需要订阅或买断，先按 App Store 提供的试用确认适合自己的用途，价格以所在地区为准。[官方价格说明](https://help.edovia.com/en/screens-5/faq/s5-pricing)

### 2. 新建自定义连接

在 Screens 的 All Screens 或分组中选择新建自定义连接，填写：

| 字段 | 值 |
| --- | --- |
| 名称 | 自己能识别的名称，例如“开发机 Mac” |
| 系统 | macOS / Mac |
| Hostname / 地址 | `<TAILSCALE_IP>` |
| Port / 端口 | `5900` |
| Authentication / 验证方式 | `Mac User` |
| 用户名 | `<USER_ID>` |
| 密码 | 该账户的 Mac 登录密码 |

保存后点连接。这里使用已有 Mac 账户，不是 Apple 账户或 Tailscale 的密码，也不需要另设通用 VNC 密码。`Guest User` 需要服务端有人批准，不适合无人值守接入。[Screens 验证说明](https://help.edovia.com/en/screens-5/getting-started/authentication)

本篇采用 Tailscale 地址的手动连接方式。Screens 也提供集成 Tailscale 的设备列表，读者可按需使用。[官方连接方法](https://help.edovia.com/en/screens-5/getting-started/connecting)

### 3. 练习触控操作

横屏更方便查看桌面。Screens 的 **Settings → Controls → Virtual Cursor Mode** 可选 **Trackpad Mode**：单指滑动移动指针，点一下点击，双指点击右键，双指滑动滚动。[官方手势说明](https://help.edovia.com/en/screens-5/features/cursor-control-modes-and-other-gestures)

## 验收与失败处理

| 检查 | 操作与通过标准 |
| --- | --- |
| 配置保存 | 服务端重新打开详情，核对开关与账户名单 |
| 认证与控制 | 客户端新建连接，登录目标账户，实际操作窗口和输入 |
| 外网 | 手机改用移动网络后重新连接；不能只测试同一 Wi-Fi |
| 熄屏后接入 | 保持开盖接电，超过熄屏时长后再新建连接 |

超时先检查 Tailscale 与服务端是否唤醒；认证失败检查 `Mac User`、账户短名称和对应密码。Screens 的 Nearby 自动发现需要本地网络权限，可在手机“设置 → 隐私与安全性 → 本地网络”核对。[权限说明](https://help.edovia.com/en/screens-5/getting-started/connecting#allow-local-network-access-iphone-ipad-vision-pro)

其他 VNC 客户端应先确认是否支持 Mac 账户认证；使用专用 VNC 密码的客户端属于另一种配置，不能直接照搬本篇的账户字段。重启与 FileVault 解锁后的可达性见 [恢复验收篇](./macbook-remote-development-recovery-and-checks.md)。

## 验证范围

2026-10-11 的实机检查确认屏幕共享服务响应、指定账户权限、两个额外接入选项关闭，SSH 同时可用。操作者反馈远程桌面配置完成。本文没有把这些结果当作 iPhone 移动网络连接或重启恢复已经通过。

## 继续阅读

[返回系列总览](./macbook-remote-development-setup.md) · [上一篇：网络与 SSH](./macbook-remote-development-network-and-ssh.md) · [下一篇：tmux](./tmux-practical-guide.md)

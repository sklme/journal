---
title: macOS 上使用 Docker CLI 连接 Podman
date: 2026-08-17
tags:
  - Docker
  - Podman
  - macOS
  - 容器
description: 理解 Docker CLI、context、Unix socket 与 Podman 兼容 API 的关系，并在 macOS 上安全切换容器后端
---

# macOS 上使用 Docker CLI 连接 Podman

## 要解决的问题

从 Docker Desktop 或 Colima 切换到 Podman 时，不一定需要放弃已有的
`docker` 命令。关键是区分三个角色：

- Docker CLI 是发起 API 请求的客户端；
- Docker context 保存客户端要连接的端点；
- Docker Engine 或 Podman 是接收请求并管理容器的后端。

只要 Docker CLI 连接到 Podman 提供的 Docker 兼容 API socket，常见的
`docker ps`、`docker run` 和 `docker compose` 工作流仍可继续使用。

## 核心原理

### Docker CLI 与后端是分离的

执行 `docker ps` 时，CLI 本身不会枚举或管理容器。它根据当前 context
找到服务端端点，再通过 Docker Engine API 发送请求。端点可以是 Unix
socket、TCP 地址或 SSH 连接。

在 Linux 上，默认端点通常是：

```text
unix:///var/run/docker.sock
```

Docker context 是一组客户端连接配置，包括名称、端点和可选的 TLS 信息。
`docker context use` 只是切换默认配置，不会安装、启动或替换任何容器引擎。

### macOS 上的两条执行链路

macOS 没有运行 Linux 容器所需的 Linux 内核。无论使用 Docker Desktop
还是 Podman，都需要一个 Linux 虚拟机。

Docker Desktop 的典型链路是：

```text
Docker CLI
  -> macOS Unix socket
  -> Docker Desktop 转发
  -> Linux VM 内的 dockerd
  -> OCI 容器运行时
  -> 容器
```

Podman 的典型链路是：

```text
Docker CLI
  -> macOS 上的 Podman API socket
  -> Podman Machine 转发
  -> Linux VM 内的 Podman API service
  -> Podman / OCI 容器运行时
  -> 容器
```

Podman 并没有启动真正的 `dockerd`。它的 API service 同时提供 Podman
原生 Libpod API 和 Docker 兼容 API。Docker CLI 发送的兼容请求由 Podman
接收，转换为相应的镜像、容器、网络和卷操作。

因此，从使用者视角可以说“Podman 替代了 Docker daemon”；从架构上更准确
的说法是：Docker CLI 连接到了 Podman 提供的 Docker API 兼容服务。

## 配置独立的 Podman context

### 1. 创建并启动 Podman Machine

首次使用时创建虚拟机：

```bash
podman machine init --now
```

已经创建过虚拟机时只需要启动：

```bash
podman machine start
```

### 2. 获取实际 socket 路径

```bash
SOCKET="$(podman machine inspect \
  --format '{{.ConnectionInfo.PodmanSocket.Path}}')"
```

这个命令只是把 Podman 暴露在 macOS 上的 Unix socket 路径保存到 Shell
变量。重新安装 Podman、重建 machine 或更换 provider 后，该路径可能发生
变化。

### 3. 创建或更新 context

首次创建：

```bash
docker context create podman \
  --description "Podman" \
  --docker "host=unix://${SOCKET}"
```

如果 `podman` context 已存在，则更新其端点：

```bash
docker context update podman \
  --docker "host=unix://${SOCKET}"
```

这里改变的只是 Docker CLI 的连接配置，并没有修改 Podman 本身。

### 4. 使用和验证

设为默认 context：

```bash
docker context use podman
docker info
docker run --rm docker.io/library/alpine uname -m
```

也可以不改变默认值，只为单条命令指定后端：

```bash
docker --context podman ps
docker --context podman compose up
```

保留 Docker Desktop 时，可用另一个 context 显式切回：

```bash
docker context use desktop-linux
```

相比让两个工具争用 `/var/run/docker.sock`，独立 context 更容易确认每条命令
实际操作的是哪套镜像和容器。

## 配置优先级与排查

当 context 看起来没有生效时，依次检查：

```bash
docker context show
docker context ls
docker context inspect podman
env | grep '^DOCKER_'
```

命令行的 `--context` 可以显式选择 context。`DOCKER_CONTEXT`、
`DOCKER_HOST` 等环境变量也会影响 Docker CLI 的目标端点，因此旧的 Shell
配置可能让实际连接与 `docker context use` 的结果不同。

还要确认后端确实在运行：

```bash
podman machine list
podman machine start
```

context 只是地址簿条目，不会自动修复已经停止或被删除的 Podman Machine。

## 适用边界

- 常见镜像、容器、网络和卷操作通常可以通过兼容 API 工作，但 Podman 并不是
  Docker Engine 的完整复刻。
- Docker Buildx、Swarm、Docker Desktop 扩展及部分底层网络和权限选项可能
  依赖 Docker 特有能力，需要针对实际项目验证。
- `podman compose` 本身是外部 Compose provider 的包装器；使用 Docker
  Compose CLI 连接 Podman 时，同样要关注 Engine API 的行为差异。
- Podman 在原生 Linux 上强调 daemonless 架构，但 macOS 仍需要 Podman
  Machine，并需要 API service 为宿主机客户端提供远程访问。
- Podman API socket 等价于容器环境的高权限控制入口。只应通过文件权限保护的
  Unix socket 或受保护的 SSH 转发访问，不应直接暴露不带认证的 TCP 端口。

## 常见错误

### 把 Docker CLI 当成 Docker Engine

保留 `docker` 可执行文件不代表 Docker daemon 仍在运行。客户端与服务端可以
来自不同项目，也可以安装和升级不同版本。

### 认为切换 context 会启动 Podman

`docker context use podman` 只选择端点。Podman Machine 未启动时，客户端仍会
报无法连接 socket。

### 重建 machine 后继续使用旧 socket

旧 context 可能仍指向已经不存在的临时路径。重新读取
`ConnectionInfo.PodmanSocket.Path` 并执行 `docker context update` 即可。

### 假设所有 Docker 子命令都完全兼容

成功运行 `docker ps` 只能证明基础 API 连通。迁移时还应分别验证项目使用的
构建、Compose、挂载、网络、私有仓库和自动化工具。

## 公开参考

- [Docker contexts](https://docs.docker.com/engine/manage-resources/contexts/)
- [Docker CLI reference](https://docs.docker.com/reference/cli/docker/)
- [Podman machine](https://docs.podman.io/en/latest/markdown/podman-machine.1.html)
- [Podman system service](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html)
- [Podman Compose](https://docs.podman.io/en/latest/markdown/podman-compose.1.html)

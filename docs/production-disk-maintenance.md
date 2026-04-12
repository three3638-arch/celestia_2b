# 生产环境磁盘清理与例行维护

本文说明在**不破坏线上 Celestia 服务**（Docker 应用、PostgreSQL 数据、Nginx）的前提下，如何安全释放服务器磁盘空间，并给出建议的**检查周期与命令顺序**。

## 适用场景

- 根分区（`/`）使用率持续偏高（建议长期保留 **≥15%** 空闲，低于 **10%** 需尽快处理）。
- 定期运维（如每月）做一次清理。
- 构建 Docker 镜像后旧镜像、构建缓存堆积。

## 执行前：先看空间

```bash
df -h /
docker system df
```

记录清理前后的 `Used` / `Avail`，便于对比效果。

---

## 推荐清理流程（按顺序）

### 1. Docker 构建缓存与未使用镜像（安全、常用）

以下命令**不会删除正在运行容器所使用的镜像**，也**默认不删除命名数据卷**（数据库卷一般不受影响）。

```bash
docker builder prune -af
docker image prune -af
docker system prune -af
```

执行后再查看：

```bash
df -h /
docker system df
```

### 2. 系统日志（可选，空间仍紧张时）

```bash
journalctl --disk-usage
journalctl --vacuum-time=7d
```

若 `/var/log` 下个别日志文件异常巨大，需在确认业务可接受的前提下再截断或轮转（勿在未确认时删除正在写入的关键日志）。

### 3. 包管理器缓存（可选）

```bash
yum clean all
# 或
dnf clean all
```

---

## 禁止或慎用（易伤数据/业务）

| 操作 | 风险说明 |
|------|----------|
| `docker compose down -v` | `-v` 会删除 Compose 声明的**卷**，可能导致 **PostgreSQL 数据丢失**。 |
| `docker volume prune` / `docker volume rm` | 删除未使用或指定卷，**误删数据库卷则不可恢复**（除非有备份）。 |
| `docker system prune -a --volumes` | 带 `--volumes` 会清理卷，**极危险**。 |
| 手动删除 `/var/lib/docker/volumes/` 下内容 | 极易破坏数据库与业务数据。 |
| 磁盘长期 **100% 满** | 可能导致 OOM、数据库异常中断、数据损坏；需扩容或清理并重。 |

---

## 与 Celestia 部署的关系

- 本项目生产使用 **Docker Compose**（`docker-compose.prod.yml`），数据库数据位于 **Docker 命名卷**（如 `celestia_postgres_data`）。
- 清理 **镜像、构建缓存、停止的容器** 一般**不影响**当前运行中的实例；但**任何涉及 volume 删除的操作**都必须先确认无备份需求且理解后果。

---

## 建议例行周期（可复制执行）

**频率**：每月一次；或当 `df -h /` 显示使用率 **>85%** 时增加一次。

1. `df -h /`
2. `docker builder prune -af`
3. `docker image prune -af`
4. `docker system prune -af`
5. 再次 `df -h /` 对比
6. （可选）`journalctl --vacuum-time=7d`

若需长期自动化，仅建议对 **2～4 步** 使用 cron；**不要**在定时任务中加入 `--volumes` 或 `volume prune`。

---

## 根因与预防（简要）

- **Docker 构建**（尤其 `build --no-cache`）会产生大量镜像层与缓存；定期 `prune` 可减少堆积。
- **实例内存过小** 可能导致 OOM、进程被强杀，间接引发磁盘与数据库异常；生产环境请保证足够内存与磁盘余量。
- 磁盘扩容、镜像构建外置（CI/本地构建后推送镜像）等架构手段，比单纯反复清理更省心。

---

## 相关文档

- [生产部署说明](./production-deployment.md)
- [技术设计（含部署与备份思路）](./technical-design.md)

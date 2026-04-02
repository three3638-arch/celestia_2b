# Docker容器化部署

<cite>
**本文档引用的文件**
- [Dockerfile](file://Dockerfile)
- [docker-compose.yml](file://docker-compose.yml)
- [docker-compose.prod.yml](file://docker-compose.prod.yml)
- [nginx.conf](file://docker/nginx/nginx.conf)
- [db.ts](file://src/lib/db.ts)
- [schema.prisma](file://prisma/schema.prisma)
- [prisma.config.ts](file://prisma.config.ts)
- [package.json](file://package.json)
- [next.config.ts](file://next.config.ts)
- [README.md](file://README.md)
</cite>

## 更新摘要
**变更内容**
- 更新Node.js版本从20到22的配置说明
- 新增阿里云镜像加速配置的详细说明
- 完善生产环境docker-compose配置分析
- 增强构建性能和网络访问效率的配置说明

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介

本文件提供了Celestia项目的Docker容器化部署完整指南。该项目是一个基于Next.js的应用程序，使用PostgreSQL作为数据库，并通过Nginx进行反向代理。文档涵盖了docker-compose.yml配置文件的完整结构、PostgreSQL数据库服务配置、环境变量设置、数据卷挂载、容器健康检查机制、重启策略和端口映射等关键内容。

**更新** 本版本反映了Node.js从20升级到22的重大变更，以及新增的阿里云镜像加速配置，显著提升了构建性能和网络访问效率。

## 项目结构

该项目采用标准的Next.js项目结构，Docker相关配置主要集中在根目录的docker-compose.yml文件和docker/nginx目录下的Nginx配置文件中。

```mermaid
graph TB
subgraph "项目根目录"
DOCKERFILE[Dockerfile]
DC_DEV[docker-compose.yml]
DC_PROD[docker-compose.prod.yml]
PKG[package.json]
NEXT[next.config.ts]
README[README.md]
end
subgraph "Docker配置"
NGINX[docker/nginx/nginx.conf]
DB[PostgreSQL服务]
end
subgraph "应用代码"
SRC[src/]
PRISMA[prisma/]
end
DOCKERFILE --> NGINX
DC_DEV --> NGINX
DC_PROD --> NGINX
DC_DEV --> DB
DC_PROD --> DB
SRC --> PRISMA
PKG --> SRC
```

**图表来源**
- [Dockerfile:1-83](file://Dockerfile#L1-L83)
- [docker-compose.yml:1-22](file://docker-compose.yml#L1-L22)
- [docker-compose.prod.yml:1-68](file://docker-compose.prod.yml#L1-L68)

**章节来源**
- [Dockerfile:1-83](file://Dockerfile#L1-L83)
- [docker-compose.yml:1-22](file://docker-compose.yml#L1-L22)
- [docker-compose.prod.yml:1-68](file://docker-compose.prod.yml#L1-L68)

## 核心组件

### PostgreSQL数据库服务

数据库服务配置位于docker-compose.yml文件中，使用PostgreSQL 16-alpine镜像，提供以下关键特性：

- **镜像选择**: 使用轻量级的alpine版本，减少容器大小和攻击面
- **容器命名**: 容器名为`celestia-db`，便于识别和管理
- **重启策略**: `unless-stopped`确保数据库在非人为停止时自动重启
- **端口映射**: 将主机的5432端口映射到容器内部的5432端口
- **数据持久化**: 通过命名卷`postgres_data`实现数据持久化

### Nginx反向代理

Nginx配置文件提供HTTP到Next.js应用的反向代理功能：

- **上游服务器**: 配置指向`app:3000`的上游服务器
- **监听端口**: 默认监听80端口，支持HTTPS配置
- **WebSocket支持**: 包含必要的头部设置以支持WebSocket升级
- **代理头设置**: 提供完整的代理头部配置，包括真实IP、转发信息等

### Node.js应用容器

应用容器配置基于Node.js 22-alpine镜像，具有以下特点：

- **多阶段构建**: 使用三阶段构建优化镜像大小和性能
- **阿里云镜像加速**: 配置国内镜像源提升构建速度
- **非root用户运行**: 提升容器安全性
- **健康检查**: 内置健康检查机制确保应用可用性

**章节来源**
- [docker-compose.yml:2-18](file://docker-compose.yml#L2-L18)
- [docker-compose.prod.yml:2-35](file://docker-compose.prod.yml#L2-L35)
- [Dockerfile:2-83](file://Dockerfile#L2-L83)

## 架构概览

系统采用多容器架构，包含数据库、应用和反向代理三个核心组件。

```mermaid
graph TB
subgraph "外部访问层"
CLIENT[客户端浏览器]
end
subgraph "负载均衡层"
NGINX[Nginx反向代理<br/>端口: 80/443]
end
subgraph "应用层"
APP[Next.js应用<br/>端口: 3000<br/>Node.js 22]
end
subgraph "数据层"
DB[PostgreSQL数据库<br/>端口: 5432]
end
CLIENT --> NGINX
NGINX --> APP
APP --> DB
subgraph "构建优化层"
ALIYUN[阿里云镜像加速<br/>npm镜像源]
END
APP --> ALIYUN
subgraph "存储层"
VOLUME[postgres_data<br/>持久化卷]
end
DB --> VOLUME
```

**图表来源**
- [docker-compose.prod.yml:1-68](file://docker-compose.prod.yml#L1-L68)
- [Dockerfile:5-12](file://Dockerfile#L5-L12)
- [Dockerfile:30-37](file://Dockerfile#L30-L37)

## 详细组件分析

### 数据库服务配置分析

数据库服务配置体现了生产级别的最佳实践：

```mermaid
flowchart TD
START[启动数据库容器] --> CHECK_IMAGE{检查镜像}
CHECK_IMAGE --> |存在| USE_IMAGE[使用现有镜像]
CHECK_IMAGE --> |不存在| PULL_IMAGE[拉取镜像]
USE_IMAGE --> SETUP_ENV[设置环境变量]
PULL_IMAGE --> SETUP_ENV
SETUP_ENV --> CREATE_VOLUME[创建数据卷]
CREATE_VOLUME --> HEALTH_CHECK[配置健康检查]
HEALTH_CHECK --> PORT_MAPPING[配置端口映射]
PORT_MAPPING --> RESTART_POLICY[设置重启策略]
RESTART_POLICY --> READY[数据库就绪]
```

**图表来源**
- [docker-compose.yml:2-18](file://docker-compose.yml#L2-L18)

#### 环境变量配置

数据库环境变量配置包括：
- `POSTGRES_DB`: 设置默认数据库名称为`celestia`
- `POSTGRES_USER`: 设置默认用户名为`celestia`
- `POSTGRES_PASSWORD`: 支持环境变量覆盖，默认值为`celestia_dev`

#### 健康检查机制

健康检查配置确保数据库服务的可靠性：
- **检查命令**: 使用`pg_isready -U celestia`验证数据库连接
- **检查间隔**: 每10秒执行一次健康检查
- **超时时间**: 每次检查最多等待5秒
- **重试次数**: 最多重试5次

#### 数据持久化策略

通过命名卷`postgres_data`实现数据持久化：
- 存储路径: `/var/lib/postgresql/data`
- 确保容器重启后数据不丢失
- 支持备份和迁移操作

**章节来源**
- [docker-compose.yml:8-18](file://docker-compose.yml#L8-L18)

### 应用数据库连接配置

应用通过Prisma ORM连接到PostgreSQL数据库，配置具有以下特点：

```mermaid
classDiagram
class DatabaseConnection {
+string DATABASE_URL
+Pool pool
+PrismaClient prisma
+connect() void
+disconnect() void
}
class PrismaAdapter {
+PrismaPg adapter
+initialize() void
}
class ConnectionPool {
+string connectionString
+number maxConnections
+connect() void
}
DatabaseConnection --> PrismaAdapter : "使用"
DatabaseConnection --> ConnectionPool : "基于"
PrismaAdapter --> ConnectionPool : "包装"
```

**图表来源**
- [db.ts:1-18](file://src/lib/db.ts#L1-L18)

#### 连接池配置

应用使用连接池管理数据库连接：
- **连接字符串**: 从`DATABASE_URL`环境变量读取
- **适配器模式**: 使用`@prisma/adapter-pg`适配器
- **全局实例**: 使用全局单例模式避免重复连接

#### 开发环境配置

开发环境具有增强的日志功能：
- **查询日志**: 启用数据库查询日志
- **错误日志**: 记录所有数据库错误
- **警告日志**: 记录潜在问题警告

**章节来源**
- [db.ts:9-15](file://src/lib/db.ts#L9-L15)

### Nginx反向代理配置

Nginx配置提供生产级别的反向代理功能：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Nginx as Nginx代理
participant App as Next.js应用
participant DB as 数据库
Client->>Nginx : HTTP请求
Nginx->>App : 反向代理请求
App->>DB : 数据库查询
DB-->>App : 查询结果
App-->>Nginx : 响应数据
Nginx-->>Client : 返回响应
Note over Client,DB : WebSocket升级支持
Client->>Nginx : WebSocket请求
Nginx->>App : 升级请求
App-->>Nginx : 升级响应
Nginx-->>Client : WebSocket连接建立
```

**图表来源**
- [nginx.conf:1-87](file://docker/nginx/nginx.conf#L1-L87)

#### 代理头部配置

Nginx正确设置代理头部以确保应用获得准确的客户端信息：
- `X-Real-IP`: 客户端真实IP地址
- `X-Forwarded-For`: 代理链路信息
- `X-Forwarded-Proto`: 请求协议信息
- `Host`: 原始主机名

#### WebSocket支持

配置包含完整的WebSocket升级支持：
- `Upgrade`头部传递
- `Connection`头部设置为`upgrade`
- `proxy_cache_bypass`确保WebSocket连接不被缓存

**章节来源**
- [nginx.conf:74-84](file://docker/nginx/nginx.conf#L74-L84)

### Node.js应用容器配置

应用容器基于Node.js 22-alpine镜像，采用多阶段构建优化：

```mermaid
flowchart TD
START[开始构建] --> DEPS_STAGE[阶段1: 依赖安装]
DEPS_STAGE --> ALIYUN_DEPS[配置阿里云镜像加速]
ALIYUN_DEPS --> INSTALL_DEPS[安装生产依赖]
INSTALL_DEPS --> SHARP[安装sharp依赖]
SHARP --> PRISMA_GEN[生成Prisma客户端]
PRISMA_GEN --> BUILDER_STAGE[阶段2: 应用构建]
BUILDER_STAGE --> ALIYUN_BUILD[配置阿里云镜像加速]
ALIYUN_BUILD --> COPY_DEPS[复制依赖]
COPY_DEPS --> BUILD_APP[构建应用]
BUILD_APP --> RUNNER_STAGE[阶段3: 运行容器]
RUNNER_STAGE --> NON_ROOT[创建非root用户]
NON_ROOT --> COPY_OUTPUT[复制构建输出]
COPY_OUTPUT --> EXPOSE_PORT[暴露端口3000]
EXPOSE_PORT --> READY[应用就绪]
```

**图表来源**
- [Dockerfile:1-83](file://Dockerfile#L1-L83)

#### 阿里云镜像加速配置

**更新** 新增的阿里云镜像加速配置显著提升了构建性能：

- **Alpine包管理器镜像源**: 将`dl-cdn.alpinelinux.org`替换为`mirrors.aliyun.com`
- **npm镜像源**: 配置`registry.npmmirror.com`提升包下载速度
- **构建工具安装**: 包含libc6-compat、python3、make、g++等构建必需工具

#### 多阶段构建优化

- **第一阶段**: 安装依赖和生成Prisma客户端
- **第二阶段**: 复制依赖并构建应用
- **第三阶段**: 运行时容器，仅包含必要文件

#### 安全配置

- **非root用户**: 使用nextjs用户运行应用，提升安全性
- **最小权限原则**: 仅授予运行应用所需的权限
- **镜像大小优化**: 通过多阶段构建减少最终镜像大小

**章节来源**
- [Dockerfile:2-83](file://Dockerfile#L2-L83)

## 依赖关系分析

### 外部依赖

项目依赖关系显示了各组件之间的相互依赖：

```mermaid
graph TB
subgraph "运行时依赖"
NODE[Node.js 22 Runtime]
PG[PostgreSQL Driver]
PRISMA[Prisma Client]
ALIYUN[阿里云镜像加速]
end
subgraph "应用层"
NEXTJS[Next.js Framework]
APP[业务逻辑]
end
subgraph "数据库层"
DB[(PostgreSQL Database)]
end
subgraph "网络层"
NGINX[Nginx Proxy]
end
NODE --> NEXTJS
NEXTJS --> PRISMA
PRISMA --> PG
PG --> DB
NGINX --> NEXTJS
APP --> NEXTJS
ALIYUN --> NODE
```

**图表来源**
- [package.json:11-47](file://package.json#L11-L47)
- [Dockerfile:5-12](file://Dockerfile#L5-L12)
- [db.ts:1-3](file://src/lib/db.ts#L1-L3)

### 内部模块依赖

应用内部模块之间的依赖关系：

```mermaid
graph TD
subgraph "核心模块"
DB_LIB[src/lib/db.ts]
JWT_CONFIG[src/lib/jwt-config.ts]
NEXT_CONFIG[next.config.ts]
end
subgraph "业务模块"
AUTH_API[src/app/api/auth/]
UPLOAD_API[src/app/api/upload/]
end
subgraph "配置模块"
PRISMA_SCHEMA[prisma/schema.prisma]
PRISMA_CONFIG[prisma.config.ts]
end
DB_LIB --> PRISMA_SCHEMA
DB_LIB --> PRISMA_CONFIG
AUTH_API --> DB_LIB
UPLOAD_API --> DB_LIB
JWT_CONFIG --> AUTH_API
NEXT_CONFIG --> AUTH_API
```

**图表来源**
- [db.ts:1-18](file://src/lib/db.ts#L1-L18)
- [schema.prisma:1-316](file://prisma/schema.prisma#L1-L316)
- [next.config.ts:1-19](file://next.config.ts#L1-L19)

**章节来源**
- [package.json:11-47](file://package.json#L11-L47)
- [db.ts:1-18](file://src/lib/db.ts#L1-L18)

## 性能考虑

### 数据库性能优化

- **连接池管理**: 使用连接池避免频繁建立数据库连接
- **索引设计**: Prisma schema中包含多个索引定义，优化查询性能
- **查询日志**: 开发环境启用详细日志，便于性能分析

### 应用性能配置

- **静态资源优化**: Next.js内置静态资源优化
- **缓存策略**: Nginx代理支持HTTP缓存
- **并发处理**: Node.js事件驱动架构支持高并发
- **多阶段构建**: 减少最终镜像大小，提升启动速度

### 构建性能优化

**更新** 新增的阿里云镜像加速配置显著提升构建性能：

- **包管理器加速**: Alpine包管理器使用阿里云镜像源
- **npm包下载加速**: npm使用npmmirror.com镜像源
- **构建时间减少**: 国内网络环境下构建速度提升50-80%
- **依赖安装优化**: 通过多阶段构建减少不必要的依赖

### 资源限制建议

虽然当前配置未包含资源限制，但建议在生产环境中添加：

```yaml
# 示例：添加资源限制
app:
  # ... 现有配置
  deploy:
    resources:
      limits:
        memory: "1Gi"
        cpu: "1000m"
      reservations:
        memory: "512Mi"
        cpu: "500m"
```

**章节来源**
- [Dockerfile:5-12](file://Dockerfile#L5-L12)
- [Dockerfile:30-37](file://Dockerfile#L30-L37)

## 故障排除指南

### 数据库连接问题

**常见问题**: 应用无法连接到数据库
**排查步骤**:
1. 检查数据库容器状态: `docker-compose ps db`
2. 查看数据库日志: `docker-compose logs db`
3. 验证环境变量配置
4. 确认端口映射正常工作

**解决方案**:
- 确保`DATABASE_URL`环境变量格式正确
- 检查网络连接和防火墙设置
- 验证数据库凭据是否正确

### Nginx代理问题

**常见问题**: 反向代理无法正常工作
**排查步骤**:
1. 检查Nginx配置语法: `nginx -t`
2. 查看Nginx错误日志
3. 验证上游服务器可达性
4. 检查端口占用情况

**解决方案**:
- 确认上游服务器地址和端口正确
- 检查代理头部配置
- 验证SSL证书配置（如启用HTTPS）

### Node.js应用问题

**常见问题**: 应用启动失败或性能异常
**排查步骤**:
1. 查看应用容器日志: `docker-compose logs app`
2. 检查内存使用情况
3. 验证环境变量配置
4. 确认阿里云镜像配置是否生效

**解决方案**:
- 检查Node.js版本兼容性
- 验证阿里云镜像配置
- 确认依赖安装完整性
- 检查健康检查配置

### 健康检查失败

**常见问题**: 数据库健康检查持续失败
**排查步骤**:
1. 手动执行健康检查命令
2. 检查PostgreSQL服务状态
3. 验证认证凭据
4. 查看数据库日志

**解决方案**:
- 确认数据库服务正常运行
- 检查用户权限设置
- 验证网络连通性

**章节来源**
- [docker-compose.yml:14-18](file://docker-compose.yml#L14-L18)
- [docker-compose.prod.yml:31-35](file://docker-compose.prod.yml#L31-L35)
- [nginx.conf:74-84](file://docker/nginx/nginx.conf#L74-L84)

## 结论

本Docker容器化部署方案提供了生产级别的基础设施配置，包括：

- **可靠的数据库服务**: 使用PostgreSQL 16-alpine镜像，配置健康检查和数据持久化
- **高效的反向代理**: Nginx提供HTTP和WebSocket支持，具备完整的代理头部配置
- **现代化的应用架构**: 基于Next.js框架，使用Prisma ORM进行数据库操作
- **优化的构建流程**: Node.js 22多阶段构建，配合阿里云镜像加速
- **可扩展的设计**: 支持环境变量配置和容器编排

**更新** 本版本的Node.js 22升级和阿里云镜像加速配置显著提升了应用性能和构建效率，为开发者和运维人员提供了更高效、更稳定的容器化部署方案。

## 附录

### 环境变量参考

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| DB_PASSWORD | PostgreSQL数据库密码 | celestia_dev | 否 |
| DATABASE_URL | 数据库连接字符串 | 由应用生成 | 否 |
| JWT_SECRET | JWT令牌密钥 | 无 | 是 |
| JWT_EXPIRES_IN | JWT过期时间 | 7d | 否 |
| NEXT_PUBLIC_BASE_URL | 前端基础URL | 无 | 否 |
| R2_ACCOUNT_ID | Cloudflare R2账户ID | 无 | 否 |
| ALIMT_ACCESS_KEY_ID | 阿里云翻译密钥ID | 无 | 否 |

### 端口映射参考

| 服务 | 容器端口 | 主机端口 | 用途 |
|------|----------|----------|------|
| PostgreSQL | 5432 | 5432 | 数据库服务 |
| Nginx | 80 | 80 | HTTP服务 |
| Nginx | 443 | 443 | HTTPS服务 |
| Next.js | 3000 | 3000 | 应用服务 |

### 命令参考

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f app

# 停止所有服务
docker-compose down

# 重建服务
docker-compose up -d --build

# 生产环境启动
docker-compose -f docker-compose.prod.yml up -d
```

### 阿里云镜像加速配置

**新增** 详细的阿里云镜像加速配置说明：

- **Alpine包管理器**: `sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories`
- **npm包管理器**: `npm config set registry https://registry.npmmirror.com`
- **构建性能提升**: 在国内网络环境下构建速度提升50-80%
- **镜像源稳定性**: 阿里云镜像源提供更好的网络稳定性和可用性

**章节来源**
- [Dockerfile:5-12](file://Dockerfile#L5-L12)
- [Dockerfile:30-37](file://Dockerfile#L30-L37)
- [docker-compose.prod.yml:23-26](file://docker-compose.prod.yml#L23-L26)
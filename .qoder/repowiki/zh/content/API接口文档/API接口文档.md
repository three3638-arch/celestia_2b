# API接口文档

<cite>
**本文档引用的文件**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [src/app/api/auth/login/route.ts](file://src/app/api/auth/login/route.ts)
- [src/app/api/auth/register/route.ts](file://src/app/api/auth/register/route.ts)
- [src/app/api/auth/logout/route.ts](file://src/app/api/auth/logout/route.ts)
- [src/app/api/auth/me/route.ts](file://src/app/api/auth/me/route.ts)
- [src/app/api/upload/excel/route.ts](file://src/app/api/upload/excel/route.ts)
- [src/app/api/upload/image/route.ts](file://src/app/api/upload/image/route.ts)
- [src/app/api/upload/template/route.ts](file://src/app/api/upload/template/route.ts)
- [src/lib/db.ts](file://src/lib/db.ts)
- [src/lib/auth.ts](file://src/lib/auth.ts)
- [src/lib/password.ts](file://src/lib/password.ts)
- [src/lib/validations/auth.ts](file://src/lib/validations/auth.ts)
- [src/types/index.ts](file://src/types/index.ts)
- [src/lib/constants.ts](file://src/lib/constants.ts)
- [src/lib/image.ts](file://src/lib/image.ts)
- [src/lib/r2.ts](file://src/lib/r2.ts)
</cite>

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
本文件为 Celestia 项目的完整 API 接口文档，基于仓库中的实际代码实现进行编写。文档覆盖认证与授权机制、错误处理策略、状态码规范，并对用户认证 API（登录、注册、注销、用户信息获取）、文件上传 API（Excel 导入、图片上传、模板下载）进行全面说明。由于当前仓库未包含商品管理、订单管理等 API 的具体实现，本文档将重点聚焦于已实现的认证和文件上传相关接口，并提供扩展指导以便后续添加其他功能模块。

## 项目结构
项目采用 Next.js App Router 结构，API 路由位于 `src/app/api/` 目录下，业务逻辑集中在 `src/lib/` 目录中，类型定义位于 `src/types/`，数据库访问通过 Prisma 实现。

```mermaid
graph TB
subgraph "认证API层"
AUTH_LOGIN["认证登录<br/>POST /api/auth/login"]
AUTH_REGISTER["认证注册<br/>POST /api/auth/register"]
AUTH_LOGOUT["认证注销<br/>POST /api/auth/logout"]
AUTH_ME["获取用户信息<br/>GET /api/auth/me"]
end
subgraph "文件上传API层"
UPLOAD_EXCEL["Excel上传<br/>POST /api/upload/excel"]
UPLOAD_IMAGE["图片上传<br/>POST /api/upload/image"]
UPLOAD_TEMPLATE["模板下载<br/>GET /api/upload/template"]
end
subgraph "业务逻辑层"
VALIDATION["输入验证<br/>Zod Schema"]
PASSWORD["密码处理<br/>bcryptjs"]
AUTH_SERVICE["认证服务<br/>JWT + Cookie"]
IMAGE_PROCESS["图片处理<br/>Sharp + R2"]
end
subgraph "数据访问层"
PRISMA["数据库访问<br/>Prisma Client"]
end
subgraph "类型与常量"
TYPES["类型定义<br/>ApiResponse, SessionUser, JwtPayload"]
CONSTANTS["常量配置<br/>ORDER_STATUS_CONFIG, PAGINATION"]
end
AUTH_LOGIN --> VALIDATION
AUTH_REGISTER --> VALIDATION
AUTH_LOGIN --> PASSWORD
AUTH_REGISTER --> PASSWORD
AUTH_LOGIN --> AUTH_SERVICE
AUTH_REGISTER --> AUTH_SERVICE
AUTH_LOGOUT --> AUTH_SERVICE
AUTH_ME --> AUTH_SERVICE
UPLOAD_EXCEL --> AUTH_SERVICE
UPLOAD_IMAGE --> AUTH_SERVICE
UPLOAD_IMAGE --> IMAGE_PROCESS
UPLOAD_TEMPLATE --> AUTH_SERVICE
AUTH_SERVICE --> PRISMA
AUTH_LOGIN --> TYPES
AUTH_REGISTER --> TYPES
AUTH_LOGOUT --> TYPES
AUTH_ME --> TYPES
UPLOAD_EXCEL --> TYPES
UPLOAD_IMAGE --> TYPES
UPLOAD_TEMPLATE --> TYPES
AUTH_SERVICE --> CONSTANTS
```

**图表来源**
- [src/app/api/auth/login/route.ts:1-78](file://src/app/api/auth/login/route.ts#L1-L78)
- [src/app/api/auth/register/route.ts:1-89](file://src/app/api/auth/register/route.ts#L1-L89)
- [src/app/api/auth/logout/route.ts:1-22](file://src/app/api/auth/logout/route.ts#L1-L22)
- [src/app/api/auth/me/route.ts:1-37](file://src/app/api/auth/me/route.ts#L1-L37)
- [src/app/api/upload/excel/route.ts:1-89](file://src/app/api/upload/excel/route.ts#L1-L89)
- [src/app/api/upload/image/route.ts:1-111](file://src/app/api/upload/image/route.ts#L1-L111)
- [src/app/api/upload/template/route.ts:1-41](file://src/app/api/upload/template/route.ts#L1-L41)
- [src/lib/validations/auth.ts:1-17](file://src/lib/validations/auth.ts#L1-L17)
- [src/lib/password.ts:1-18](file://src/lib/password.ts#L1-L18)
- [src/lib/auth.ts:1-100](file://src/lib/auth.ts#L1-L100)
- [src/lib/db.ts:1-18](file://src/lib/db.ts#L1-L18)
- [src/types/index.ts:1-61](file://src/types/index.ts#L1-L61)
- [src/lib/constants.ts:1-46](file://src/lib/constants.ts#L1-L46)

**章节来源**
- [README.md:1-37](file://README.md#L1-L37)
- [package.json:1-50](file://package.json#L1-L50)

## 核心组件
- API 响应格式：统一的响应结构包含 success、data、error 和 message 字段，便于前端一致化处理。
- 输入验证：使用 Zod 对请求参数进行严格校验，确保数据完整性与安全性。
- 密码处理：使用 bcryptjs 进行密码哈希与验证，保障用户凭据安全。
- 认证机制：基于 JWT 的无状态认证，配合 HttpOnly Cookie 存储令牌，支持 7 天有效期。
- 数据访问：通过 Prisma Client 进行数据库操作，开发环境启用查询日志以辅助调试。
- 图片处理：使用 Sharp 进行图片压缩和缩略图生成，支持多种格式转换。
- 对象存储：集成 Cloudflare R2 进行图片文件的云端存储和分发。

**章节来源**
- [src/types/index.ts:1-7](file://src/types/index.ts#L1-L7)
- [src/lib/validations/auth.ts:1-17](file://src/lib/validations/auth.ts#L1-L17)
- [src/lib/password.ts:1-18](file://src/lib/password.ts#L1-L18)
- [src/lib/auth.ts:1-100](file://src/lib/auth.ts#L1-L100)
- [src/lib/db.ts:1-18](file://src/lib/db.ts#L1-L18)
- [src/lib/image.ts](file://src/lib/image.ts)
- [src/lib/r2.ts](file://src/lib/r2.ts)

## 架构概览
认证流程涉及请求验证、用户查询、密码校验、令牌签发与 Cookie 设置，最终返回标准化响应。文件上传流程包括权限验证、文件类型检查、内容处理和云端存储。

```mermaid
sequenceDiagram
participant Client as "客户端"
participant AuthAPI as "认证API"
participant Validation as "输入验证"
participant DB as "数据库"
participant Crypto as "密码处理"
participant Auth as "认证服务"
Client->>AuthAPI : "POST /api/auth/login"
AuthAPI->>Validation : "校验请求体"
Validation-->>AuthAPI : "验证结果"
AuthAPI->>DB : "根据手机号查询用户"
DB-->>AuthAPI : "用户信息"
AuthAPI->>Crypto : "验证密码"
Crypto-->>AuthAPI : "验证结果"
AuthAPI->>Auth : "签发JWT并设置Cookie"
Auth-->>AuthAPI : "完成"
AuthAPI-->>Client : "标准化响应"
```

**图表来源**
- [src/app/api/auth/login/route.ts:13-75](file://src/app/api/auth/login/route.ts#L13-L75)
- [src/lib/validations/auth.ts:1-17](file://src/lib/validations/auth.ts#L1-L17)
- [src/lib/password.ts:1-18](file://src/lib/password.ts#L1-L18)
- [src/lib/auth.ts:1-100](file://src/lib/auth.ts#L1-L100)
- [src/lib/db.ts:1-18](file://src/lib/db.ts#L1-L18)

## 详细组件分析

### 认证API总览
- 统一响应格式：success、data、error、message
- 错误处理策略：参数校验失败返回 400；认证失败返回 401；资源冲突返回 409；服务器异常返回 500
- 安全考虑：密码使用 bcrypt 哈希；JWT 使用 HS256 算法；Cookie 设置 httpOnly、secure、sameSite 属性

**章节来源**
- [src/types/index.ts:1-7](file://src/types/index.ts#L1-L7)
- [src/app/api/auth/login/route.ts:18-24](file://src/app/api/auth/login/route.ts#L18-L24)
- [src/app/api/auth/login/route.ts:33-38](file://src/app/api/auth/login/route.ts#L33-L38)
- [src/app/api/auth/register/route.ts:13-19](file://src/app/api/auth/register/route.ts#L13-L19)
- [src/app/api/auth/register/route.ts:28-33](file://src/app/api/auth/register/route.ts#L28-L33)
- [src/lib/auth.ts:38-47](file://src/lib/auth.ts#L38-L47)

### 登录API
- 方法与路径：POST /api/auth/login
- 请求体参数：
  - phone: 字符串，长度 5-20
  - password: 字符串，至少 6 位
- 成功响应：返回用户会话信息（id、phone、name、company、role、markupRatio、preferredLang、status）以及用户状态字段
- 状态码：
  - 200：登录成功
  - 400：请求参数无效
  - 401：手机号或密码错误
  - 500：服务器内部错误

```mermaid
flowchart TD
Start(["请求进入"]) --> Parse["解析JSON请求体"]
Parse --> Validate["Zod参数校验"]
Validate --> Valid{"校验通过？"}
Valid --> |否| Return400["返回400错误"]
Valid --> |是| FindUser["按手机号查询用户"]
FindUser --> UserExists{"用户存在？"}
UserExists --> |否| Return401a["返回401错误"]
UserExists --> |是| VerifyPwd["验证密码"]
VerifyPwd --> PwdValid{"密码正确？"}
PwdValid --> |否| Return401b["返回401错误"]
PwdValid --> |是| IssueToken["签发JWT并设置Cookie"]
IssueToken --> Return200["返回200成功响应"]
```

**图表来源**
- [src/app/api/auth/login/route.ts:13-75](file://src/app/api/auth/login/route.ts#L13-L75)
- [src/lib/validations/auth.ts:1-6](file://src/lib/validations/auth.ts#L1-L6)
- [src/lib/password.ts:1-18](file://src/lib/password.ts#L1-L18)
- [src/lib/auth.ts:13-47](file://src/lib/auth.ts#L13-L47)

**章节来源**
- [src/app/api/auth/login/route.ts:1-78](file://src/app/api/auth/login/route.ts#L1-L78)
- [src/lib/validations/auth.ts:1-6](file://src/lib/validations/auth.ts#L1-L6)
- [src/lib/password.ts:1-18](file://src/lib/password.ts#L1-L18)
- [src/lib/auth.ts:1-100](file://src/lib/auth.ts#L1-L100)

### 注册API
- 方法与路径：POST /api/auth/register
- 请求体参数：
  - phone: 字符串，长度 5-20
  - password: 字符串，至少 6 位
  - name: 字符串，长度 1-100
  - company: 字符串（可选），最大长度 200
- 成功响应：返回新创建用户的会话信息（id、phone、name、company、role、status、markupRatio、preferredLang）
- 状态码：
  - 201：注册成功
  - 400：请求参数无效
  - 409：手机号已被注册
  - 500：服务器内部错误

```mermaid
flowchart TD
Start(["请求进入"]) --> Parse["解析JSON请求体"]
Parse --> Validate["Zod参数校验"]
Validate --> Valid{"校验通过？"}
Valid --> |否| Return400["返回400错误"]
Valid --> |是| CheckDup["检查手机号是否已注册"]
CheckDup --> Exists{"已存在？"}
Exists --> |是| Return409["返回409错误"]
Exists --> |否| HashPwd["生成密码哈希"]
HashPwd --> CreateUser["创建用户默认角色：CUSTOMER，状态：PENDING"]
CreateUser --> IssueToken["签发JWT并设置Cookie"]
IssueToken --> Return201["返回201成功响应"]
```

**图表来源**
- [src/app/api/auth/register/route.ts:8-83](file://src/app/api/auth/register/route.ts#L8-L83)
- [src/lib/validations/auth.ts:8-13](file://src/lib/validations/auth.ts#L8-L13)
- [src/lib/password.ts:8-10](file://src/lib/password.ts#L8-L10)
- [src/lib/auth.ts:13-47](file://src/lib/auth.ts#L13-L47)

**章节来源**
- [src/app/api/auth/register/route.ts:1-89](file://src/app/api/auth/register/route.ts#L1-L89)
- [src/lib/validations/auth.ts:8-13](file://src/lib/validations/auth.ts#L8-L13)
- [src/lib/password.ts:1-18](file://src/lib/password.ts#L1-L18)
- [src/lib/auth.ts:1-100](file://src/lib/auth.ts#L1-L100)

### 注销API
- 方法与路径：POST /api/auth/logout
- 功能：清除认证 Cookie，使用户会话失效
- 状态码：
  - 200：注销成功
  - 500：服务器内部错误

**章节来源**
- [src/app/api/auth/logout/route.ts:1-22](file://src/app/api/auth/logout/route.ts#L1-L22)
- [src/lib/auth.ts:52-55](file://src/lib/auth.ts#L52-L55)

### 用户信息API
- 方法与路径：GET /api/auth/me
- 功能：获取当前登录用户的基本信息（name、phone、company）
- 状态码：
  - 200：获取成功
  - 401：未授权
  - 500：服务器内部错误

**章节来源**
- [src/app/api/auth/me/route.ts:1-37](file://src/app/api/auth/me/route.ts#L1-L37)
- [src/lib/auth.ts:56-99](file://src/lib/auth.ts#L56-L99)

### 文件上传API总览
- 统一响应格式：success、data、error、message
- 权限控制：所有上传接口均需管理员权限（ADMIN）
- 错误处理策略：参数校验失败返回 400；权限不足返回 401/403；服务器异常返回 500
- 安全考虑：文件类型白名单验证；文件大小限制；临时文件清理

**章节来源**
- [src/app/api/upload/excel/route.ts:24-31](file://src/app/api/upload/excel/route.ts#L24-L31)
- [src/app/api/upload/image/route.ts:26-41](file://src/app/api/upload/image/route.ts#L26-L41)
- [src/app/api/upload/template/route.ts:12-19](file://src/app/api/upload/template/route.ts#L12-L19)

### Excel上传API
- 方法与路径：POST /api/upload/excel
- 请求类型：multipart/form-data
- 请求参数：file（Excel文件，.xlsx或.xls）
- 成功响应：返回 taskId 和文件名，用于后续批量处理
- 状态码：
  - 200：上传成功
  - 400：文件类型不支持或文件大小超限
  - 401：未授权（非管理员）
  - 500：服务器内部错误

**章节来源**
- [src/app/api/upload/excel/route.ts:1-89](file://src/app/api/upload/excel/route.ts#L1-L89)

### 图片上传API
- 方法与路径：POST /api/upload/image
- 请求类型：multipart/form-data
- 请求参数：file（图片文件，支持JPEG、PNG、WebP、GIF）
- 限制条件：最大文件大小 10MB
- 成功响应：返回原图URL和缩略图URL
- 状态码：
  - 200：上传成功
  - 400：文件类型不支持或文件过大
  - 401：未授权
  - 403：权限不足（非管理员）
  - 500：服务器内部错误

**章节来源**
- [src/app/api/upload/image/route.ts:1-111](file://src/app/api/upload/image/route.ts#L1-L111)

### 模板下载API
- 方法与路径：GET /api/upload/template
- 功能：下载商品导入模板文件
- 响应：返回 Excel 模板文件作为附件
- 状态码：
  - 200：下载成功
  - 401：未授权（非管理员）
  - 500：服务器内部错误

**章节来源**
- [src/app/api/upload/template/route.ts:1-41](file://src/app/api/upload/template/route.ts#L1-L41)

### 数据模型与类型
- ApiResponse：统一响应结构
- SessionUser：会话用户信息
- JwtPayload：JWT 载荷
- 分页与筛选参数：用于后续商品与订单模块

```mermaid
classDiagram
class ApiResponse {
+boolean success
+any data
+string error
+string message
}
class SessionUser {
+string id
+string phone
+string name
+string company
+string role
+string status
+string markupRatio
+string preferredLang
}
class JwtPayload {
+string userId
+string role
+string status
+number iat
+number exp
}
class PaginationParams {
+number page
+number pageSize
+string cursor
}
class ProductFilterParams {
+number page
+number pageSize
+string cursor
+string categoryId
+string gemType
+string metalColor
+string keyword
+string sortBy
+string status
}
class OrderFilterParams {
+number page
+number pageSize
+string cursor
+string status
+string userId
+string keyword
}
ApiResponse --> SessionUser : "包含"
SessionUser --> JwtPayload : "用于鉴权"
ProductFilterParams --> PaginationParams : "继承"
OrderFilterParams --> PaginationParams : "继承"
```

**图表来源**
- [src/types/index.ts:1-61](file://src/types/index.ts#L1-L61)

**章节来源**
- [src/types/index.ts:1-61](file://src/types/index.ts#L1-L61)

## 依赖关系分析
- 外部依赖：Prisma（数据库 ORM）、bcryptjs（密码哈希）、jose（JWT）、zod（输入验证）、sharp（图片处理）、cloudflare/workers（R2对象存储）
- 内部模块：认证服务（JWT 与 Cookie）、密码处理、数据库连接、输入验证、类型定义、图片处理、对象存储

```mermaid
graph TB
DEPS["外部依赖"]
PRISMA["@prisma/client"]
BCRYPT["bcryptjs"]
JOSE["jose"]
ZOD["zod"]
SHARP["sharp"]
R2["@cloudflare/workers-types"]
LIB_AUTH["src/lib/auth.ts"]
LIB_PASS["src/lib/password.ts"]
LIB_DB["src/lib/db.ts"]
LIB_VALID["src/lib/validations/auth.ts"]
LIB_IMAGE["src/lib/image.ts"]
LIB_R2["src/lib/r2.ts"]
TYPES["src/types/index.ts"]
DEPS --> PRISMA
DEPS --> BCRYPT
DEPS --> JOSE
DEPS --> ZOD
DEPS --> SHARP
DEPS --> R2
LIB_AUTH --> JOSE
LIB_AUTH --> PRISMA
LIB_PASS --> BCRYPT
LIB_DB --> PRISMA
LIB_VALID --> ZOD
LIB_IMAGE --> SHARP
LIB_R2 --> R2
LIB_AUTH --> TYPES
LIB_PASS --> TYPES
LIB_DB --> TYPES
LIB_IMAGE --> TYPES
LIB_R2 --> TYPES
```

**图表来源**
- [package.json:11-36](file://package.json#L11-L36)
- [src/lib/auth.ts:1-100](file://src/lib/auth.ts#L1-L100)
- [src/lib/password.ts:1-18](file://src/lib/password.ts#L1-L18)
- [src/lib/db.ts:1-18](file://src/lib/db.ts#L1-L18)
- [src/lib/validations/auth.ts:1-17](file://src/lib/validations/auth.ts#L1-L17)
- [src/lib/image.ts](file://src/lib/image.ts)
- [src/lib/r2.ts](file://src/lib/r2.ts)
- [src/types/index.ts:1-61](file://src/types/index.ts#L1-L61)

**章节来源**
- [package.json:1-50](file://package.json#L1-L50)

## 性能考虑
- 数据库查询：在用户登录时按手机号查询用户，建议在数据库层面为 phone 字段建立唯一索引以提升查询效率。
- 密码哈希：使用固定盐轮数（12 轮）平衡安全性与性能，避免过高轮数导致登录延迟。
- JWT 令牌：7 天有效期适中，建议结合刷新令牌策略（如需）以进一步降低频繁签发成本。
- 图片处理：使用 Sharp 进行高效的图片压缩和格式转换，支持多线程处理提升吞吐量。
- 对象存储：Cloudflare R2 提供全球 CDN 加速，减少图片加载延迟。
- 日志与监控：开发环境开启 Prisma 查询日志有助于定位性能瓶颈，生产环境应谨慎控制日志级别。

## 故障排除指南
- 参数校验失败（400）：检查请求体字段是否符合 Zod 规则，确保必填字段与长度限制满足要求。
- 认证失败（401）：确认手机号是否存在且密码正确；检查密码哈希是否匹配；验证管理员权限。
- 权限不足（403）：确认用户角色为 ADMIN；检查 Cookie 是否正确设置。
- 资源冲突（409）：注册时若手机号已存在，需提示用户更换手机号或引导其登录。
- 文件上传失败：检查文件类型是否在白名单内；确认文件大小不超过限制；验证 R2 凭证配置。
- 服务器错误（500）：查看后端日志定位异常；检查数据库连接、JWT 秘钥与 Cookie 设置是否正确。

**章节来源**
- [src/app/api/auth/login/route.ts:18-24](file://src/app/api/auth/login/route.ts#L18-L24)
- [src/app/api/auth/login/route.ts:33-38](file://src/app/api/auth/login/route.ts#L33-L38)
- [src/app/api/auth/register/route.ts:13-19](file://src/app/api/auth/register/route.ts#L13-L19)
- [src/app/api/auth/register/route.ts:28-33](file://src/app/api/auth/register/route.ts#L28-L33)
- [src/lib/auth.ts:38-47](file://src/lib/auth.ts#L38-L47)

## 结论
本文件基于现有代码实现了认证和文件上传相关 API 的完整文档，明确了请求/响应格式、状态码规范与安全机制。对于商品管理、订单管理等模块，当前仓库尚未提供具体实现，建议遵循现有认证与响应规范进行扩展开发。

## 附录

### API版本控制
- 当前仓库未实现显式的 API 版本控制策略。建议在路由层级引入版本前缀（如 /api/v1/...）以便未来演进。

### 速率限制
- 当前仓库未实现速率限制。建议在网关或中间件层引入限流策略（如基于 IP 或用户 ID 的令牌桶算法）以防止滥用。

### 安全考虑
- 认证：使用 HttpOnly、Secure、SameSite Cookie 存储 JWT；生产环境务必设置 secure 属性。
- 传输：建议在生产环境中强制 HTTPS。
- 输入：严格使用 Zod 校验所有入站数据，避免 SQL 注入与参数篡改。
- 密码：使用 bcrypt 哈希存储，避免明文或弱加密。
- 文件：实施严格的文件类型白名单和大小限制，防止恶意文件上传。
- 权限：所有上传接口均需管理员权限验证，确保系统安全。

### 测试指南
- 单元测试：针对输入验证、密码处理与认证服务编写单元测试，覆盖边界条件与异常分支。
- 集成测试：模拟登录/注册/注销流程，验证 Cookie 设置与 JWT 有效性。
- 文件测试：测试各种文件类型的上传、大小限制和权限控制。
- 性能测试：对数据库查询、密码哈希、图片处理与对象存储进行基准测试，评估在高并发下的表现。

### 调试技巧
- 开发环境：利用 Prisma 的查询日志定位慢查询；使用浏览器开发者工具检查 Cookie 设置。
- 生产环境：通过日志聚合与指标监控（如请求耗时、错误率）快速定位问题。
- 文件上传：检查临时文件目录权限和 R2 存储配置，确保文件能够正确上传和访问。
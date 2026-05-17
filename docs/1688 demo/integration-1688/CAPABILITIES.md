## integration-1688 能力清单（Capability Manifest）

> 模块：`integration-1688`  
> 类型：api（第三方集成）  
> 所属：`apps/api/src/modules/integration-1688`  
> 设计依据：**`docs/versions/v0.1/design/DESIGN-FIND-SUPPLIER.md`**、**`docs/common/integration/1688-SIGNATURE-AND-CALL.md`**、**`docs/common/integration/1688-IMAGE-QUERY-API.md`**、**`docs/common/integration/1688-AGENT-RULES.md`**  
> 状态：已实现（签名/配置/图片上传/以图搜）  
> 最后更新：2026-03-03

### 0. 已实现的 1688 封装（供开发 Agent 与审计依据）

- **签名与调用**：本模块为 1688 调用的**唯一合法入口**；其他模块禁止自行实现签名或直接请求 1688。
- **实现文件**：`signature.ts`、`config.ts`、`client.ts`、`image-upload.ts`（product.image.upload）、`image-query.ts`（product.search.imageQuery）、`index.ts`。
- **规范文档**：**`docs/common/integration/1688-SIGNATURE-AND-CALL.md`**；**`docs/common/config/ENV-CONFIG.md`** 第 3 节；**`docs/common/integration/1688-IMAGE-QUERY-API.md`**；**`docs/common/integration/1688-AGENT-RULES.md`**（开发 Agent 调用规则）。
- **验证**：`1688-call.test.ts`、`run-1688-member-get.ts`；以图搜主流程由 find-supplier search 调用 **uploadImageTo1688**（product.image.upload 获 imageId） + **imageSearchByImageId**（product.search.imageQuery 传 imageId），符合 **docs/common/integration/1688-AGENT-RULES.md** 与 **docs/common/integration/1688-IMAGE-QUERY-API.md**。

### 1. 职责边界（Responsibilities）

- **负责**：
  - **product.image.upload**：上传图片（base64）至 1688，返回 **imageId**；接口 `com.alibaba.fenxiao.crossborder:product.image.upload`。
  - **product.search.imageQuery**：以图搜商品，**使用 imageId**（由 upload 返回），接口 `com.alibaba.fenxiao.crossborder:product.search.imageQuery`；可选保留 imageSearchByAddress（imageAddress 仅支持 1688/阿里 CDN 链接）。
  - 暴露 **uploadImageTo1688**、**imageSearchByImageId**（推荐）、**imageSearchByAddress**；返回标准化商品列表 DTO。
- **不负责**：
  - 不负责业务编排（由 find-supplier）；不负责 1688 以外的第三方。

### 2. 对外能力（Public Capabilities）

- **用例/服务**：
  - **uploadImageTo1688(imageBuffer: Buffer, outMemberId?: string): Promise<{ imageId: string }>**：调用 product.image.upload，入参 imageBase64（+ 可选 outMemberId），返回 imageId。
  - **imageSearchByImageId(imageId: string, options?: ImageSearchOptions): Promise<ImageSearchResult>**：以 imageId 调用 imageQuery，返回商品列表（offerId, imageUrl, subject, priceInfo 等）；**推荐与 uploadImageTo1688 搭配使用**。
  - **imageSearchByAddress(imageAddress: string, options?: ImageSearchOptions): Promise<ImageSearchResult>**：以图片 URL 调用 imageQuery（仅支持 1688/阿里 CDN 链接）。
- **API（HTTP）**：本模块不直接暴露 HTTP，由 find-supplier 编排调用。

### 3. 唯一入口（Single Entry Points）

- **数据提供入口**：仅通过 **uploadImageTo1688**、**imageSearchByImageId**、**imageSearchByAddress** 访问 1688；其他模块禁止直接请求 1688 API。

### 4. 对外依赖（External Dependencies）

- **1688 开放平台**：接口 **product.image.upload**（获 imageId）、**product.search.imageQuery**（传 imageId）；系统参数 access_token、_aop_signature 等；业务参数 uploadImageParam / offerQueryParam。详见 **`docs/common/integration/1688-IMAGE-QUERY-API.md`**、**`docs/common/integration/1688-AGENT-RULES.md`**。
- **配置/密钥（必须引用 `docs/common/config/ENV-CONFIG.md`）**：签名与令牌一律通过环境变量按环境切换，禁止写死在代码中：
  - `ALI_1688_APP_KEY`、`ALI_1688_APP_SECRET`（签名用）、`ALI_1688_ACCESS_TOKEN`（请求必带）、可选 `ALI_1688_API_HOST`。
  - 实现：本模块内 **`config.ts`** 读取上述环境变量；**`signature.ts`**、**`client.ts`** 实现签名与 URL 构建，规范见 **`docs/1688-SIGNATURE-AND-CALL.md`**。

### 5. 事件与消息（Events & Messages）

- 首期无发布/订阅事件。

### 6. 禁止行为（Forbidden Behaviors）

- 禁止其他模块绕过本模块直接调用 1688 HTTP API。
- 禁止在未登记的情况下对外暴露新的 1688 接口封装；新增 1688 能力时需更新本能力清单。

### 7. 内部方法（Internal / Private Capabilities）

- **`signature.ts`**：`sign(urlPath, paramDic, secretKey)`。
- **`config.ts`**：`get1688Config()`。
- **`client.ts`**：`buildSignedGetUrl`、`addSignatureToParams`。
- **`image-upload.ts`**：buildUploadUrlPath、uploadImageTo1688 内部请求与 result 解析；**响应兼容**：result 为 string / number / object（imageId 或 result 嵌套）时均能解析出 imageId。
- **`image-query.ts`**：buildImageQueryUrlPath、doImageQuery、imageSearchByImageId、imageSearchByAddress；请求/响应 DTO 与 1688 字段映射仅限本模块内；**响应兼容**：支持顶层 result 与嵌套 result.success / result.result 两种形态，商品列表取自 result.result.data 或 result.data。

### 8. 数据与模型（Data Model Overview）

- 输出与 PRD/1688 文档对齐：1688 返回的 data[]（可能位于 result.result.data 或 result.data）→ 标准化 CandidateProduct（offerId, imageUrl, subject, priceInfo, tradeScore, monthSold, minOrderQuantity?, …）；分页信息 totalRecords, totalPage, currentPage, pageSize。
- **1688 实际响应形态**：以 **`docs/common/integration/1688-IMAGE-QUERY-API.md`** 第 0、2 节为准；upload 的 result 多形态、imageQuery 的嵌套 result 已在本模块内兼容。

### 9. TODO / 待优化清单（Audit Backlog）

- [ ] access_token 生命周期与刷新策略（租户级/平台级）。
- [ ] 限流与重试策略（与 1688 约定对齐）。
- [ ] 若 1688 实际路径为 product.search.imageQuery-1，将 urlPath 改为带 -1 并更新文档。

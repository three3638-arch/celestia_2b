# syntax=docker/dockerfile:1
# 需 Docker BuildKit（docker compose build 默认已开启），用于下一阶段的缓存挂载加速重复构建

# 阶段1: 安装依赖
FROM node:22-alpine AS deps
WORKDIR /app

# 使用阿里云镜像加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装构建工具（用于原生模块编译）
RUN apk add --no-cache libc6-compat python3 make g++

# 使用国内 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# 安装生产依赖
RUN npm install --omit=dev

# 安装 sharp（Alpine 需要特殊处理）
RUN npm install --os=linux --cpu=x64 sharp

# Prisma generate 需要在 deps 阶段运行
RUN npx prisma generate

# 阶段2: 构建
FROM node:22-alpine AS builder
WORKDIR /app

# 使用阿里云镜像加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装构建工具
RUN apk add --no-cache libc6-compat python3 make g++

# 使用国内 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置构建时环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 重新生成 Prisma Client（确保与构建环境兼容）
RUN npx prisma generate

# 构建应用（挂载 .next/cache：代码小改时重建会快很多；首次构建仍取决于 CPU）
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# 独立阶段：仅安装 prisma CLI 及其依赖（供 migrate deploy），避免运行镜像内 npx 每次下载
FROM node:22-alpine AS prisma-tools
WORKDIR /tools
RUN echo '{"dependencies":{"prisma":"7.6.0"}}' > package.json \
  && npm config set registry https://registry.npmmirror.com \
  && npm install --omit=dev \
  && npm cache clean --force

# 阶段3: 运行
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma CLI（migrate deploy）；置于 PATH 前部，exec 内可直接执行 prisma
ENV PATH="/app/.prisma-cli/node_modules/.bin:${PATH}"

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制 standalone 输出
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 创建上传目录并授权
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public

# 复制 Prisma schema 和 migrations（用于运行时迁移）
COPY --from=builder /app/prisma ./prisma

# 复制 node_modules 中的必要依赖（Prisma 引擎等）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Prisma CLI 可执行文件与依赖（与上面应用内 @prisma 并存，互不影响）
COPY --from=prisma-tools /tools/node_modules /app/.prisma-cli/node_modules

USER root
RUN chown -R nextjs:nodejs /app/.prisma-cli

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

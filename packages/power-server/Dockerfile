# 构建阶段
FROM node:24-alpine AS builder

WORKDIR /app

# 启用 pnpm
RUN corepack enable pnpm

# 复制 workspace 配置
COPY pnpm-workspace.yaml package.json ./
COPY packages/tcp-client/package.json packages/tcp-client/
COPY packages/power-server/package.json packages/power-server/
COPY packages/power-web/package.json packages/power-web/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY packages/tcp-client packages/tcp-client
COPY packages/power-server packages/power-server
COPY packages/power-web packages/power-web
COPY tsconfig.base.json ./

# 构建
RUN pnpm --filter @power-fan/tcp-client build
RUN pnpm --filter @power-fan/power-web build
RUN pnpm --filter @power-fan/power-server build

# 运行阶段
FROM node:24-alpine AS runtime

WORKDIR /app

RUN corepack enable pnpm

COPY pnpm-workspace.yaml package.json ./
COPY packages/tcp-client/package.json packages/tcp-client/
COPY packages/power-server/package.json packages/power-server/

# 仅安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 复制构建产物
COPY --from=builder /app/packages/tcp-client/dist packages/tcp-client/dist
COPY --from=builder /app/packages/power-server/dist packages/power-server/dist
COPY --from=builder /app/packages/power-server/public packages/power-server/public

EXPOSE 3002

WORKDIR /app/packages/power-server
CMD ["node", "dist/index.js"]
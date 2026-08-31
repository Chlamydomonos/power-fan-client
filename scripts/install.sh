#!/bin/bash
set -euo pipefail

# ============================================================
# 风扇控制工具 — systemd 一键安装脚本
#
# 功能：
#   1. 检查运行环境（root 权限、Node.js、pnpm）
#   2. 安装项目依赖并构建（tcp-client → fan-control-web → fan-control-server）
#   3. 交互式获取 ESP32 IP 地址和监听端口
#   4. 创建 systemd service 文件
#   5. 启用并启动服务
# ============================================================

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "错误：请以 root 用户运行此脚本"
    exit 1
fi

# 配置
SERVICE_NAME="power-fan-control"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误：未找到 Node.js，请先安装 Node.js 24+"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 24 ]; then
    echo "错误：Node.js 版本过低（当前 $(node -v)），需要 24+"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "错误：未找到 pnpm，请先安装 pnpm"
    echo "  可以通过 corepack enable pnpm 启用"
    exit 1
fi

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  风扇控制工具 — systemd 安装"
echo "=========================================="
echo ""

# 安装依赖并构建
echo "[1/4] 安装依赖..."
cd "$PROJECT_DIR"
pnpm install

echo ""
echo "[2/4] 构建项目..."
# 按依赖顺序构建
pnpm --filter @power-fan/tcp-client build
pnpm --filter @power-fan/fan-control-web build
pnpm --filter @power-fan/fan-control-server build
echo "构建完成"
echo ""

# 交互式获取配置
echo "[3/4] 配置服务..."
read -p "请输入 ESP32 风扇控制器 IP 地址: " ESP32_HOST

if [ -z "$ESP32_HOST" ]; then
    echo "错误：ESP32 IP 地址不能为空"
    exit 1
fi

read -p "请输入 ESP32 TCP 端口 (默认 8888): " ESP32_PORT
ESP32_PORT=${ESP32_PORT:-8888}

read -p "请输入 Web 服务监听端口 (默认 3001): " PORT
PORT=${PORT:-3001}

echo ""
echo "配置摘要:"
echo "  ESP32 地址:  ${ESP32_HOST}:${ESP32_PORT}"
echo "  Web 端口:    ${PORT}"
echo ""

# 创建 systemd service 文件
echo "[4/4] 创建并启动 systemd 服务..."

NODE_PATH="$(which node)"

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Power Fan Control Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}/packages/fan-control-server
Environment=ESP32_HOST=${ESP32_HOST}
Environment=ESP32_PORT=${ESP32_PORT}
Environment=PORT=${PORT}
ExecStart=${NODE_PATH} ${PROJECT_DIR}/packages/fan-control-server/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "服务名称:  ${SERVICE_NAME}"
echo "访问地址:  http://localhost:${PORT}"
echo ""
echo "常用命令:"
echo "  查看状态:  systemctl status ${SERVICE_NAME}"
echo "  查看日志:  journalctl -u ${SERVICE_NAME} -f"
echo "  停止服务:  systemctl stop ${SERVICE_NAME}"
echo "  启动服务:  systemctl start ${SERVICE_NAME}"
echo "  重启服务:  systemctl restart ${SERVICE_NAME}"
echo "  卸载服务:  systemctl stop ${SERVICE_NAME} && systemctl disable ${SERVICE_NAME} && rm /etc/systemd/system/${SERVICE_NAME}.service && systemctl daemon-reload"
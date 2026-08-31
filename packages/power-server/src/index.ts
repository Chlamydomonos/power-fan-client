/**
 * @power-fan/power-server — 远程开关机工具后端入口
 *
 * Express 后端 + WebSocket 实时推送。
 * 通过 ESP32 风扇控制器实现远程开机、重启、物理按钮权限管理及开机状态监测。
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { PowerFanClient } from '@power-fan/tcp-client';
import { PORT, esp32Options } from './config.js';
import { PowerMonitor } from './services/power-monitor.js';
import { WsHandler } from './ws/handler.js';
import { createPowerRouter } from './routes/power.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
    // 创建 TCP 客户端
    const client = new PowerFanClient(esp32Options);

    client.on('error', (err) => {
        console.error('[TCP] 错误:', err.message);
    });

    // 创建状态监控服务
    const monitor = new PowerMonitor(client);

    // 创建 Express 应用
    const app = express();
    app.use(express.json());

    // REST API 路由
    app.use('/api', createPowerRouter(monitor));

    // 静态文件（前端构建产物）
    const publicDir = path.join(__dirname, '..', 'public');
    app.use(express.static(publicDir));

    // SPA 回退：非 API 路径返回 index.html
    app.get('*', (_req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });

    // 创建 HTTP 服务器
    const server = http.createServer(app);

    // WebSocket
    const wsHandler = new WsHandler(server, monitor);

    // 启动 HTTP 服务
    server.listen(PORT, () => {
        console.log(`远程开关机服务已启动: http://localhost:${PORT}`);
    });

    // 连接 ESP32
    if (!esp32Options.host) {
        console.error('错误: 未设置 ESP32_HOST 环境变量');
        process.exit(1);
    }

    console.log(`正在连接 ESP32 (${esp32Options.host}:${esp32Options.port})...`);

    // 优雅退出
    const shutdown = async () => {
        console.log('\n正在关闭服务...');
        wsHandler.close();
        server.close();
        await monitor.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // 启动连接（自动重连会在后台持续尝试）
    try {
        await monitor.start();
        console.log('TCP 连接已建立，正在验证 ESP32 设备...');
    } catch (err) {
        console.error('连接 ESP32 失败，将在后台自动重连:', err instanceof Error ? err.message : err);
    }
}

main().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
});

/**
 * @power-fan/fan-control-server — 风扇控制工具后端入口
 *
 * Express 后端 + WebSocket 实时推送。
 * 实时采集 CPU/GPU/机箱温度，根据用户自定义表达式控制 3 个风扇。
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { PowerFanClient } from '@power-fan/tcp-client';
import { PORT, esp32Options } from './config.js';
import { loadExpressions, saveExpressions, type ExpressionConfig } from './store.js';
import { TempCollector } from './services/temp-collector.js';
import { FanController } from './services/fan-controller.js';
import { WsHandler } from './ws/handler.js';
import { createExpressionRouter } from './routes/expression.js';
import { createFanRouter } from './routes/fan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
    // 检查环境变量
    if (!esp32Options.host) {
        console.error('错误: 未设置 ESP32_HOST 环境变量');
        process.exit(1);
    }

    // 加载表达式配置
    const expressions = await loadExpressions();
    console.log('[Store] 表达式配置已加载');

    // 创建 TCP 客户端
    const client = new PowerFanClient(esp32Options);

    client.on('error', (err) => {
        console.error('[TCP] 错误:', err.message);
    });

    // 创建温度采集服务
    const collector = new TempCollector(client);
    await collector.init();

    // 创建风扇控制器
    const controller = new FanController(client, collector, expressions);

    // 创建 Express 应用
    const app = express();
    app.use(express.json());

    // REST API 路由
    app.use(
        '/api/expressions',
        createExpressionRouter(
            () => expressions,
            async (config: ExpressionConfig) => {
                Object.assign(expressions, config);
                controller.updateExpressions(expressions);
                await saveExpressions(expressions);
                console.log('[Store] 表达式配置已保存');
            },
        ),
    );
    app.use('/api/fans', createFanRouter(client, controller));

    // 静态文件（前端构建产物）
    const publicDir = path.join(__dirname, '..', 'public');
    app.use(express.static(publicDir));

    // SPA 回退
    app.get('*', (_req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });

    // 创建 HTTP 服务器
    const server = http.createServer(app);

    // WebSocket
    const wsHandler = new WsHandler(server);

    // 新连接时推送最新数据
    wsHandler.onConnect((ws) => {
        const latest = controller.latest;
        if (latest) {
            wsHandler.send(ws, latest);
        }
    });

    // 通过 controller 的 onData 回调广播给所有客户端
    controller.onData((data) => {
        wsHandler.broadcast(data);
    });

    // 启动 HTTP 服务
    server.listen(PORT, () => {
        console.log(`风扇控制服务已启动: http://localhost:${PORT}`);
    });

    // 连接 ESP32 并启动控制循环
    console.log(`正在连接 ESP32 (${esp32Options.host}:${esp32Options.port})...`);

    // TCP 连接事件驱动控制循环启停
    client.on('connect', () => {
        console.log('[TCP] 已连接到 ESP32，启动风扇控制循环');
        controller.start();
    });

    client.on('reconnect', () => {
        console.log('[TCP] 重连成功，恢复风扇控制循环');
        controller.start();
    });

    client.on('disconnect', () => {
        console.log('[TCP] 连接断开，暂停风扇控制循环');
        controller.stop();
    });

    // 优雅退出
    const shutdown = async () => {
        console.log('\n正在关闭服务...');
        controller.stop();
        wsHandler.close();
        server.close();
        await collector.dispose();
        await client.disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // 启动 TCP 连接（自动重连会在后台持续尝试）
    try {
        await client.connect();
    } catch (err) {
        console.error('连接 ESP32 失败，将在后台自动重连:', err instanceof Error ? err.message : err);
    }
}

main().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
});

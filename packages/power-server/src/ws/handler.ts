/**
 * WebSocket 处理 — 管理前端 WebSocket 连接，推送状态更新。
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { PowerMonitor, SystemStatus } from '../services/power-monitor.js';

/** WebSocket 推送消息格式 */
interface WsMessage {
    type: 'power_status';
    data: {
        powerState: string | null;
        esp32Connected: boolean;
        buttons: { powerBtn: boolean; resetBtn: boolean } | null;
        timestamp: number;
    };
}

export class WsHandler {
    private wss: WebSocketServer;
    private monitor: PowerMonitor;

    constructor(server: Server, monitor: PowerMonitor) {
        this.monitor = monitor;
        this.wss = new WebSocketServer({ server, path: '/ws' });

        this.wss.on('connection', (ws) => {
            // 连接建立时立即推送当前状态
            this.sendStatus(ws, monitor.status);

            ws.on('error', (err) => {
                console.error('[WebSocket] 连接错误:', err.message);
            });
        });

        // 监听状态变化，广播给所有客户端
        monitor.onChange((status) => {
            this.broadcast(status);
        });
    }

    /** 关闭 WebSocket 服务 */
    close(): void {
        this.wss.close();
    }

    /** 向单个客户端发送状态 */
    private sendStatus(ws: WebSocket, status: SystemStatus): void {
        const msg: WsMessage = {
            type: 'power_status',
            data: {
                powerState: status.powerState,
                esp32Connected: status.esp32Connected,
                buttons: status.buttons,
                timestamp: Date.now(),
            },
        };
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    /** 广播状态给所有已连接客户端 */
    private broadcast(status: SystemStatus): void {
        for (const ws of this.wss.clients) {
            this.sendStatus(ws, status);
        }
    }
}

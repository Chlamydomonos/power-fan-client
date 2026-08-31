/**
 * WebSocket 处理 — 管理前端 WebSocket 连接，推送温度和风扇数据。
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { ControlData } from '../services/fan-controller.js';

/** WebSocket 推送消息格式 */
interface WsMessage {
    type: 'temp_rpm';
    data: ControlData;
}

export class WsHandler {
    private wss: WebSocketServer;
    private onConnectCb: ((ws: WebSocket) => void) | null = null;

    constructor(server: Server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });

        this.wss.on('connection', (ws) => {
            // 新连接时推送最新数据
            if (this.onConnectCb) {
                this.onConnectCb(ws);
            }

            ws.on('error', (err) => {
                console.error('[WebSocket] 连接错误:', err.message);
            });
        });
    }

    /**
     * 设置新连接回调（用于推送当前状态）。
     */
    onConnect(callback: (ws: WebSocket) => void): void {
        this.onConnectCb = callback;
    }

    /**
     * 广播数据给所有已连接客户端。
     */
    broadcast(data: ControlData): void {
        const msg: WsMessage = { type: 'temp_rpm', data };
        const json = JSON.stringify(msg);

        for (const ws of this.wss.clients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(json);
            }
        }
    }

    /**
     * 向单个客户端发送数据。
     */
    send(ws: WebSocket, data: ControlData): void {
        const msg: WsMessage = { type: 'temp_rpm', data };
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    /** 获取所有已连接客户端 */
    get clients(): Set<WebSocket> {
        return this.wss.clients;
    }

    /** 关闭 WebSocket 服务 */
    close(): void {
        this.wss.close();
    }
}

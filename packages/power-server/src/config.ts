/**
 * 环境变量配置读取。
 */

import { PowerFanClientOptions } from '@power-fan/tcp-client';

/** Express 监听端口 */
export const PORT = parseInt(process.env.PORT ?? '3002', 10);

/** ESP32 TCP 连接选项 */
export const esp32Options: PowerFanClientOptions = {
    host: process.env.ESP32_HOST ?? '',
    port: parseInt(process.env.ESP32_PORT ?? '8888', 10),
    reconnect: true,
    reconnectMinDelay: 1000,
    reconnectMaxDelay: 30000,
    timeout: 5000,
};

/** 开机状态轮询间隔（毫秒） */
export const POLL_INTERVAL = 5000;

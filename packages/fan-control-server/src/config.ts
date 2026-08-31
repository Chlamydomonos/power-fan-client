/**
 * 环境变量配置读取。
 */

import { PowerFanClientOptions } from '@power-fan/tcp-client';

/** Express 监听端口 */
export const PORT = parseInt(process.env.PORT ?? '3001', 10);

/** ESP32 TCP 连接选项 */
export const esp32Options: PowerFanClientOptions = {
    host: process.env.ESP32_HOST ?? '',
    port: parseInt(process.env.ESP32_PORT ?? '8888', 10),
    reconnect: true,
    reconnectMinDelay: 1000,
    reconnectMaxDelay: 30000,
    timeout: 5000,
};

/** 温度采集与风扇控制循环间隔（毫秒） */
export const CONTROL_INTERVAL = 1000;

/** 表达式持久化文件路径 */
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 表达式存储目录 */
export const STORE_DIR = process.env.FAN_STORE_DIR ?? path.join(os.homedir(), '.power-fan');

/** 表达式存储文件路径 */
export const STORE_FILE = path.join(STORE_DIR, 'expressions.json');

/**
 * @power-fan/tcp-client — TCP 客户端入口
 *
 * 封装与 ESP32 风扇控制模块的 TCP 二进制通信协议。
 * 提供类型安全的 API，支持自动重连和事件通知。
 */

import { EventEmitter } from 'events';
import { TcpClientCore } from './client.js';
import { Commands } from './commands.js';
import type { PowerFanClientOptions, FanId, FanRpm, PowerState, WiFiConfig } from './types.js';

export { crc16 } from './crc16.js';
export { CmdId, encodeFrame, FrameParser } from './protocol.js';
export { ProtocolError, ConnectionError, TimeoutError } from './errors.js';
export type { FanId, PowerState, WiFiConfig, FanRpm, PowerFanClientOptions, PowerFanClientEvents } from './types.js';

/**
 * ESP32 风扇控制模块 TCP 客户端。
 *
 * 继承自 EventEmitter，支持以下事件：
 * - 'connect'    — 连接成功
 * - 'disconnect' — 连接断开
 * - 'reconnect'  — 重连成功 (attempt: number)
 * - 'error'      — 错误 (error: Error)
 *
 * @example
 * ```typescript
 * const client = new PowerFanClient({ host: '192.168.1.100' });
 * client.on('connect', () => console.log('已连接'));
 * await client.connect();
 * const temp = await client.getTemperature(); // 25.5
 * await client.setFanPwm(1, 200);
 * ```
 */
export class PowerFanClient extends EventEmitter {
    private readonly core: TcpClientCore;
    private readonly commands: Commands;

    constructor(options: PowerFanClientOptions) {
        super();
        this.core = new TcpClientCore(options);
        this.commands = new Commands(this.core);

        // 转发核心事件
        this.core.on('connect', () => this.emit('connect'));
        this.core.on('disconnect', () => this.emit('disconnect'));
        this.core.on('reconnect', (attempt: number) => this.emit('reconnect', attempt));
        this.core.on('error', (err: Error) => this.emit('error', err));
    }

    /** 当前是否已连接 */
    get isConnected(): boolean {
        return this.core.isConnected;
    }

    /** 建立连接 */
    async connect(): Promise<void> {
        return this.core.connect();
    }

    /** 主动断开连接（不触发自动重连） */
    async disconnect(): Promise<void> {
        return this.core.disconnect();
    }

    // ─── WiFi 配置 ──────────────────────────────────────────

    /** 设置 WiFi 配置 */
    async setWiFiConfig(config: WiFiConfig): Promise<void> {
        return this.commands.setWiFiConfig(config);
    }

    /** 启用/禁用 BSSID 模式 */
    async setBssidMode(enable: boolean): Promise<void> {
        return this.commands.setBssidMode(enable);
    }

    // ─── 开关机 ─────────────────────────────────────────────

    /** 读取开机状态 */
    async getPowerState(): Promise<PowerState> {
        return this.commands.getPowerState();
    }

    /** 远程开机 */
    async powerOn(): Promise<void> {
        return this.commands.powerOn();
    }

    /** 远程重启 */
    async reboot(): Promise<void> {
        return this.commands.reboot();
    }

    /** 设置物理按钮权限 */
    async setButtonPermission(powerBtn: boolean, resetBtn: boolean): Promise<void> {
        return this.commands.setButtonPermission(powerBtn, resetBtn);
    }

    // ─── 温度与风扇 ─────────────────────────────────────────

    /** 读取机箱温度（摄氏度浮点数） */
    async getTemperature(): Promise<number> {
        return this.commands.getTemperature();
    }

    /** 读取风扇转速 */
    async getFanRpm(fanId: FanId): Promise<FanRpm[]> {
        return this.commands.getFanRpm(fanId);
    }

    /** 设置风扇开关 */
    async setFanSwitch(fanId: FanId, state: boolean): Promise<void> {
        return this.commands.setFanSwitch(fanId, state);
    }

    /** 设置风扇 PWM 占空比 (0-255) */
    async setFanPwm(fanId: FanId, duty: number): Promise<void> {
        return this.commands.setFanPwm(fanId, duty);
    }
}

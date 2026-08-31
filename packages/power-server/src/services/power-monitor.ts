/**
 * 开机状态轮询服务。
 *
 * 每 5 秒通过 TCP 客户端查询 ESP32 开机状态，
 * 状态变化时通过回调通知 WebSocket 层推送。
 */

import { PowerFanClient, PowerState } from '@power-fan/tcp-client';
import { POLL_INTERVAL } from '../config.js';

/** 按钮权限状态 */
export interface ButtonPermission {
    powerBtn: boolean;
    resetBtn: boolean;
}

/** 系统状态快照 */
export interface SystemStatus {
    powerState: PowerState | null;
    esp32Connected: boolean;
    buttons: ButtonPermission | null;
}

/** 状态变化回调 */
export type StatusChangeCallback = (status: SystemStatus) => void;

export class PowerMonitor {
    private readonly client: PowerFanClient;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private currentStatus: SystemStatus = {
        powerState: null,
        esp32Connected: false,
        buttons: null,
    };
    private callbacks = new Set<StatusChangeCallback>();

    private verifying = false;

    constructor(client: PowerFanClient) {
        this.client = client;

        // connect 和 reconnect 事件都表示 TCP 层已建立连接
        // 需要进一步做协议级握手验证，确认对方是 ESP32 风扇控制器
        const onTcpConnected = () => {
            this.verifyConnection();
        };

        this.client.on('connect', onTcpConnected);
        this.client.on('reconnect', onTcpConnected);

        this.client.on('disconnect', () => {
            this.verifying = false;
            this.stopPolling();
            this.updateStatus({ ...this.currentStatus, esp32Connected: false, powerState: null });
        });
    }

    /**
     * 协议级握手验证 — 发送 getPowerState 确认对方是 ESP32 风扇控制器。
     * 只有收到有效响应后才标记为已连接，避免连到错误设备时误报。
     */
    private async verifyConnection(): Promise<void> {
        if (this.verifying) return;
        this.verifying = true;

        try {
            const powerState = await this.client.getPowerState();
            this.updateStatus({
                ...this.currentStatus,
                esp32Connected: true,
                powerState,
            });
            this.startPolling();
        } catch {
            // 握手失败，不标记为已连接
            // TCP 客户端的自动重连会在后台继续尝试
            this.updateStatus({ ...this.currentStatus, esp32Connected: false });
        } finally {
            this.verifying = false;
        }
    }

    /** 当前状态快照 */
    get status(): SystemStatus {
        return this.currentStatus;
    }

    /** 注册状态变化回调 */
    onChange(callback: StatusChangeCallback): () => void {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /** 启动 TCP 连接 */
    async start(): Promise<void> {
        await this.client.connect();
        // connect 事件会触发 verifyConnection，这里不重复验证
    }

    /** 停止服务 */
    async stop(): Promise<void> {
        this.stopPolling();
        await this.client.disconnect();
    }

    /** 远程开机 */
    async powerOn(): Promise<void> {
        await this.client.powerOn();
    }

    /** 远程重启 */
    async reboot(): Promise<void> {
        await this.client.reboot();
    }

    /** 设置物理按钮权限 */
    async setButtonPermission(powerBtn: boolean, resetBtn: boolean): Promise<void> {
        await this.client.setButtonPermission(powerBtn, resetBtn);
        this.updateStatus({
            ...this.currentStatus,
            buttons: { powerBtn, resetBtn },
        });
    }

    // ─── 内部方法 ────────────────────────────────────────────

    /** 启动轮询 */
    private startPolling(): void {
        this.stopPolling();
        // 立即查询一次
        this.poll();
        this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);
    }

    /** 停止轮询 */
    private stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /** 执行一次状态查询 */
    private async poll(): Promise<void> {
        if (!this.client.isConnected) return;

        try {
            const powerState = await this.client.getPowerState();
            this.updateStatus({ ...this.currentStatus, powerState });
        } catch (err) {
            // 查询失败时不更新状态，等待下一次轮询
            console.error('[PowerMonitor] 查询开机状态失败:', err instanceof Error ? err.message : err);
        }
    }

    /** 更新状态并通知回调 */
    private updateStatus(status: SystemStatus): void {
        const changed =
            status.powerState !== this.currentStatus.powerState ||
            status.esp32Connected !== this.currentStatus.esp32Connected ||
            JSON.stringify(status.buttons) !== JSON.stringify(this.currentStatus.buttons);

        this.currentStatus = status;

        if (changed) {
            for (const cb of this.callbacks) {
                cb(status);
            }
        }
    }
}

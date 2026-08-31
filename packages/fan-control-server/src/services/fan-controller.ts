/**
 * 风扇控制循环 — 每秒采集温度、执行表达式、控制风扇、推送数据。
 */

import type { PowerFanClient, FanRpm } from '@power-fan/tcp-client';
import type { TempCollector, TempData } from './temp-collector.js';
import type { ExpressionConfig } from '../store.js';
import { executeAll, type ExpressionResult, ExpressionError } from './expression-engine.js';
import { CONTROL_INTERVAL } from '../config.js';

/** 风扇实时状态 */
export interface FanStatus {
    fanId: number;
    rpm: number;
    on: boolean;
    pwm: number;
}

/** 控制循环推送的数据 */
export interface ControlData {
    temps: TempData;
    fans: FanStatus[];
    timestamp: number;
}

/** 数据更新回调 */
export type ControlDataCallback = (data: ControlData) => void;

/** 手动控制覆盖状态 */
interface ManualOverride {
    on?: boolean;
    pwm?: number;
}

export class FanController {
    private readonly client: PowerFanClient;
    private readonly collector: TempCollector;
    private expressions: ExpressionConfig;
    private controlTimer: ReturnType<typeof setInterval> | null = null;
    private running = false;

    /** 手动覆盖（按 fanId 索引，1-3） */
    private overrides = new Map<number, ManualOverride>();

    /** 上一次发送给 ESP32 的控制状态（避免重复发送相同指令） */
    private lastSent = new Map<number, { on: boolean; pwm: number }>();

    /** 当前最新数据（供 WebSocket 新连接立即推送） */
    private latestData: ControlData | null = null;

    /** 数据更新回调 */
    private callbacks = new Set<ControlDataCallback>();

    constructor(client: PowerFanClient, collector: TempCollector, expressions: ExpressionConfig) {
        this.client = client;
        this.collector = collector;
        this.expressions = expressions;
    }

    /** 最新数据快照 */
    get latest(): ControlData | null {
        return this.latestData;
    }

    /** 更新表达式配置 */
    updateExpressions(config: ExpressionConfig): void {
        this.expressions = config;
    }

    /** 注册数据更新回调 */
    onData(callback: ControlDataCallback): () => void {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /** 设置手动覆盖 */
    setOverride(fanId: number, on?: boolean, pwm?: number): void {
        this.overrides.set(fanId, { on, pwm });
    }

    /** 清除手动覆盖 */
    clearOverride(fanId: number): void {
        this.overrides.delete(fanId);
    }

    /** 启动控制循环 */
    start(): void {
        if (this.running) return;
        this.running = true;
        // 立即执行一次
        this.tick();
        this.controlTimer = setInterval(() => this.tick(), CONTROL_INTERVAL);
    }

    /** 停止控制循环 */
    stop(): void {
        this.running = false;
        if (this.controlTimer) {
            clearInterval(this.controlTimer);
            this.controlTimer = null;
        }
    }

    /** 执行一次控制循环 */
    private async tick(): Promise<void> {
        if (!this.client.isConnected) return;

        // 1. 采集温度
        const temps = await this.collector.collect();

        // 2. 执行表达式
        let results: ExpressionResult[];
        try {
            results = executeAll(this.expressions, {
                cpuTemp: temps.cpuTemp,
                gpuTemp: temps.gpuTemp,
                caseTemp: temps.caseTemp,
            });
        } catch (err) {
            if (err instanceof ExpressionError) {
                console.error(`[FanController] ${err.message}，保持上一次控制状态`);
            } else {
                console.error('[FanController] 表达式执行失败:', err instanceof Error ? err.message : err);
            }
            // 表达式出错时跳过本次控制，但仍推送温度数据
            this.notifyCallbacks(temps, []);
            return;
        }

        // 3. 应用手动覆盖
        const fanStatuses: FanStatus[] = [];

        for (let i = 0; i < 3; i++) {
            const fanId = i + 1;
            const exprResult = results[i];
            const override = this.overrides.get(fanId);

            const on = override?.on ?? exprResult.on;
            const pwm = override?.pwm ?? exprResult.pwm;

            // 4. 发送控制指令（仅在状态变化时发送）
            await this.sendIfChanged(fanId, on, pwm);

            fanStatuses.push({ fanId, rpm: 0, on, pwm });
        }

        // 5. 读取风扇实际 RPM
        try {
            const rpms = await this.client.getFanRpm(0);
            for (const fan of fanStatuses) {
                const rpmData = rpms.find((r) => r.fanId === fan.fanId);
                if (rpmData) {
                    fan.rpm = rpmData.rpm;
                }
            }
        } catch (err) {
            console.error('[FanController] 读取风扇 RPM 失败:', err instanceof Error ? err.message : err);
        }

        // 6. 推送数据
        this.notifyCallbacks(temps, fanStatuses);
    }

    /** 仅在状态变化时发送控制指令 */
    private async sendIfChanged(fanId: number, on: boolean, pwm: number): Promise<void> {
        const last = this.lastSent.get(fanId);

        if (last && last.on === on && last.pwm === pwm) {
            return; // 状态未变化，跳过
        }

        try {
            await this.client.setFanSwitch(fanId as 0 | 1 | 2 | 3, on);
            await this.client.setFanPwm(fanId as 0 | 1 | 2 | 3, pwm);
            this.lastSent.set(fanId, { on, pwm });
        } catch (err) {
            console.error(`[FanController] 风扇${fanId} 控制失败:`, err instanceof Error ? err.message : err);
        }
    }

    /** 通知所有回调 */
    private notifyCallbacks(temps: TempData, fans: FanStatus[]): void {
        const data: ControlData = {
            temps,
            fans,
            timestamp: Date.now(),
        };
        this.latestData = data;

        for (const cb of this.callbacks) {
            cb(data);
        }
    }
}

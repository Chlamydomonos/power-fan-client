/**
 * 风扇控制循环 — 每秒采集温度、执行表达式、控制风扇、推送数据。
 * 支持平滑过渡：开关和 PWM 占空比渐变，避免突变。
 */

import type { PowerFanClient, FanRpm } from '@power-fan/tcp-client';
import type { TempCollector, TempData } from './temp-collector.js';
import type { ExpressionConfig } from '../store.js';
import { executeAll, type ExpressionResult, ExpressionError } from './expression-engine.js';
import { CONTROL_INTERVAL, DEFAULT_SMOOTH_STEP } from '../config.js';

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

/** 每风扇的平滑过渡状态 */
interface SmoothState {
    /** 当前实际下发的 PWM 值 */
    currentPwm: number;
    /** 目标 PWM 值 */
    targetPwm: number;
    /** 当前实际下发的开关状态 */
    currentOn: boolean;
    /** 目标开关状态 */
    targetOn: boolean;
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

    /** 是否启用平滑过渡 */
    private smoothEnabled = false;

    /** 平滑过渡步长（每次 tick PWM 变化量，1-255） */
    private smoothStep = DEFAULT_SMOOTH_STEP;

    /** 每风扇的平滑过渡状态（fanId → SmoothState） */
    private smoothStates = new Map<number, SmoothState>();

    constructor(client: PowerFanClient, collector: TempCollector, expressions: ExpressionConfig) {
        this.client = client;
        this.collector = collector;
        this.expressions = expressions;

        // 初始化每风扇的平滑状态
        for (let i = 1; i <= 3; i++) {
            this.smoothStates.set(i, {
                currentPwm: 0,
                targetPwm: 0,
                currentOn: false,
                targetOn: false,
            });
        }
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

    /** 设置是否启用平滑过渡 */
    setSmoothEnabled(enabled: boolean): void {
        this.smoothEnabled = enabled;
        // 禁用平滑时，立即将当前状态对齐到目标值
        if (!enabled) {
            for (const [, state] of this.smoothStates) {
                state.currentPwm = state.targetPwm;
                state.currentOn = state.targetOn;
            }
        }
    }

    /** 获取平滑过渡启用状态 */
    get isSmoothEnabled(): boolean {
        return this.smoothEnabled;
    }

    /** 设置平滑过渡步长（1-255） */
    setSmoothStep(step: number): void {
        this.smoothStep = Math.max(1, Math.min(255, Math.round(step)));
    }

    /** 获取平滑过渡步长 */
    get smoothStepValue(): number {
        return this.smoothStep;
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

        // 3. 应用手动覆盖 + 平滑过渡
        const fanStatuses: FanStatus[] = [];

        for (let i = 0; i < 3; i++) {
            const fanId = i + 1;
            const exprResult = results[i];
            const override = this.overrides.get(fanId);

            const targetOn = override?.on ?? exprResult.on;
            const targetPwm = override?.pwm ?? exprResult.pwm;

            // 更新平滑状态的目标值
            const smooth = this.smoothStates.get(fanId)!;
            smooth.targetOn = targetOn;
            smooth.targetPwm = targetPwm;

            let actualOn: boolean;
            let actualPwm: number;

            if (this.smoothEnabled) {
                // 平滑过渡：逐步调整 PWM 和开关
                this.stepSmooth(smooth);
                actualOn = smooth.currentOn;
                actualPwm = smooth.currentPwm;
            } else {
                // 直接设置
                smooth.currentOn = targetOn;
                smooth.currentPwm = targetPwm;
                actualOn = targetOn;
                actualPwm = targetPwm;
            }

            // 4. 发送控制指令（仅在状态变化时发送）
            await this.sendIfChanged(fanId, actualOn, actualPwm);

            fanStatuses.push({ fanId, rpm: 0, on: actualOn, pwm: actualPwm });
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

    /**
     * 平滑过渡一步：根据 smoothStep 逐步调整 PWM 和开关状态。
     * - PWM 渐变：每 tick 向目标值靠近 smoothStep。
     * - 开关逻辑：
     *   - 目标开 → 直接打开开关，PWM 从 0 开始渐变到目标值
     *   - 目标关 → 先将 PWM 渐变到 0，再关闭开关
     */
    private stepSmooth(smooth: SmoothState): void {
        const { currentPwm, targetPwm, currentOn, targetOn } = smooth;

        if (targetOn) {
            // 目标是开：直接打开开关，PWM 从当前值渐变到目标值
            smooth.currentOn = true;
            smooth.currentPwm = this.lerpPwm(currentPwm, targetPwm);
        } else {
            // 目标是关：先将 PWM 渐变到 0，再关开关
            if (currentPwm > 0) {
                smooth.currentPwm = this.lerpPwm(currentPwm, 0);
                // PWM 还没到 0，保持开关开
                smooth.currentOn = true;
            } else {
                // PWM 已到 0，关闭开关
                smooth.currentPwm = 0;
                smooth.currentOn = false;
            }
        }
    }

    /** PWM 值向目标值靠近一步 */
    private lerpPwm(current: number, target: number): number {
        if (current < target) {
            return Math.min(target, current + this.smoothStep);
        } else if (current > target) {
            return Math.max(target, current - this.smoothStep);
        }
        return target;
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

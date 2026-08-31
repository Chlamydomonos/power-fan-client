/**
 * 表达式执行引擎 — 使用 new Function() 在受限上下文中执行用户自定义表达式。
 */

import type { ExpressionConfig, ExpressionKey } from '../store.js';

/** 温度输入数据 */
export interface TempInput {
    cpuTemp: number;
    gpuTemp: number;
    caseTemp: number;
}

/** 单个表达式的执行结果 */
export interface ExpressionResult {
    /** 风扇开关 (true=开, false=关) */
    on: boolean;
    /** PWM 占空比 (0-255) */
    pwm: number;
}

/** 表达式执行错误 */
export class ExpressionError extends Error {
    readonly key: ExpressionKey;

    constructor(key: ExpressionKey, message: string) {
        super(`表达式错误 [${key}]: ${message}`);
        this.name = 'ExpressionError';
        this.key = key;
    }
}

/**
 * 编译并执行单个表达式。
 *
 * @param expr 表达式字符串
 * @param key 表达式键名（用于错误信息）
 * @param temps 温度输入
 * @returns 扔回值（原始类型）
 */
function executeExpression(expr: string, key: ExpressionKey, temps: TempInput): unknown {
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('cpuTemp', 'gpuTemp', 'caseTemp', `return ${expr}`);
        return fn(temps.cpuTemp, temps.gpuTemp, temps.caseTemp);
    } catch (err) {
        throw new ExpressionError(key, err instanceof Error ? err.message : String(err));
    }
}

/**
 * 执行开关表达式，返回 boolean。
 */
export function executeSwitch(expr: string, key: ExpressionKey, temps: TempInput): boolean {
    const result = executeExpression(expr, key, temps);
    return Boolean(result);
}

/**
 * 执行转速表达式，返回 0-255 的整数。
 */
export function executePwm(expr: string, key: ExpressionKey, temps: TempInput): number {
    const result = executeExpression(expr, key, temps);
    const num = Number(result);
    if (Number.isNaN(num)) {
        throw new ExpressionError(key, '表达式返回值不是数字');
    }
    return Math.max(0, Math.min(255, Math.round(num)));
}

/**
 * 执行全部 6 个表达式，返回 3 个风扇的控制指令。
 *
 * @param config 表达式配置
 * @param temps 温度输入
 * @returns 3 个风扇的开关和 PWM
 */
export function executeAll(config: ExpressionConfig, temps: TempInput): ExpressionResult[] {
    const results: ExpressionResult[] = [];

    for (let i = 0; i < 3; i++) {
        const switchKey = `fan${i + 1}Switch` as ExpressionKey;
        const pwmKey = `fan${i + 1}Pwm` as ExpressionKey;

        const on = executeSwitch(config[switchKey], switchKey, temps);
        const pwm = executePwm(config[pwmKey], pwmKey, temps);

        results.push({ on, pwm });
    }

    return results;
}

/**
 * 测试表达式（不实际控制风扇），返回计算结果。
 *
 * @param config 表达式配置
 * @param temps 模拟温度输入
 * @returns 3 个风扇的计算结果
 */
export function testExpressions(config: ExpressionConfig, temps: TempInput): ExpressionResult[] {
    return executeAll(config, temps);
}

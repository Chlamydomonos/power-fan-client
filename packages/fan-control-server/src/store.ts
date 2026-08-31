/**
 * 表达式持久化 — 保存和加载用户自定义的风扇控制表达式。
 */

import fs from 'fs/promises';
import path from 'path';
import { STORE_DIR, STORE_FILE } from './config.js';

/** 6 个表达式的键名 */
export type ExpressionKey = 'fan1Switch' | 'fan1Pwm' | 'fan2Switch' | 'fan2Pwm' | 'fan3Switch' | 'fan3Pwm';

/** 表达式配置 */
export type ExpressionConfig = Record<ExpressionKey, string>;

/** 默认表达式 */
export const DEFAULT_EXPRESSIONS: ExpressionConfig = {
    fan1Switch: 'cpuTemp > 40',
    fan1Pwm: 'Math.min(255, Math.max(0, (cpuTemp - 40) * 8))',
    fan2Switch: 'gpuTemp > 40',
    fan2Pwm: 'Math.min(255, Math.max(0, (gpuTemp - 40) * 8))',
    fan3Switch: 'caseTemp > 35',
    fan3Pwm: 'Math.min(255, Math.max(0, (caseTemp - 35) * 10))',
};

/** 所有表达式键名（有序） */
export const EXPRESSION_KEYS: ExpressionKey[] = [
    'fan1Switch',
    'fan1Pwm',
    'fan2Switch',
    'fan2Pwm',
    'fan3Switch',
    'fan3Pwm',
];

/**
 * 加载表达式配置。
 * 文件不存在时返回默认表达式。
 */
export async function loadExpressions(): Promise<ExpressionConfig> {
    try {
        const content = await fs.readFile(STORE_FILE, 'utf-8');
        const data = JSON.parse(content) as Partial<ExpressionConfig>;

        // 合并默认值，确保所有键都存在
        return { ...DEFAULT_EXPRESSIONS, ...data };
    } catch {
        return { ...DEFAULT_EXPRESSIONS };
    }
}

/**
 * 保存表达式配置到文件。
 */
export async function saveExpressions(config: ExpressionConfig): Promise<void> {
    await fs.mkdir(STORE_DIR, { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

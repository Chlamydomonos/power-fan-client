/**
 * 表达式管理 API 路由。
 *
 * GET  /api/expressions      — 获取当前 6 个表达式
 * PUT  /api/expressions      — 更新表达式（保存并持久化）
 * POST /api/expressions/test — 测试表达式（传入模拟温度，返回计算结果）
 */

import { Router, type Request, type Response } from 'express';
import type { ExpressionConfig } from '../store.js';
import { testExpressions, ExpressionError } from '../services/expression-engine.js';

export function createExpressionRouter(
    getExpressions: () => ExpressionConfig,
    updateExpressions: (config: ExpressionConfig) => Promise<void>,
): Router {
    const router = Router();

    // GET /api/expressions — 获取当前表达式
    router.get('/', (_req: Request, res: Response) => {
        res.json(getExpressions());
    });

    // PUT /api/expressions — 更新表达式
    router.put('/', async (req: Request, res: Response) => {
        const body = req.body as Partial<ExpressionConfig>;

        // 验证所有 6 个键都存在且为字符串
        const keys: (keyof ExpressionConfig)[] = [
            'fan1Switch',
            'fan1Pwm',
            'fan2Switch',
            'fan2Pwm',
            'fan3Switch',
            'fan3Pwm',
        ];

        for (const key of keys) {
            if (typeof body[key] !== 'string') {
                res.status(400).json({ error: `缺少或无效的表达式: ${key}` });
                return;
            }
        }

        try {
            await updateExpressions(body as ExpressionConfig);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err instanceof Error ? err.message : '保存失败' });
        }
    });

    // POST /api/expressions/test — 测试表达式
    router.post('/test', (req: Request, res: Response) => {
        const { expressions, temps } = req.body as {
            expressions?: ExpressionConfig;
            temps?: { cpuTemp?: number; gpuTemp?: number; caseTemp?: number };
        };

        if (!expressions || !temps) {
            res.status(400).json({ error: '需要 expressions 和 temps 参数' });
            return;
        }

        try {
            const results = testExpressions(expressions, {
                cpuTemp: temps.cpuTemp ?? 0,
                gpuTemp: temps.gpuTemp ?? 0,
                caseTemp: temps.caseTemp ?? 0,
            });
            res.json({ ok: true, results });
        } catch (err) {
            if (err instanceof ExpressionError) {
                res.status(400).json({ error: err.message });
            } else {
                res.status(500).json({ error: err instanceof Error ? err.message : '测试失败' });
            }
        }
    });

    return router;
}

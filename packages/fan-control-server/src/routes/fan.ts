/**
 * 风扇控制 API 路由。
 *
 * GET  /api/fans/rpm          — 获取 3 个风扇当前 RPM
 * POST /api/fans/:fanId/switch — 手动控制风扇开关
 * POST /api/fans/:fanId/pwm    — 手动控制风扇 PWM
 * GET  /api/status             — 获取系统状态
 */

import { Router, type Request, type Response } from 'express';
import type { PowerFanClient } from '@power-fan/tcp-client';
import { ProtocolError, ConnectionError } from '@power-fan/tcp-client';
import type { FanController } from '../services/fan-controller.js';

export function createFanRouter(client: PowerFanClient, controller: FanController): Router {
    const router = Router();

    // GET /api/fans/rpm — 获取 3 个风扇当前 RPM
    router.get('/rpm', async (_req: Request, res: Response) => {
        try {
            const rpms = await client.getFanRpm(0);
            res.json(rpms);
        } catch (err) {
            handleApiError(err, res);
        }
    });

    // POST /api/fans/:fanId/switch — 手动控制风扇开关
    router.post('/:fanId/switch', async (req: Request, res: Response) => {
        const fanId = parseInt(String(req.params.fanId), 10);
        if (fanId < 1 || fanId > 3) {
            res.status(400).json({ error: 'fanId 必须为 1-3' });
            return;
        }

        const { state } = req.body as { state?: boolean };
        if (typeof state !== 'boolean') {
            res.status(400).json({ error: 'state 必须为布尔值' });
            return;
        }

        try {
            await client.setFanSwitch(fanId as 0 | 1 | 2 | 3, state);
            controller.setOverride(fanId, state, undefined);
            res.json({ ok: true });
        } catch (err) {
            handleApiError(err, res);
        }
    });

    // POST /api/fans/:fanId/pwm — 手动控制风扇 PWM
    router.post('/:fanId/pwm', async (req: Request, res: Response) => {
        const fanId = parseInt(String(req.params.fanId), 10);
        if (fanId < 1 || fanId > 3) {
            res.status(400).json({ error: 'fanId 必须为 1-3' });
            return;
        }

        const { pwm } = req.body as { pwm?: number };
        if (typeof pwm !== 'number' || pwm < 0 || pwm > 255) {
            res.status(400).json({ error: 'pwm 必须为 0-255 的数字' });
            return;
        }

        try {
            await client.setFanPwm(fanId as 0 | 1 | 2 | 3, pwm);
            controller.setOverride(fanId, undefined, pwm);
            res.json({ ok: true });
        } catch (err) {
            handleApiError(err, res);
        }
    });

    // GET /api/status — 获取系统状态
    router.get('/status', (_req: Request, res: Response) => {
        const latest = controller.latest;
        res.json({
            esp32Connected: client.isConnected,
            temps: latest?.temps ?? null,
            fans: latest?.fans ?? [],
        });
    });

    return router;
}

/** 统一 API 错误处理 */
function handleApiError(err: unknown, res: Response): void {
    if (err instanceof ConnectionError) {
        res.status(503).json({ error: `ESP32 连接错误: ${err.message}` });
    } else if (err instanceof ProtocolError) {
        res.status(502).json({ error: `ESP32 协议错误: ${err.message} (0x${err.code.toString(16).padStart(2, '0')})` });
    } else if (err instanceof Error) {
        res.status(500).json({ error: err.message });
    } else {
        res.status(500).json({ error: '未知错误' });
    }
}

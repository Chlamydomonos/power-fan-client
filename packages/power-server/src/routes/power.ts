/**
 * 开关机 API 路由。
 */

import { Router, type Request, type Response } from 'express';
import type { PowerMonitor } from '../services/power-monitor.js';
import { ProtocolError, ConnectionError } from '@power-fan/tcp-client';

export function createPowerRouter(monitor: PowerMonitor): Router {
    const router = Router();

    // GET /api/status — 获取当前状态
    router.get('/status', (_req: Request, res: Response) => {
        res.json(monitor.status);
    });

    // POST /api/power/on — 远程开机
    router.post('/power/on', async (_req: Request, res: Response) => {
        try {
            await monitor.powerOn();
            res.json({ ok: true });
        } catch (err) {
            handleApiError(err, res);
        }
    });

    // POST /api/power/reboot — 远程重启
    router.post('/power/reboot', async (_req: Request, res: Response) => {
        try {
            await monitor.reboot();
            res.json({ ok: true });
        } catch (err) {
            handleApiError(err, res);
        }
    });

    // GET /api/buttons — 获取物理按钮权限状态
    router.get('/buttons', (_req: Request, res: Response) => {
        res.json(monitor.status.buttons ?? { powerBtn: null, resetBtn: null });
    });

    // PUT /api/buttons — 设置物理按钮权限
    router.put('/buttons', async (req: Request, res: Response) => {
        const { powerBtn, resetBtn } = req.body;

        if (typeof powerBtn !== 'boolean' || typeof resetBtn !== 'boolean') {
            res.status(400).json({ error: 'powerBtn 和 resetBtn 必须为布尔值' });
            return;
        }

        try {
            await monitor.setButtonPermission(powerBtn, resetBtn);
            res.json({ ok: true });
        } catch (err) {
            handleApiError(err, res);
        }
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

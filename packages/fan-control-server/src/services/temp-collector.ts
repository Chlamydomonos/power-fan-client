/**
 * 温度采集服务 — 采集 CPU、GPU、机箱温度。
 *
 * - CPU 温度：通过 systeminformation 库获取
 * - GPU 温度：通过 @rh-ai-bu/ts-nvml 获取 NVIDIA GPU 温度
 * - 机箱温度：通过 ESP32 TCP 客户端 getTemperature() 获取
 */

import si from 'systeminformation';
import { Nvml, unwrapOr } from '@rh-ai-bu/ts-nvml';
import type { PowerFanClient } from '@power-fan/tcp-client';

/** 温度数据 */
export interface TempData {
    cpuTemp: number;
    gpuTemp: number;
    caseTemp: number;
    timestamp: number;
}

export class TempCollector {
    private nvmlInitialized = false;
    private readonly client: PowerFanClient;

    constructor(client: PowerFanClient) {
        this.client = client;
    }

    /**
     * 初始化温度采集服务（初始化 NVML）。
     */
    async init(): Promise<void> {
        // 初始化 NVML（NVIDIA GPU）
        try {
            Nvml.init();
            this.nvmlInitialized = true;
            console.log('[TempCollector] NVML 已初始化');
        } catch (err) {
            console.warn(
                '[TempCollector] NVML 初始化失败（无 NVIDIA GPU 或驱动未安装）:',
                err instanceof Error ? err.message : err,
            );
        }
    }

    /**
     * 释放资源（关闭 NVML）。
     */
    async dispose(): Promise<void> {
        if (this.nvmlInitialized) {
            try {
                Nvml.shutdown();
            } catch {
                // 忽略关闭错误
            }
            this.nvmlInitialized = false;
        }
    }

    /**
     * 采集一次温度数据。
     *
     * @returns 温度数据，采集失败的项返回 0
     */
    async collect(): Promise<TempData> {
        const [cpuTemp, gpuTemp, caseTemp] = await Promise.all([
            this.getCpuTemp(),
            this.getGpuTemp(),
            this.getCaseTemp(),
        ]);

        return {
            cpuTemp,
            gpuTemp,
            caseTemp,
            timestamp: Date.now(),
        };
    }

    /** 获取 CPU 温度（°C） */
    private async getCpuTemp(): Promise<number> {
        try {
            const data = await si.cpuTemperature();
            if (data.main != null && data.main > 0) {
                return data.main;
            }
            return 0;
        } catch (err) {
            console.error('[TempCollector] CPU 温度获取失败:', err instanceof Error ? err.message : err);
            return 0;
        }
    }

    /** 获取 GPU 温度（°C） */
    private getGpuTemp(): number {
        if (!this.nvmlInitialized) return 0;

        try {
            const count = Nvml.getDeviceCount();
            if (count === 0) return 0;

            // 取第一块 GPU 的温度
            const device = Nvml.getDevice(0);
            const result = device.getTemperature();
            return unwrapOr(result, 0);
        } catch (err) {
            console.error('[TempCollector] GPU 温度获取失败:', err instanceof Error ? err.message : err);
            return 0;
        }
    }

    /** 获取机箱温度（°C） */
    private async getCaseTemp(): Promise<number> {
        if (!this.client.isConnected) return 0;

        try {
            return await this.client.getTemperature();
        } catch (err) {
            console.error('[TempCollector] 机箱温度获取失败:', err instanceof Error ? err.message : err);
            return 0;
        }
    }
}

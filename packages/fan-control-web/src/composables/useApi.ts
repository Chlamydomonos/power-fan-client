/**
 * REST API 调用 composable。
 */

export interface ExpressionConfig {
    fan1Switch: string;
    fan1Pwm: string;
    fan2Switch: string;
    fan2Pwm: string;
    fan3Switch: string;
    fan3Pwm: string;
}

export interface ExpressionTestResult {
    on: boolean;
    pwm: number;
}

export function useApi() {
    async function getExpressions(): Promise<ExpressionConfig> {
        const res = await fetch('/api/expressions');
        if (!res.ok) throw new Error('获取表达式失败');
        return res.json();
    }

    async function saveExpressions(config: ExpressionConfig): Promise<void> {
        const res = await fetch('/api/expressions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? '保存表达式失败');
        }
    }

    async function testExpressions(
        config: ExpressionConfig,
        temps: { cpuTemp: number; gpuTemp: number; caseTemp: number },
    ): Promise<ExpressionTestResult[]> {
        const res = await fetch('/api/expressions/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expressions: config, temps }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '测试失败');
        return data.results;
    }

    async function setFanSwitch(fanId: number, state: boolean): Promise<void> {
        const res = await fetch(`/api/fans/${fanId}/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? '设置风扇开关失败');
        }
    }

    async function setFanPwm(fanId: number, pwm: number): Promise<void> {
        const res = await fetch(`/api/fans/${fanId}/pwm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pwm }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? '设置风扇 PWM 失败');
        }
    }

    return { getExpressions, saveExpressions, testExpressions, setFanSwitch, setFanPwm };
}

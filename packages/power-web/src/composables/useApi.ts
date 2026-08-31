/**
 * REST API 调用 composable。
 */

export function useApi() {
    async function powerOn(): Promise<void> {
        const res = await fetch('/api/power/on', { method: 'POST' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? '开机请求失败');
        }
    }

    async function reboot(): Promise<void> {
        const res = await fetch('/api/power/reboot', { method: 'POST' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? '重启请求失败');
        }
    }

    async function setButtonPermission(powerBtn: boolean, resetBtn: boolean): Promise<void> {
        const res = await fetch('/api/buttons', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ powerBtn, resetBtn }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? '设置按钮权限失败');
        }
    }

    return { powerOn, reboot, setButtonPermission };
}

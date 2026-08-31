/**
 * WebSocket 连接管理 composable。
 *
 * 连接 /ws 端点，接收状态推送，提供响应式状态。
 */

import { ref, onMounted, onUnmounted } from 'vue';

export interface PowerStatusData {
    powerState: 'on' | 'off' | null;
    esp32Connected: boolean;
    buttons: { powerBtn: boolean; resetBtn: boolean } | null;
    timestamp: number;
}

export function useWebSocket() {
    const status = ref<PowerStatusData>({
        powerState: null,
        esp32Connected: false,
        buttons: null,
        timestamp: 0,
    });
    const connected = ref(false);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws`;

        // 清除可能存在的旧连接和重连定时器
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (ws) {
            ws.onclose = null;
            ws.onerror = null;
            ws.close();
            ws = null;
        }

        ws = new WebSocket(url);

        ws.onopen = () => {
            connected.value = true;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'power_status') {
                    status.value = msg.data;
                }
            } catch {
                // 忽略解析错误
            }
        };

        ws.onclose = () => {
            connected.value = false;
            ws = null;
            // 自动重连（3秒后）
            reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
            // error 事件后会自动触发 close 事件，由 onclose 处理重连
            // 这里不需要额外操作
        };
    }

    function disconnect() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        ws?.close();
        ws = null;
    }

    onMounted(connect);
    onUnmounted(disconnect);

    return { status, connected };
}

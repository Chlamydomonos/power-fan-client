/**
 * WebSocket 连接管理 composable。
 */

import { ref, onMounted, onUnmounted } from 'vue';

export interface FanData {
    fanId: number;
    rpm: number;
    on: boolean;
    pwm: number;
}

export interface TempData {
    cpuTemp: number;
    gpuTemp: number;
    caseTemp: number;
    timestamp: number;
}

export interface WsData {
    temps: TempData;
    fans: FanData[];
    timestamp: number;
}

export function useWebSocket() {
    const data = ref<WsData | null>(null);
    const connected = ref(false);

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws`;

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
                if (msg.type === 'temp_rpm') {
                    data.value = msg.data;
                }
            } catch {
                // 忽略解析错误
            }
        };

        ws.onclose = () => {
            connected.value = false;
            ws = null;
            reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
            // error 后会自动触发 close
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

    return { data, connected };
}

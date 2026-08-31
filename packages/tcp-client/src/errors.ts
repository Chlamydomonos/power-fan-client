/**
 * 错误类型定义
 */

/** 状态码映射 */
export const STATUS_CODE_NAMES: Record<number, string> = {
    0x00: '成功',
    0x01: '未知命令',
    0x02: '参数错误',
    0x03: '设备忙',
    0x04: '操作超时',
    0x05: 'WiFi未连接',
};

/**
 * 协议错误 — ESP32 返回非成功状态码时抛出。
 */
export class ProtocolError extends Error {
    /** 状态码 */
    readonly code: number;

    constructor(code: number) {
        const name = STATUS_CODE_NAMES[code] ?? `未知状态码(0x${code.toString(16).padStart(2, '0')})`;
        super(`协议错误: ${name} (0x${code.toString(16).padStart(2, '0')})`);
        this.name = 'ProtocolError';
        this.code = code;
    }
}

/**
 * 连接错误 — TCP 连接断开或未建立时抛出。
 */
export class ConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
    }
}

/**
 * 超时错误 — 请求在指定时间内未收到响应时抛出。
 */
export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

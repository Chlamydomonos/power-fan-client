/**
 * 类型定义
 */

/**
 * 风扇 ID。
 * - 0 = 全部风扇
 * - 1 = 风扇1
 * - 2 = 风扇2
 * - 3 = 风扇3
 */
export type FanId = 0 | 1 | 2 | 3;

/**
 * 开机状态。
 * - 'on'  = 开机
 * - 'off' = 关机
 */
export type PowerState = 'on' | 'off';

/**
 * WiFi 配置（写入用）。
 */
export interface WiFiConfig {
    /** SSID，空字符串表示清空 WiFi 配置 */
    ssid: string;
    /** BSSID，MAC 地址格式 "AA:BB:CC:DD:EE:FF"，可选 */
    bssid?: string;
    /** WiFi 密码 */
    password: string;
}

/**
 * WiFi 配置信息（读取用）。
 */
export interface WiFiConfigInfo {
    /** 是否启用 BSSID 模式 */
    bssidMode: boolean;
    /** SSID，空字符串表示未配置 */
    ssid: string;
    /** BSSID，MAC 地址格式 "AA:BB:CC:DD:EE:FF" */
    bssid: string;
    /** WiFi 密码 */
    password: string;
}

/**
 * 物理按钮权限。
 */
export interface ButtonPermission {
    /** 物理开机按钮是否允许 */
    powerBtn: boolean;
    /** 物理重启按钮是否允许 */
    resetBtn: boolean;
}

/**
 * 风扇转速信息。
 */
export interface FanRpm {
    /** 风扇 ID (1-3) */
    fanId: number;
    /** 转速 (RPM) */
    rpm: number;
}

/**
 * 客户端配置选项。
 */
export interface PowerFanClientOptions {
    /** ESP32 主机地址 */
    host: string;
    /** TCP 端口，默认 8888 */
    port?: number;
    /** 是否启用自动重连，默认 true */
    reconnect?: boolean;
    /** 初始重连延迟（毫秒），默认 1000 */
    reconnectMinDelay?: number;
    /** 最大重连延迟（毫秒），默认 30000 */
    reconnectMaxDelay?: number;
    /** 请求超时时间（毫秒），默认 5000 */
    timeout?: number;
}

/**
 * 客户端事件类型。
 */
export interface PowerFanClientEvents {
    /** 连接成功 */
    connect: () => void;
    /** 连接断开 */
    disconnect: () => void;
    /** 重连成功 */
    reconnect: (attempt: number) => void;
    /** 错误 */
    error: (error: Error) => void;
}

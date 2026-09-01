/**
 * 命令封装 — 每个 CmdID 对应一个高层 API 方法。
 *
 * 负责构造请求 Payload、解析响应 Payload、状态码检查。
 */

import { CmdId } from './protocol.js';
import { ProtocolError } from './errors.js';
import type { FanId, FanRpm, PowerState, WiFiConfig, WiFiConfigInfo, ButtonPermission } from './types.js';
import type { TcpClientCore } from './client.js';

/**
 * 检查响应状态码，非 0x00 抛出 ProtocolError。
 *
 * @param payload 响应 Payload
 * @returns Payload 中状态码之后的剩余数据
 */
function checkStatus(payload: Buffer): Buffer {
    if (payload.length < 1) {
        throw new ProtocolError(0xff);
    }
    const status = payload[0];
    if (status !== 0x00) {
        throw new ProtocolError(status);
    }
    return payload.subarray(1);
}

/**
 * 将 BSSID 字符串 ("AA:BB:CC:DD:EE:FF") 转换为 6 字节 Buffer。
 */
function parseBssid(bssid: string): Buffer {
    const parts = bssid.split(/[:-]/);
    if (parts.length !== 6) {
        throw new Error(`BSSID 格式错误: ${bssid}`);
    }
    const bytes = parts.map((p) => {
        const n = parseInt(p, 16);
        if (Number.isNaN(n) || n < 0 || n > 255) {
            throw new Error(`BSSID 格式错误: ${bssid}`);
        }
        return n;
    });
    return Buffer.from(bytes);
}

/**
 * 将 6 字节 BSSID Buffer 转换为字符串格式 "AA:BB:CC:DD:EE:FF"。
 */
function formatBssid(buf: Buffer): string {
    const parts: string[] = [];
    for (let i = 0; i < 6; i++) {
        parts.push(buf[i].toString(16).padStart(2, '0').toUpperCase());
    }
    return parts.join(':');
}

/**
 * 命令封装类。
 *
 * 依赖 TcpClientCore 进行底层通信，提供类型安全的高层 API。
 */
export class Commands {
    constructor(private readonly core: TcpClientCore) {}

    // ─── WiFi 配置 ──────────────────────────────────────────

    /**
     * 设置 WiFi 配置 (CmdID 0x01)。
     *
     * @param config WiFi 配置
     */
    async setWiFiConfig(config: WiFiConfig): Promise<void> {
        const ssidBuf = Buffer.from(config.ssid, 'utf8');
        const pwdBuf = Buffer.from(config.password, 'utf8');

        if (ssidBuf.length > 32) throw new Error('SSID 长度不能超过 32 字节');
        if (pwdBuf.length > 64) throw new Error('密码长度不能超过 64 字节');

        const bssidBuf = config.bssid ? parseBssid(config.bssid) : Buffer.alloc(6, 0);

        // Payload: ssid_len(1B) + ssid + bssid(6B) + pwd_len(1B) + pwd
        const payload = Buffer.alloc(1 + ssidBuf.length + 6 + 1 + pwdBuf.length);
        let offset = 0;

        payload[offset++] = ssidBuf.length;
        ssidBuf.copy(payload, offset);
        offset += ssidBuf.length;

        bssidBuf.copy(payload, offset);
        offset += 6;

        payload[offset++] = pwdBuf.length;
        pwdBuf.copy(payload, offset);

        const frame = await this.core.send(CmdId.SET_WIFI_CONFIG, payload);
        checkStatus(frame.payload);
    }

    /**
     * 设置 BSSID 模式 (CmdID 0x02)。
     *
     * @param enable true=启用 BSSID 模式, false=禁用
     */
    async setBssidMode(enable: boolean): Promise<void> {
        const payload = Buffer.from([enable ? 1 : 0]);
        const frame = await this.core.send(CmdId.SET_BSSID_MODE, payload);
        checkStatus(frame.payload);
    }

    // ─── 开关机 ─────────────────────────────────────────────

    /**
     * 读取开机状态 (CmdID 0x03)。
     *
     * @returns 开机状态
     */
    async getPowerState(): Promise<PowerState> {
        const frame = await this.core.send(CmdId.GET_POWER_STATE);
        const data = checkStatus(frame.payload);
        if (data.length < 1) {
            throw new Error('开机状态响应数据不完整');
        }
        return data[0] === 1 ? 'on' : 'off';
    }

    /**
     * 开机 (CmdID 0x04)。
     */
    async powerOn(): Promise<void> {
        const frame = await this.core.send(CmdId.POWER_ON);
        checkStatus(frame.payload);
    }

    /**
     * 重启 (CmdID 0x05)。
     */
    async reboot(): Promise<void> {
        const frame = await this.core.send(CmdId.REBOOT);
        checkStatus(frame.payload);
    }

    /**
     * 设置物理按钮权限 (CmdID 0x06)。
     *
     * @param powerBtn 是否允许物理开机按钮
     * @param resetBtn 是否允许物理重启按钮
     */
    async setButtonPermission(powerBtn: boolean, resetBtn: boolean): Promise<void> {
        const payload = Buffer.from([powerBtn ? 1 : 0, resetBtn ? 1 : 0]);
        const frame = await this.core.send(CmdId.SET_BUTTON_PERMISSION, payload);
        checkStatus(frame.payload);
    }

    /**
     * 读取 WiFi 配置 (CmdID 0x0B)。
     *
     * @returns WiFi 配置信息
     */
    async getWiFiConfig(): Promise<WiFiConfigInfo> {
        const frame = await this.core.send(CmdId.GET_WIFI_CONFIG);
        const data = checkStatus(frame.payload);

        if (data.length < 3) {
            throw new Error('WiFi 配置响应数据不完整');
        }

        let offset = 0;
        const bssidMode = data[offset++] === 1;
        const ssidLen = data[offset++];

        if (offset + ssidLen + 6 + 1 > data.length) {
            throw new Error('WiFi 配置响应数据不完整');
        }

        const ssid = data.subarray(offset, offset + ssidLen).toString('utf8');
        offset += ssidLen;

        const bssid = formatBssid(data.subarray(offset, offset + 6));
        offset += 6;

        const pwdLen = data[offset++];
        if (offset + pwdLen > data.length) {
            throw new Error('WiFi 配置响应数据不完整');
        }

        const password = data.subarray(offset, offset + pwdLen).toString('utf8');

        return { bssidMode, ssid, bssid, password };
    }

    /**
     * 读取物理按钮权限 (CmdID 0x0C)。
     *
     * @returns 物理按钮权限
     */
    async getButtonPermission(): Promise<ButtonPermission> {
        const frame = await this.core.send(CmdId.GET_BUTTON_PERMISSION);
        const data = checkStatus(frame.payload);

        if (data.length < 2) {
            throw new Error('物理按钮权限响应数据不完整');
        }

        return {
            powerBtn: data[0] === 1,
            resetBtn: data[1] === 1,
        };
    }

    // ─── 温度与风扇 ─────────────────────────────────────────

    /**
     * 读取温度 (CmdID 0x07)。
     *
     * @returns 温度值（摄氏度浮点数）
     */
    async getTemperature(): Promise<number> {
        const frame = await this.core.send(CmdId.GET_TEMPERATURE);
        const data = checkStatus(frame.payload);
        if (data.length < 2) {
            throw new Error('温度响应数据不完整');
        }
        // 大端序有符号整数，单位 0.1℃
        const raw = data.readInt16BE(0);
        return raw / 10;
    }

    /**
     * 读取风扇转速 (CmdID 0x08)。
     *
     * @param fanId 风扇 ID (0=全部, 1-3=指定)
     * @returns 风扇转速数组
     */
    async getFanRpm(fanId: FanId): Promise<FanRpm[]> {
        const payload = Buffer.from([fanId]);
        const frame = await this.core.send(CmdId.GET_FAN_RPM, payload);
        const data = checkStatus(frame.payload);
        if (data.length < 1) {
            throw new Error('风扇转速响应数据不完整');
        }

        const count = data[0];
        const results: FanRpm[] = [];
        let offset = 1;

        for (let i = 0; i < count; i++) {
            if (offset + 3 > data.length) {
                throw new Error('风扇转速响应数据不完整');
            }
            const id = data[offset];
            const rpm = data.readUInt16BE(offset + 1);
            results.push({ fanId: id, rpm });
            offset += 3;
        }

        return results;
    }

    /**
     * 设置风扇开关 (CmdID 0x09)。
     *
     * @param fanId 风扇 ID (0=全部, 1-3=指定)
     * @param state true=开, false=关
     */
    async setFanSwitch(fanId: FanId, state: boolean): Promise<void> {
        const payload = Buffer.from([fanId, state ? 1 : 0]);
        const frame = await this.core.send(CmdId.SET_FAN_SWITCH, payload);
        checkStatus(frame.payload);
    }

    /**
     * 设置风扇 PWM (CmdID 0x0A)。
     *
     * @param fanId 风扇 ID (0=全部, 1-3=指定)
     * @param duty PWM 占空比 (0-255)
     */
    async setFanPwm(fanId: FanId, duty: number): Promise<void> {
        if (duty < 0 || duty > 255) {
            throw new Error('PWM 占空比必须在 0-255 范围内');
        }
        const payload = Buffer.from([fanId, Math.round(duty)]);
        const frame = await this.core.send(CmdId.SET_FAN_PWM, payload);
        checkStatus(frame.payload);
    }
}

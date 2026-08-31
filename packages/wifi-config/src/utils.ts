/**
 * 辅助函数 — BSSID 格式转换、输入验证等。
 */

/**
 * BSSID 正则表达式，支持冒号或连字符分隔。
 *
 * 格式：AA:BB:CC:DD:EE:FF 或 AA-BB-CC-DD-EE-FF
 */
const BSSID_REGEX = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;

/**
 * 验证 BSSID 格式是否合法。
 *
 * @param input 用户输入的 BSSID 字符串
 * @returns true 如果格式合法
 */
export function isValidBssid(input: string): boolean {
    return BSSID_REGEX.test(input.trim());
}

/**
 * 将 BSSID 字符串 ("AA:BB:CC:DD:EE:FF") 转换为 6 字节 Buffer。
 *
 * @param bssid BSSID 字符串
 * @returns 6 字节 Buffer
 * @throws Error 如果格式不合法
 */
export function parseBssid(bssid: string): Buffer {
    const trimmed = bssid.trim();
    if (!isValidBssid(trimmed)) {
        throw new Error(`BSSID 格式错误: ${bssid}`);
    }
    const parts = trimmed.split(/[:-]/);
    return Buffer.from(parts.map((p) => parseInt(p, 16)));
}

/**
 * 验证 IP 地址格式是否合法。
 *
 * @param input 用户输入的 IP 地址
 * @returns true 如果格式合法
 */
export function isValidIp(input: string): boolean {
    const trimmed = input.trim();
    const parts = trimmed.split('.');
    if (parts.length !== 4) return false;
    return parts.every((p) => {
        const n = Number(p);
        return Number.isInteger(n) && n >= 0 && n <= 255 && p === String(n);
    });
}

/**
 * 验证端口号是否合法。
 *
 * @param input 用户输入的端口号
 * @returns true 如果格式合法
 */
export function isValidPort(input: string): boolean {
    const n = Number(input);
    return Number.isInteger(n) && n > 0 && n <= 65535;
}

/**
 * 验证 SSID 长度是否合法（0-32 字节）。
 *
 * @param ssid SSID 字符串
 * @returns true 如果长度合法
 */
export function isValidSsid(ssid: string): boolean {
    const buf = Buffer.from(ssid, 'utf8');
    return buf.length <= 32;
}

/**
 * 验证密码长度是否合法（0-64 字节）。
 *
 * @param password 密码字符串
 * @returns true 如果长度合法
 */
export function isValidPassword(password: string): boolean {
    const buf = Buffer.from(password, 'utf8');
    return buf.length <= 64;
}

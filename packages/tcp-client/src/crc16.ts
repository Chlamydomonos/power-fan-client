/**
 * CRC-16/CCITT 校验实现
 *
 * 参数：
 * - 多项式：0x1021
 * - 初始值：0xFFFF
 * - 输入/输出不反转
 * - 异或输出：0x0000
 */

/**
 * 计算 CRC-16/CCITT 校验值。
 *
 * @param data 需要校验的数据（Buffer 或 Uint8Array）
 * @returns CRC-16 校验值（无符号 16 位整数）
 */
export function crc16(data: Uint8Array): number {
    let crc = 0xffff;

    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ 0x1021) & 0xffff;
            } else {
                crc = (crc << 1) & 0xffff;
            }
        }
    }

    return crc & 0xffff;
}

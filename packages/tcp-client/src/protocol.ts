/**
 * 帧编解码 — 封装 TCP 通信协议的帧格式。
 *
 * 帧格式：
 *   偏移   长度   字段       说明
 *   0      2      Magic      固定值 0xAA 0x55
 *   2      1      CmdID      命令ID
 *   3      2      Length      Payload 长度（大端序）
 *   5      N      Payload     载荷数据
 *   5+N    2      CRC16       CRC-16/CCITT（大端序，覆盖 Magic 到 Payload 末尾）
 */

import { crc16 } from './crc16.js';

/** 帧头 Magic 值 */
export const MAGIC = Buffer.from([0xaa, 0x55]);

/** 帧头长度（Magic 2B + CmdID 1B + Length 2B） */
export const HEADER_SIZE = 5;

/** CRC 长度 */
export const CRC_SIZE = 2;

/** 最小帧长度（无 Payload） */
export const MIN_FRAME_SIZE = HEADER_SIZE + CRC_SIZE; // 7

/**
 * 命令 ID 枚举
 */
export enum CmdId {
    /** 设置 WiFi 配置 */
    SET_WIFI_CONFIG = 0x01,
    /** 设置 BSSID 模式 */
    SET_BSSID_MODE = 0x02,
    /** 读取开机状态 */
    GET_POWER_STATE = 0x03,
    /** 开机 */
    POWER_ON = 0x04,
    /** 重启 */
    REBOOT = 0x05,
    /** 设置物理按钮权限 */
    SET_BUTTON_PERMISSION = 0x06,
    /** 读取温度 */
    GET_TEMPERATURE = 0x07,
    /** 读取风扇转速 */
    GET_FAN_RPM = 0x08,
    /** 设置风扇开关 */
    SET_FAN_SWITCH = 0x09,
    /** 设置风扇 PWM */
    SET_FAN_PWM = 0x0a,
}

/**
 * 编码一个请求帧。
 *
 * @param cmdId 命令 ID
 * @param payload 载荷数据（可选）
 * @returns 完整的帧 Buffer
 */
export function encodeFrame(cmdId: CmdId, payload?: Buffer): Buffer {
    const payloadLen = payload?.length ?? 0;
    const frame = Buffer.alloc(HEADER_SIZE + payloadLen + CRC_SIZE);

    // Magic
    frame[0] = 0xaa;
    frame[1] = 0x55;

    // CmdID
    frame[2] = cmdId;

    // Length (大端序)
    frame.writeUInt16BE(payloadLen, 3);

    // Payload
    if (payload && payloadLen > 0) {
        payload.copy(frame, HEADER_SIZE);
    }

    // CRC16 (覆盖 Magic 到 Payload 末尾)
    const crcData = frame.subarray(0, HEADER_SIZE + payloadLen);
    const crc = crc16(crcData);
    frame.writeUInt16BE(crc, HEADER_SIZE + payloadLen);

    return frame;
}

/**
 * 解析后的帧结构。
 */
export interface ParsedFrame {
    /** 命令 ID */
    cmdId: number;
    /** 载荷数据（不含状态码的原始 Payload） */
    payload: Buffer;
}

/**
 * 帧解析器 — 从流式数据中提取完整帧。
 *
 * 使用方式：
 *   const parser = new FrameParser();
 *   parser.append(chunk);
 *   while (true) {
 *     const frame = parser.tryParse();
 *     if (!frame) break;
 *     // 处理 frame
 *   }
 */
export class FrameParser {
    private buffer: Buffer = Buffer.alloc(0);

    /**
     * 追加接收到的数据。
     */
    append(data: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, data]);
    }

    /**
     * 尝试从缓冲区中解析一个完整帧。
     * 如果缓冲区中数据不足，返回 null。
     * 如果 CRC 校验失败，抛出错误。
     *
     * @returns 解析出的帧，或 null（数据不完整）
     */
    tryParse(): ParsedFrame | null {
        // 查找 Magic 帧头
        const magicIdx = this.buffer.indexOf(MAGIC);
        if (magicIdx === -1) {
            // 没有找到帧头，丢弃所有数据
            this.buffer = Buffer.alloc(0);
            return null;
        }

        // 丢弃帧头之前的无效数据
        if (magicIdx > 0) {
            this.buffer = this.buffer.subarray(magicIdx);
        }

        // 检查是否有足够的数据读取头部
        if (this.buffer.length < HEADER_SIZE) {
            return null;
        }

        // 读取 Payload 长度
        const payloadLen = this.buffer.readUInt16BE(3);
        const frameLen = HEADER_SIZE + payloadLen + CRC_SIZE;

        // 检查是否有完整的帧
        if (this.buffer.length < frameLen) {
            return null;
        }

        // 提取帧数据
        const frameData = this.buffer.subarray(0, frameLen);
        const cmdId = frameData[2];
        const payload = frameData.subarray(HEADER_SIZE, HEADER_SIZE + payloadLen);
        const crcReceived = frameData.readUInt16BE(HEADER_SIZE + payloadLen);

        // CRC 校验（覆盖 Magic 到 Payload 末尾）
        const crcExpected = crc16(frameData.subarray(0, HEADER_SIZE + payloadLen));
        if (crcReceived !== crcExpected) {
            // CRC 校验失败，丢弃整个帧，保留剩余数据
            this.buffer = this.buffer.subarray(frameLen);
            throw new Error(
                `CRC 校验失败: 期望 0x${crcExpected.toString(16).padStart(4, '0')}, ` +
                    `收到 0x${crcReceived.toString(16).padStart(4, '0')}`,
            );
        }

        // 移除已解析的帧
        this.buffer = this.buffer.subarray(frameLen);

        return { cmdId, payload };
    }

    /**
     * 清空缓冲区。
     */
    reset(): void {
        this.buffer = Buffer.alloc(0);
    }
}

/**
 * 各操作的具体实现 — 配置 WiFi、设置 BSSID 模式、查看状态。
 */

import { select, input, password, confirm } from '@inquirer/prompts';
import { PowerFanClient, ProtocolError, ConnectionError } from '@power-fan/tcp-client';
import { isValidBssid, isValidIp, isValidPort, isValidSsid, isValidPassword } from './utils.js';

/**
 * 交互式获取 ESP32 连接信息（IP + 端口），并建立连接。
 *
 * @returns 已连接的 PowerFanClient，或 null（用户选择返回）
 */
async function connectToEsp32(): Promise<PowerFanClient | null> {
    const host = await input({
        message: '请输入 ESP32 控制器 IP 地址:',
        validate: (v) => isValidIp(v) || '请输入合法的 IP 地址',
    });

    const portStr = await input({
        message: '请输入 TCP 端口:',
        default: '8888',
        validate: (v) => isValidPort(v) || '请输入合法的端口号 (1-65535)',
    });
    const port = parseInt(portStr, 10);

    console.log('\n正在连接 ESP32...');

    const client = new PowerFanClient({
        host: host.trim(),
        port,
        reconnect: false,
    });

    try {
        await client.connect();
        console.log('✓ 已连接到 ESP32\n');
        return client;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`✗ 连接失败: ${msg}\n`);

        const retry = await confirm({
            message: '是否重试?',
            default: true,
        });

        if (retry) {
            return connectToEsp32();
        }
        return null;
    }
}

/**
 * 操作：配置 WiFi。
 */
export async function actionConfigureWifi(): Promise<void> {
    const client = await connectToEsp32();
    if (!client) return;

    try {
        const ssid = await input({
            message: 'WiFi SSID:',
            validate: (v) => isValidSsid(v) || 'SSID 长度不能超过 32 字节',
        });

        // SSID 为空时确认是否清空配置
        if (ssid.trim() === '') {
            const clear = await confirm({
                message: 'SSID 为空，将清空 WiFi 配置（重置为未配置状态）。确认?',
                default: false,
            });
            if (!clear) {
                console.log('已取消\n');
                return;
            }
        }

        const pwd = await password({
            message: 'WiFi 密码:',
            mask: '*',
            validate: (v) => isValidPassword(v) || '密码长度不能超过 64 字节',
        });

        // BSSID 为可选项
        const useBssid = await confirm({
            message: '是否指定 BSSID (MAC 地址)?',
            default: false,
        });

        let bssid: string | undefined;
        if (useBssid) {
            bssid = await input({
                message: 'BSSID (格式 AA:BB:CC:DD:EE:FF):',
                validate: (v) => isValidBssid(v) || 'BSSID 格式错误，应为 AA:BB:CC:DD:EE:FF',
            });
        }

        // 确认配置
        console.log('\n确认以下配置:');
        console.log(`  SSID:   ${ssid || '(空 — 清空配置)'}`);
        console.log(`  BSSID:  ${bssid ?? '(未指定)'}`);
        console.log(`  密码:   ${'*'.repeat(pwd.length || 0) || '(空)'}`);
        console.log();

        const confirmed = await confirm({
            message: '确认写入?',
            default: true,
        });

        if (!confirmed) {
            console.log('已取消\n');
            return;
        }

        await client.setWiFiConfig({
            ssid: ssid.trim(),
            bssid: bssid?.trim(),
            password: pwd,
        });

        console.log('✓ WiFi 配置已写入\n');
    } catch (err) {
        handleError(err);
    } finally {
        await client.disconnect();
    }
}

/**
 * 操作：启用/禁用 BSSID 模式。
 */
export async function actionSetBssidMode(): Promise<void> {
    const client = await connectToEsp32();
    if (!client) return;

    try {
        const choice = await select({
            message: 'BSSID 模式:',
            choices: [
                { name: '启用（使用 BSSID 连接指定 AP）', value: 'enable' },
                { name: '禁用（使用 SSID 模式）', value: 'disable' },
            ],
        });

        const enable = choice === 'enable';

        await client.setBssidMode(enable);

        console.log(`✓ BSSID 模式已设置为：${enable ? '启用' : '禁用'}\n`);
    } catch (err) {
        handleError(err);
    } finally {
        await client.disconnect();
    }
}

/**
 * 操作：查看当前 WiFi 配置。
 *
 * 注意：当前通信协议中 WiFi 配置为只写，无法读取 SSID/密码。
 * 此功能仅提示用户相关限制。
 */
export async function actionViewWifiConfig(): Promise<void> {
    console.log('当前通信协议不支持读取 WiFi 配置（SSID/密码为只写）。');
    console.log('如需查看或修改配置，请使用「配置 WiFi」功能重新设置。\n');
}

/**
 * 统一错误处理。
 */
function handleError(err: unknown): void {
    if (err instanceof ProtocolError) {
        console.error(`✗ 协议错误: ${err.message} (状态码 0x${err.code.toString(16).padStart(2, '0')})\n`);
    } else if (err instanceof ConnectionError) {
        console.error(`✗ 连接错误: ${err.message}\n`);
    } else if (err instanceof Error) {
        // inquirer 在用户按 Ctrl+C 时抛出错误，名称为 'ExitPromptError'
        if (err.name === 'ExitPromptError') {
            console.error('\n已退出\n');
            return;
        }
        console.error(`✗ 错误: ${err.message}\n`);
    } else {
        console.error(`✗ 未知错误: ${String(err)}\n`);
    }
}

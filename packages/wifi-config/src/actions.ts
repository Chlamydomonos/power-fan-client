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
export async function connectToEsp32(): Promise<PowerFanClient | null> {
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
export async function actionConfigureWifi(client: PowerFanClient): Promise<void> {
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
    }
}

/**
 * 操作：启用/禁用 BSSID 模式。
 */
export async function actionSetBssidMode(client: PowerFanClient): Promise<void> {
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
    }
}

/**
 * 操作：查看当前 WiFi 配置。
 *
 * 通过 CmdID 0x0B 读取 ESP32 NVS 中保存的 WiFi 配置。
 */
export async function actionViewWifiConfig(client: PowerFanClient): Promise<void> {
    try {
        const config = await client.getWiFiConfig();

        console.log('当前 WiFi 配置:');
        console.log(`  BSSID 模式: ${config.bssidMode ? '启用' : '禁用'}`);
        console.log(`  SSID:       ${config.ssid || '(未配置)'}`);
        console.log(`  BSSID:      ${config.bssid}`);
        console.log(`  密码:       ${config.password ? '已设置' : '(空)'}`);
        console.log();
    } catch (err) {
        handleError(err);
    }
}

// ─── 调试功能 ──────────────────────────────────────────────

/**
 * 调试：读取机箱温度。
 */
export async function actionDebugGetTemperature(client: PowerFanClient): Promise<void> {
    try {
        const temp = await client.getTemperature();
        console.log(`✓ 机箱温度: ${temp.toFixed(1)}°C\n`);
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：读取风扇转速。
 */
export async function actionDebugGetFanRpm(client: PowerFanClient): Promise<void> {
    try {
        const fanIdStr = await input({
            message: '风扇 ID (0=全部, 1-3=指定):',
            default: '0',
            validate: (v) => ['0', '1', '2', '3'].includes(v.trim()) || '请输入 0-3',
        });
        const fanId = parseInt(fanIdStr, 10) as 0 | 1 | 2 | 3;

        const rpms = await client.getFanRpm(fanId);
        console.log('✓ 风扇转速:');
        for (const fan of rpms) {
            console.log(`  风扇${fan.fanId}: ${fan.rpm} RPM`);
        }
        console.log();
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：设置风扇开关。
 */
export async function actionDebugSetFanSwitch(client: PowerFanClient): Promise<void> {
    try {
        const fanIdStr = await input({
            message: '风扇 ID (0=全部, 1-3=指定):',
            default: '0',
            validate: (v) => ['0', '1', '2', '3'].includes(v.trim()) || '请输入 0-3',
        });
        const fanId = parseInt(fanIdStr, 10) as 0 | 1 | 2 | 3;

        const state = await confirm({
            message: '风扇状态:',
            default: true,
        });

        await client.setFanSwitch(fanId, state);
        console.log(`✓ 风扇${fanId === 0 ? '(全部)' : fanId} 已${state ? '开启' : '关闭'}\n`);
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：设置风扇 PWM。
 */
export async function actionDebugSetFanPwm(client: PowerFanClient): Promise<void> {
    try {
        const fanIdStr = await input({
            message: '风扇 ID (0=全部, 1-3=指定):',
            default: '0',
            validate: (v) => ['0', '1', '2', '3'].includes(v.trim()) || '请输入 0-3',
        });
        const fanId = parseInt(fanIdStr, 10) as 0 | 1 | 2 | 3;

        const dutyStr = await input({
            message: 'PWM 占空比 (0-255):',
            default: '128',
            validate: (v) => {
                const n = Number(v);
                return (Number.isInteger(n) && n >= 0 && n <= 255) || '请输入 0-255 的整数';
            },
        });
        const duty = parseInt(dutyStr, 10);

        await client.setFanPwm(fanId, duty);
        console.log(
            `✓ 风扇${fanId === 0 ? '(全部)' : fanId} PWM 已设置为 ${duty} (${Math.round((duty / 255) * 100)}%)\n`,
        );
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：读取开机状态。
 */
export async function actionDebugGetPowerState(client: PowerFanClient): Promise<void> {
    try {
        const state = await client.getPowerState();
        console.log(`✓ 开机状态: ${state === 'on' ? '开机中' : '已关机'}\n`);
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：远程开机。
 */
export async function actionDebugPowerOn(client: PowerFanClient): Promise<void> {
    try {
        const confirmed = await confirm({
            message: '确认执行远程开机?',
            default: false,
        });
        if (!confirmed) {
            console.log('已取消\n');
            return;
        }

        await client.powerOn();
        console.log('✓ 开机指令已发送\n');
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：远程重启。
 */
export async function actionDebugReboot(client: PowerFanClient): Promise<void> {
    try {
        const confirmed = await confirm({
            message: '确认执行远程重启? 这将强制重启目标电脑!',
            default: false,
        });
        if (!confirmed) {
            console.log('已取消\n');
            return;
        }

        await client.reboot();
        console.log('✓ 重启指令已发送\n');
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：读取物理按钮权限。
 */
export async function actionDebugGetButtonPermission(client: PowerFanClient): Promise<void> {
    try {
        const perm = await client.getButtonPermission();
        console.log('✓ 物理按钮权限:');
        console.log(`  开机按钮: ${perm.powerBtn ? '允许' : '禁用'}`);
        console.log(`  重启按钮: ${perm.resetBtn ? '允许' : '禁用'}`);
        console.log();
    } catch (err) {
        handleError(err);
    }
}

/**
 * 调试：设置物理按钮权限。
 */
export async function actionDebugSetButtonPermission(client: PowerFanClient): Promise<void> {
    try {
        const powerBtn = await confirm({
            message: '允许物理开机按钮?',
            default: true,
        });
        const resetBtn = await confirm({
            message: '允许物理重启按钮?',
            default: true,
        });

        await client.setButtonPermission(powerBtn, resetBtn);
        console.log(`✓ 物理按钮权限已设置: 开机=${powerBtn ? '允许' : '禁用'}, 重启=${resetBtn ? '允许' : '禁用'}\n`);
    } catch (err) {
        handleError(err);
    }
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

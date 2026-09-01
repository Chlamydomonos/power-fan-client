#!/usr/bin/env node

/**
 * @power-fan/wifi-config — WiFi 配置工具入口
 *
 * 基于 @inquirer/prompts 的交互式 CLI 工具，
 * 用于配置 ESP32 风扇控制器的 WiFi 连接。
 */

import { select } from '@inquirer/prompts';
import {
    connectToEsp32,
    actionConfigureWifi,
    actionSetBssidMode,
    actionViewWifiConfig,
    actionDebugGetTemperature,
    actionDebugGetFanRpm,
    actionDebugSetFanSwitch,
    actionDebugSetFanPwm,
    actionDebugGetPowerState,
    actionDebugPowerOn,
    actionDebugReboot,
    actionDebugGetButtonPermission,
    actionDebugSetButtonPermission,
} from './actions.js';
import type { PowerFanClient } from '@power-fan/tcp-client';

/** 主菜单选项 */
const MENU_CHOICES = [
    { name: '配置 WiFi', value: 'configure' },
    { name: '启用/禁用 BSSID 模式', value: 'bssid' },
    { name: '查看当前 WiFi 配置', value: 'view' },
    { name: '调试工具', value: 'debug' },
    { name: '断开并退出', value: 'exit' },
];

/** 调试子菜单选项 */
const DEBUG_CHOICES = [
    { name: '读取机箱温度', value: 'temp' },
    { name: '读取风扇转速', value: 'fan_rpm' },
    { name: '设置风扇开关', value: 'fan_switch' },
    { name: '设置风扇 PWM', value: 'fan_pwm' },
    { name: '读取开机状态', value: 'power_state' },
    { name: '远程开机', value: 'power_on' },
    { name: '远程重启', value: 'reboot' },
    { name: '读取物理按钮权限', value: 'get_btn' },
    { name: '设置物理按钮权限', value: 'set_btn' },
    { name: '返回主菜单', value: 'back' },
];

/**
 * 调试子菜单。
 */
async function debugMenu(client: PowerFanClient): Promise<void> {
    while (true) {
        const choice = await select({
            message: '调试功能:',
            choices: DEBUG_CHOICES,
        });

        switch (choice) {
            case 'temp':
                await actionDebugGetTemperature(client);
                break;
            case 'fan_rpm':
                await actionDebugGetFanRpm(client);
                break;
            case 'fan_switch':
                await actionDebugSetFanSwitch(client);
                break;
            case 'fan_pwm':
                await actionDebugSetFanPwm(client);
                break;
            case 'power_state':
                await actionDebugGetPowerState(client);
                break;
            case 'power_on':
                await actionDebugPowerOn(client);
                break;
            case 'reboot':
                await actionDebugReboot(client);
                break;
            case 'get_btn':
                await actionDebugGetButtonPermission(client);
                break;
            case 'set_btn':
                await actionDebugSetButtonPermission(client);
                break;
            case 'back':
                return;
        }
    }
}

/**
 * 显示主菜单并处理用户选择。
 */
async function mainMenu(): Promise<void> {
    // 先连接 ESP32，后续操作复用同一连接
    const client = await connectToEsp32();
    if (!client) {
        console.log('再见\n');
        return;
    }

    try {
        while (true) {
            const choice = await select({
                message: '请选择操作:',
                choices: MENU_CHOICES,
            });

            switch (choice) {
                case 'configure':
                    await actionConfigureWifi(client);
                    break;
                case 'bssid':
                    await actionSetBssidMode(client);
                    break;
                case 'view':
                    await actionViewWifiConfig(client);
                    break;
                case 'debug':
                    await debugMenu(client);
                    break;
                case 'exit':
                    console.log('再见\n');
                    return;
            }
        }
    } finally {
        await client.disconnect();
    }
}

// 启动 CLI
mainMenu().catch((err) => {
    if (err instanceof Error && err.name === 'ExitPromptError') {
        console.log('\n再见\n');
    } else {
        console.error('致命错误:', err);
        process.exit(1);
    }
});

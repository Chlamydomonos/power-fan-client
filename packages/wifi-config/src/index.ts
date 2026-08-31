#!/usr/bin/env node

/**
 * @power-fan/wifi-config — WiFi 配置工具入口
 *
 * 基于 @inquirer/prompts 的交互式 CLI 工具，
 * 用于配置 ESP32 风扇控制器的 WiFi 连接。
 */

import { select } from '@inquirer/prompts';
import { actionConfigureWifi, actionSetBssidMode, actionViewWifiConfig } from './actions.js';

/** 主菜单选项 */
const MENU_CHOICES = [
    { name: '配置 WiFi', value: 'configure' },
    { name: '启用/禁用 BSSID 模式', value: 'bssid' },
    { name: '查看当前 WiFi 配置', value: 'view' },
    { name: '退出', value: 'exit' },
];

/**
 * 显示主菜单并处理用户选择。
 */
async function mainMenu(): Promise<void> {
    while (true) {
        const choice = await select({
            message: '请选择操作:',
            choices: MENU_CHOICES,
        });

        switch (choice) {
            case 'configure':
                await actionConfigureWifi();
                break;
            case 'bssid':
                await actionSetBssidMode();
                break;
            case 'view':
                await actionViewWifiConfig();
                break;
            case 'exit':
                console.log('再见\n');
                return;
        }
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

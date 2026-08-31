# WiFi 配置工具设计

## 1. 概述

WiFi 配置工具是一个交互式 CLI 程序，基于 `inquirer.js`，用于配置 ESP32 风扇控制器的 WiFi 连接。工具运行在开发者电脑上，通过局域网直接连接 ESP32。控制器的 IP 地址通过交互式输入。

## 2. 包信息

- **包名**：`@power-fan/wifi-config`
- **路径**：`packages/wifi-config`
- **类型**：CLI 工具
- **构建**：tsc 编译输出到 `dist/`，通过 `node dist/index.js` 运行

## 3. 目录结构

```
packages/wifi-config/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # 入口，inquirer 交互流程
    ├── actions.ts            # 各操作的具体实现
    └── utils.ts              # 辅助函数（BSSID 格式转换等）
```

## 4. 交互流程

### 4.1 主菜单

```
? 请选择操作：
> 配置 WiFi
  启用/禁用 BSSID 模式
  查看当前 WiFi 配置
  退出
```

### 4.2 配置 WiFi

```
? 请输入 ESP32 控制器 IP 地址: 192.168.1.100
? 请输入 TCP 端口: (8888)

正在连接 ESP32...

? WiFi SSID: MyWiFi
? WiFi 密码: ********
? 是否指定 BSSID (MAC 地址)? (y/N) y
? BSSID (格式 AA:BB:CC:DD:EE:FF): AA:BB:CC:DD:EE:FF

确认以下配置：
  SSID:   MyWiFi
  BSSID:  AA:BB:CC:DD:EE:FF
  密码:   ********

? 确认写入? (Y/n)

✓ WiFi 配置已写入
```

- SSID 为空时提示确认是否清空 WiFi 配置（重置为未配置状态）
- BSSID 为可选项，不输入则使用全零 MAC
- 密码输入使用 `type: 'password'` 隐藏显示

### 4.3 启用/禁用 BSSID 模式

```
? 请输入 ESP32 控制器 IP 地址: 192.168.1.100
? 请输入 TCP 端口: (8888)

? BSSID 模式：
> 启用（使用 BSSID 连接指定 AP）
  禁用（使用 SSID 模式）

✓ BSSID 模式已设置为：启用
```

### 4.4 查看当前 WiFi 配置

- 读取 ESP32 当前 WiFi 配置（如果协议支持读取）
- 显示 SSID、BSSID 模式状态
- 注意：密码不回显

> **注意**：当前通信协议中 WiFi 配置为只写（CmdID 0x01 只有设置，没有读取）。查看功能仅显示 BSSID 模式状态（可通过读取 NVS 间接获取），WiFi SSID/密码无法读取。如需此功能，后续可在 ESP32 固件中添加读取命令。

## 5. BSSID 格式处理

- 用户输入格式：`AA:BB:CC:DD:EE:FF`（冒号分隔的十六进制）
- 转换为 6 字节 Buffer 发送给 ESP32
- 验证格式合法性（6 组两位十六进制）

```typescript
function parseBssid(input: string): Buffer {
  const parts = input.split(':');
  if (parts.length !== 6) throw new Error('BSSID 格式错误');
  return Buffer.from(parts.map(p => parseInt(p, 16)));
}
```

## 6. 错误处理

- 连接 ESP32 失败时提示并允许重试或返回主菜单
- 协议错误（状态码非 0x00）时显示对应错误信息
- 用户输入格式错误时 inquirer 自动验证并提示重新输入

## 7. 使用方式

```bash
# 通过 pnpm 运行
pnpm --filter @power-fan/wifi-config start

# 或直接运行
node packages/wifi-config/dist/index.js
```

## 8. 依赖

| 依赖 | 说明 |
|------|------|
| `inquirer` | 交互式命令行界面 |
| `@power-fan/tcp-client` | TCP 客户端通信 |
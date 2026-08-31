# TCP 客户端设计

## 1. 概述

`@power-fan/tcp-client` 是核心通信库，封装与 ESP32 风扇控制模块的 TCP 二进制通信协议。提供类型安全的 API，支持自动重连和事件通知。

## 2. 包信息

- **包名**：`@power-fan/tcp-client`
- **路径**：`packages/tcp-client`
- **类型**：库（被其他包引用）
- **构建**：tsc 编译输出到 `dist/`

## 3. 目录结构

```
packages/tcp-client/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # 导出入口
    ├── protocol.ts           # 帧编解码（Magic/CmdID/Length/Payload/CRC16）
    ├── crc16.ts              # CRC-16/CCITT 实现
    ├── client.ts             # TCP 客户端核心类
    ├── commands.ts           # 命令封装（每个 CmdID 对应一个方法）
    ├── types.ts              # 类型定义
    └── errors.ts             # 错误定义
```

## 4. 协议实现

### 4.1 帧格式

```
偏移   长度   字段       说明
──────────────────────────────────────────────
0      2      Magic      固定值 0xAA 0x55
2      1      CmdID      命令ID
3      2      Length      Payload 长度（大端序）
5      N      Payload     载荷数据
5+N    2      CRC16       CRC-16/CCITT（大端序，覆盖 Magic 到 Payload 末尾）
```

### 4.2 CRC-16/CCITT

- 多项式：`0x1021`
- 初始值：`0xFFFF`
- 输入/输出不反转
- 异或输出：`0x0000`

### 4.3 状态码

| 状态码 | 含义 |
|--------|------|
| 0x00 | 成功 |
| 0x01 | 未知命令 |
| 0x02 | 参数错误 |
| 0x03 | 设备忙 |
| 0x04 | 操作超时 |
| 0x05 | WiFi未连接 |

## 5. 核心类设计

### 5.1 `PowerFanClient`

```typescript
class PowerFanClient extends EventEmitter {
  constructor(options: PowerFanClientOptions);

  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get isConnected(): boolean;

  // 事件
  // 'connect'    — 连接成功
  // 'disconnect' — 连接断开
  // 'reconnect'  — 重连成功 (attempt: number)
  // 'error'      — 错误 (error: Error)

  // WiFi 配置
  setWiFiConfig(config: WiFiConfig): Promise<void>;
  setBssidMode(enable: boolean): Promise<void>;

  // 开关机
  getPowerState(): Promise<PowerState>;
  powerOn(): Promise<void>;
  reboot(): Promise<void>;
  setButtonPermission(powerBtn: boolean, resetBtn: boolean): Promise<void>;

  // 温度与风扇
  getTemperature(): Promise<number>;          // 返回摄氏度浮点数
  getFanRpm(fanId: FanId): Promise<FanRpm[]>;
  setFanSwitch(fanId: FanId, state: boolean): Promise<void>;
  setFanPwm(fanId: FanId, duty: number): Promise<void>;  // duty: 0-255
}
```

### 5.2 配置选项

```typescript
interface PowerFanClientOptions {
  host: string;
  port?: number;           // 默认 8888
  reconnect?: boolean;     // 默认 true
  reconnectMinDelay?: number;  // 初始重连延迟，默认 1000ms
  reconnectMaxDelay?: number;  // 最大重连延迟，默认 30000ms
  timeout?: number;        // 请求超时，默认 5000ms
}
```

### 5.3 自动重连策略

- **指数退避**：初始 1 秒，每次重连失败后延迟翻倍，最大 30 秒上限
- 重连成功后重置退避计数器
- 重连过程中事件通知：`disconnect` → （后台重连）→ `reconnect` / `error`
- 调用 `disconnect()` 主动断开时不触发自动重连

### 5.4 请求-响应匹配

- 每个请求帧携带 CmdID，响应帧使用相同 CmdID
- 同一 CmdID 的请求串行化（排队等待前一个响应完成）
- 请求超时后拒绝当前 Promise，不影响后续请求

## 6. 类型定义

```typescript
type FanId = 0 | 1 | 2 | 3;  // 0=全部, 1/2/3=指定风扇

type PowerState = 'on' | 'off';

interface WiFiConfig {
  ssid: string;       // SSID，空字符串表示清空配置
  bssid?: string;     // MAC 地址，格式 "AA:BB:CC:DD:EE:FF"
  password: string;
}

interface FanRpm {
  fanId: number;
  rpm: number;
}
```

## 7. 错误处理

```typescript
class ProtocolError extends Error {
  code: number;  // 状态码
}

class ConnectionError extends Error {}
class TimeoutError extends Error {}
```

- 响应状态码非 0x00 时抛出 `ProtocolError`
- 连接断开时抛出 `ConnectionError`
- 请求超时抛出 `TimeoutError`

## 8. 使用示例

```typescript
import { PowerFanClient } from '@power-fan/tcp-client';

const client = new PowerFanClient({
  host: '192.168.1.100',
  port: 8888,
});

client.on('connect', () => console.log('已连接'));
client.on('disconnect', () => console.log('连接断开，将自动重连'));

await client.connect();

const temp = await client.getTemperature();     // 25.5
const state = await client.getPowerState();      // 'on'
await client.setFanPwm(1, 200);                  // 风扇1 PWM=200
await client.powerOn();                          // 远程开机
```
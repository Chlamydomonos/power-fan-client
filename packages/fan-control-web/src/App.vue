<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NSpace, NLayout, NLayoutContent, NTag } from 'naive-ui';
import { useWebSocket } from './composables/useWebSocket';
import TempDisplay from './components/TempDisplay.vue';
import FanRpmDisplay from './components/FanRpmDisplay.vue';
import ExpressionEditor from './components/ExpressionEditor.vue';
import FanManualControl from './components/FanManualControl.vue';

const { data, connected } = useWebSocket();
</script>

<template>
    <n-config-provider>
        <n-message-provider>
            <n-layout style="min-height: 100vh">
                <n-layout-content style="max-width: 800px; margin: 0 auto; padding: 24px 16px">
                    <n-space justify="space-between" align="center" style="margin-bottom: 16px">
                        <h1 style="margin: 0">风扇控制面板</h1>
                        <n-tag :type="connected ? 'success' : 'error'" round>
                            {{ connected ? '已连接' : '未连接' }}
                        </n-tag>
                    </n-space>

                    <n-space vertical size="large">
                        <TempDisplay :temps="data?.temps ?? null" />
                        <FanRpmDisplay :fans="data?.fans ?? []" />
                        <ExpressionEditor />
                        <FanManualControl />
                    </n-space>
                </n-layout-content>
            </n-layout>
        </n-message-provider>
    </n-config-provider>
</template>

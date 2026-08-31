<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NTag, NSpace } from 'naive-ui';
import type { PowerStatusData } from '../composables/useWebSocket';

const props = defineProps<{ status: PowerStatusData }>();

const powerStateText = computed(() => {
    if (props.status.powerState === null) return '未知';
    return props.status.powerState === 'on' ? '开机中' : '已关机';
});

const powerStateType = computed(() => {
    if (props.status.powerState === null) return 'default';
    return props.status.powerState === 'on' ? 'success' : 'error';
});

const esp32Text = computed(() => {
    return props.status.esp32Connected ? '已连接' : '未连接';
});

const esp32Type = computed(() => {
    return props.status.esp32Connected ? 'success' : 'warning';
});
</script>

<template>
    <n-card title="开机状态">
        <n-space align="center" size="large">
            <n-tag :type="powerStateType" size="large" round>
                {{ powerStateText }}
            </n-tag>
            <n-tag :type="esp32Type" size="medium" round> ESP32: {{ esp32Text }} </n-tag>
        </n-space>
    </n-card>
</template>

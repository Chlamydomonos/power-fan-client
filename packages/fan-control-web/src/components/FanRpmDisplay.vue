<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NGrid, NGi, NStatistic, NTag, NSpace } from 'naive-ui';
import type { FanData } from '../composables/useWebSocket';

const props = defineProps<{ fans: FanData[] }>();

const fan1 = computed(() => props.fans.find((f) => f.fanId === 1));
const fan2 = computed(() => props.fans.find((f) => f.fanId === 2));
const fan3 = computed(() => props.fans.find((f) => f.fanId === 3));

function formatRpm(fan: FanData | undefined): string {
    if (!fan) return '--';
    return fan.on ? `${fan.rpm}` : 'OFF';
}

function formatPwm(fan: FanData | undefined): string {
    if (!fan) return '--';
    return `${fan.pwm}`;
}
</script>

<template>
    <n-card title="风扇状态">
        <n-grid :cols="3" :x-gap="16">
            <n-gi>
                <n-space vertical align="center">
                    <n-statistic label="风扇1" :value="formatRpm(fan1)">
                        <template #suffix>RPM</template>
                    </n-statistic>
                    <n-tag :type="fan1?.on ? 'success' : 'error'" size="small"> PWM: {{ formatPwm(fan1) }} </n-tag>
                </n-space>
            </n-gi>
            <n-gi>
                <n-space vertical align="center">
                    <n-statistic label="风扇2" :value="formatRpm(fan2)">
                        <template #suffix>RPM</template>
                    </n-statistic>
                    <n-tag :type="fan2?.on ? 'success' : 'error'" size="small"> PWM: {{ formatPwm(fan2) }} </n-tag>
                </n-space>
            </n-gi>
            <n-gi>
                <n-space vertical align="center">
                    <n-statistic label="风扇3" :value="formatRpm(fan3)">
                        <template #suffix>RPM</template>
                    </n-statistic>
                    <n-tag :type="fan3?.on ? 'success' : 'error'" size="small"> PWM: {{ formatPwm(fan3) }} </n-tag>
                </n-space>
            </n-gi>
        </n-grid>
    </n-card>
</template>

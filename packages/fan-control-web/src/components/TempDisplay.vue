<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NStatistic, NGrid, NGi } from 'naive-ui';
import type { TempData } from '../composables/useWebSocket';

const props = defineProps<{ temps: TempData | null }>();

const cpuTemp = computed(() => props.temps?.cpuTemp?.toFixed(1) ?? '--');
const gpuTemp = computed(() => props.temps?.gpuTemp?.toFixed(1) ?? '--');
const caseTemp = computed(() => props.temps?.caseTemp?.toFixed(1) ?? '--');
</script>

<template>
    <n-card title="温度监控">
        <n-grid :cols="3" :x-gap="16">
            <n-gi>
                <n-statistic label="CPU" :value="cpuTemp">
                    <template #suffix>°C</template>
                </n-statistic>
            </n-gi>
            <n-gi>
                <n-statistic label="GPU" :value="gpuTemp">
                    <template #suffix>°C</template>
                </n-statistic>
            </n-gi>
            <n-gi>
                <n-statistic label="机箱" :value="caseTemp">
                    <template #suffix>°C</template>
                </n-statistic>
            </n-gi>
        </n-grid>
    </n-card>
</template>

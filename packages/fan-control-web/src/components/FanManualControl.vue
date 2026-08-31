<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NSpace, NSwitch, NSlider, NButton, NGrid, NGi, NText, useMessage } from 'naive-ui';
import { useApi } from '../composables/useApi';

const { setFanSwitch, setFanPwm } = useApi();
const message = useMessage();

interface FanControl {
    on: boolean;
    pwm: number;
    loading: boolean;
}

const fans = ref<Record<number, FanControl>>({
    1: { on: false, pwm: 128, loading: false },
    2: { on: false, pwm: 128, loading: false },
    3: { on: false, pwm: 128, loading: false },
});

async function applySwitch(fanId: number, state: boolean) {
    fans.value[fanId].on = state;
}

async function applyFan(fanId: number) {
    const fan = fans.value[fanId];
    fan.loading = true;
    try {
        await setFanSwitch(fanId, fan.on);
        await setFanPwm(fanId, fan.pwm);
        message.success(`风扇${fanId} 已应用`);
    } catch (err) {
        message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
        fan.loading = false;
    }
}
</script>

<template>
    <n-card title="手动控制（覆盖表达式）">
        <n-space vertical size="large">
            <n-grid v-for="fanId in [1, 2, 3]" :key="fanId" :cols="1">
                <n-gi>
                    <n-space align="center" size="large">
                        <n-text bold>风扇{{ fanId }}</n-text>
                        <n-switch :value="fans[fanId].on" @update:value="(v: boolean) => applySwitch(fanId, v)" />
                        <n-text depth="3">{{ fans[fanId].on ? '开' : '关' }}</n-text>
                        <n-slider v-model:value="fans[fanId].pwm" :min="0" :max="255" :step="1" style="width: 200px" />
                        <n-text>PWM: {{ fans[fanId].pwm }}</n-text>
                        <n-button size="small" type="primary" :loading="fans[fanId].loading" @click="applyFan(fanId)">
                            应用
                        </n-button>
                    </n-space>
                </n-gi>
            </n-grid>
        </n-space>
    </n-card>
</template>

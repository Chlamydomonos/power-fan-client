<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
    NCard,
    NSpace,
    NSwitch,
    NSlider,
    NButton,
    NGrid,
    NGi,
    NText,
    NTooltip,
    NInputNumber,
    useMessage,
} from 'naive-ui';
import { useApi } from '../composables/useApi';

const { setFanSwitch, setFanPwm, clearOverride, getSmoothEnabled, setSmoothEnabled, setSmoothStep } = useApi();
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

const smoothEnabled = ref(false);
const smoothLoading = ref(false);
const smoothStep = ref(5);
const smoothStepLoading = ref(false);

onMounted(async () => {
    try {
        const result = await getSmoothEnabled();
        smoothEnabled.value = result.enabled;
        smoothStep.value = result.step;
    } catch {
        // 忽略，默认 false / 5
    }
});

async function toggleSmooth(enabled: boolean) {
    smoothLoading.value = true;
    try {
        await setSmoothEnabled(enabled);
        smoothEnabled.value = enabled;
        message.success(enabled ? '平滑过渡已启用' : '平滑过渡已关闭');
    } catch (err) {
        message.error(err instanceof Error ? err.message : '操作失败');
        // 回滚 UI
        smoothEnabled.value = !enabled;
    } finally {
        smoothLoading.value = false;
    }
}

async function applySmoothStep() {
    smoothStepLoading.value = true;
    try {
        await setSmoothStep(smoothStep.value);
        message.success(`平滑步长已设为 ${smoothStep.value}`);
    } catch (err) {
        message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
        smoothStepLoading.value = false;
    }
}

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

async function resetToAuto(fanId: number) {
    const fan = fans.value[fanId];
    fan.loading = true;
    try {
        await clearOverride(fanId);
        message.success(`风扇${fanId} 已恢复自动控制`);
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
            <n-space align="center" justify="space-between">
                <n-space align="center">
                    <n-tooltip trigger="hover">
                        <template #trigger>
                            <n-text depth="3" style="cursor: help">⚙ 平滑过渡</n-text>
                        </template>
                        启用后，风扇开关与 PWM 占空比将逐步渐变，避免突变。关闭时直接设置目标值。
                    </n-tooltip>
                    <n-switch
                        :value="smoothEnabled"
                        :loading="smoothLoading"
                        @update:value="(v: boolean) => toggleSmooth(v)"
                    />
                    <n-text depth="3">{{ smoothEnabled ? '已启用' : '已关闭' }}</n-text>
                </n-space>
                <n-space align="center">
                    <n-tooltip trigger="hover">
                        <template #trigger>
                            <n-text depth="3" style="cursor: help">步长</n-text>
                        </template>
                        每次 tick PWM 变化的步长（1-255），值越小过渡越平滑，值越大过渡越快。
                    </n-tooltip>
                    <n-input-number
                        v-model:value="smoothStep"
                        :min="1"
                        :max="255"
                        :step="1"
                        size="small"
                        style="width: 100px"
                        :loading="smoothStepLoading"
                    />
                    <n-button
                        size="small"
                        :loading="smoothStepLoading"
                        :disabled="smoothStep === 5"
                        @click="applySmoothStep"
                    >
                        应用步长
                    </n-button>
                </n-space>
            </n-space>

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
                        <n-button
                            size="small"
                            type="warning"
                            :loading="fans[fanId].loading"
                            @click="resetToAuto(fanId)"
                        >
                            恢复自动
                        </n-button>
                    </n-space>
                </n-gi>
            </n-grid>
        </n-space>
    </n-card>
</template>

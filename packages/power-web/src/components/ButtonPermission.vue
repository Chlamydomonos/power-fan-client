<script setup lang="ts">
import { ref, watch } from 'vue';
import { NCard, NSwitch, NSpace, NText } from 'naive-ui';
import { useApi } from '../composables/useApi';
import type { PowerStatusData } from '../composables/useWebSocket';

const props = defineProps<{ status: PowerStatusData }>();

const { setButtonPermission } = useApi();

const powerBtn = ref(false);
const resetBtn = ref(false);
const updating = ref(false);

// 同步后端状态到本地
// buttons 为 null 时表示后端尚不知道当前按钮权限状态（协议无读取命令）
// 此时开关可用，用户可以主动设置
watch(
    () => props.status.buttons,
    (buttons) => {
        if (buttons) {
            powerBtn.value = buttons.powerBtn;
            resetBtn.value = buttons.resetBtn;
        }
    },
    { immediate: true },
);

async function updatePowerBtn(val: boolean) {
    updating.value = true;
    try {
        await setButtonPermission(val, resetBtn.value);
        powerBtn.value = val;
    } catch {
        // 恢复原值
        powerBtn.value = !val;
    } finally {
        updating.value = false;
    }
}

async function updateResetBtn(val: boolean) {
    updating.value = true;
    try {
        await setButtonPermission(powerBtn.value, val);
        resetBtn.value = val;
    } catch {
        // 恢复原值
        resetBtn.value = !val;
    } finally {
        updating.value = false;
    }
}
</script>

<template>
    <n-card title="物理按钮权限">
        <n-space vertical size="large">
            <n-space align="center">
                <n-text>开机按钮</n-text>
                <n-switch :value="powerBtn" :disabled="updating" @update:value="updatePowerBtn" />
                <n-text depth="3">{{ powerBtn ? '启用' : '禁用' }}</n-text>
            </n-space>

            <n-space align="center">
                <n-text>重启按钮</n-text>
                <n-switch :value="resetBtn" :disabled="updating" @update:value="updateResetBtn" />
                <n-text depth="3">{{ resetBtn ? '启用' : '禁用' }}</n-text>
            </n-space>
        </n-space>
    </n-card>
</template>

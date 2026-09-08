<script setup lang="ts">
import { ref, computed } from 'vue';
import { NCard, NButton, NSpace, NModal, useMessage } from 'naive-ui';
import { useApi } from '../composables/useApi';
import type { PowerStatusData } from '../composables/useWebSocket';

const props = defineProps<{ status: PowerStatusData }>();

const { powerOn, reboot } = useApi();
const message = useMessage();

const showModal = ref(false);
const modalAction = ref<'on' | 'reboot'>('on');
const loading = ref(false);

const isPowerOn = computed(() => props.status.powerState === 'on');

const powerBtnText = computed(() => (isPowerOn.value ? '关 机' : '开 机'));
const powerBtnType = computed<'success' | 'error'>(() => (isPowerOn.value ? 'error' : 'success'));

const modalTitle = ref('');

function openModal(action: 'on' | 'reboot') {
    modalAction.value = action;
    if (action === 'on') {
        modalTitle.value = isPowerOn.value ? '确认关机' : '确认开机';
    } else {
        modalTitle.value = '确认重启';
    }
    showModal.value = true;
}

async function confirmAction() {
    loading.value = true;
    try {
        if (modalAction.value === 'on') {
            await powerOn();
            message.success(isPowerOn.value ? '关机指令已发送' : '开机指令已发送');
        } else {
            await reboot();
            message.success('重启指令已发送');
        }
        showModal.value = false;
    } catch (err) {
        message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <n-card title="操作">
        <n-space size="large">
            <n-button :type="powerBtnType" size="large" @click="openModal('on')"> {{ powerBtnText }} </n-button>
            <n-button type="warning" size="large" @click="openModal('reboot')"> 重 启 </n-button>
        </n-space>

        <n-modal
            v-model:show="showModal"
            preset="confirm"
            :title="modalTitle"
            positive-text="确认"
            negative-text="取消"
            :positive-button-props="{ type: 'warning', loading }"
            @positive-click="confirmAction"
        >
            <span v-if="modalAction === 'on'">{{
                isPowerOn ? '确定要执行远程关机操作吗？' : '确定要执行远程开机操作吗？'
            }}</span>
            <span v-else>确定要执行远程重启操作吗？这将强制重启目标电脑。</span>
        </n-modal>
    </n-card>
</template>

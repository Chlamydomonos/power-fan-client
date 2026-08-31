<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NButton, NSpace, NModal, useMessage } from 'naive-ui';
import { useApi } from '../composables/useApi';

const { powerOn, reboot } = useApi();
const message = useMessage();

const showModal = ref(false);
const modalAction = ref<'on' | 'reboot'>('on');
const loading = ref(false);

const modalTitle = ref('');

function openModal(action: 'on' | 'reboot') {
    modalAction.value = action;
    modalTitle.value = action === 'on' ? '确认开机' : '确认重启';
    showModal.value = true;
}

async function confirmAction() {
    loading.value = true;
    try {
        if (modalAction.value === 'on') {
            await powerOn();
            message.success('开机指令已发送');
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
            <n-button type="success" size="large" @click="openModal('on')"> 开 机 </n-button>
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
            <span v-if="modalAction === 'on'">确定要执行远程开机操作吗？</span>
            <span v-else>确定要执行远程重启操作吗？这将强制重启目标电脑。</span>
        </n-modal>
    </n-card>
</template>

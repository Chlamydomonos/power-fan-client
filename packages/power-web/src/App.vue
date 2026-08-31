<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NSpace, NLayout, NLayoutContent } from 'naive-ui';
import { useWebSocket } from './composables/useWebSocket';
import PowerStatus from './components/PowerStatus.vue';
import PowerActions from './components/PowerActions.vue';
import ButtonPermission from './components/ButtonPermission.vue';

const { status } = useWebSocket();
</script>

<template>
    <n-config-provider>
        <n-message-provider>
            <n-layout style="min-height: 100vh">
                <n-layout-content style="max-width: 700px; margin: 0 auto; padding: 24px 16px">
                    <h1 style="text-align: center; margin-bottom: 24px">远程开关机控制</h1>

                    <n-space vertical size="large">
                        <PowerStatus :status="status" />
                        <PowerActions />
                        <ButtonPermission :status="status" />
                    </n-space>
                </n-layout-content>
            </n-layout>
        </n-message-provider>
    </n-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NCard, NInput, NButton, NSpace, NGrid, NGi, NInputNumber, NDataTable, useMessage } from 'naive-ui';
import { useApi, type ExpressionConfig, type ExpressionTestResult } from '../composables/useApi';

const { getExpressions, saveExpressions, testExpressions } = useApi();
const message = useMessage();

const config = ref<ExpressionConfig>({
    fan1Switch: '',
    fan1Pwm: '',
    fan2Switch: '',
    fan2Pwm: '',
    fan3Switch: '',
    fan3Pwm: '',
});

const testCpu = ref(50);
const testGpu = 50;
const testCase = ref(35);
const testResults = ref<ExpressionTestResult[] | null>(null);
const saving = ref(false);
const testing = ref(false);

onMounted(async () => {
    try {
        config.value = await getExpressions();
    } catch (err) {
        message.error(err instanceof Error ? err.message : '加载表达式失败');
    }
});

async function handleSave() {
    saving.value = true;
    try {
        await saveExpressions(config.value);
        message.success('表达式已保存');
    } catch (err) {
        message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
        saving.value = false;
    }
}

async function handleTest() {
    testing.value = true;
    testResults.value = null;
    try {
        testResults.value = await testExpressions(config.value, {
            cpuTemp: testCpu.value,
            gpuTemp: testGpu,
            caseTemp: testCase.value,
        });
        message.success('测试完成');
    } catch (err) {
        message.error(err instanceof Error ? err.message : '测试失败');
    } finally {
        testing.value = false;
    }
}

const testColumns = [
    { title: '风扇', key: 'label' },
    { title: '开关', key: 'on' },
    { title: 'PWM', key: 'pwm' },
];

const testTableData = computed(() => {
    if (!testResults.value) return [];
    return testResults.value.map((r, i) => ({
        key: i,
        label: `风扇${i + 1}`,
        on: r.on ? '开' : '关',
        pwm: r.pwm,
    }));
});

import { computed } from 'vue';
</script>

<template>
    <n-card title="表达式编辑">
        <n-space vertical size="large">
            <!-- 风扇1 -->
            <n-grid :cols="2" :x-gap="16">
                <n-gi>
                    <n-space vertical>
                        <span>风扇1 开关</span>
                        <n-input v-model:value="config.fan1Switch" placeholder="cpuTemp > 40" />
                    </n-space>
                </n-gi>
                <n-gi>
                    <n-space vertical>
                        <span>风扇1 转速</span>
                        <n-input
                            v-model:value="config.fan1Pwm"
                            placeholder="Math.min(255, Math.max(0, (cpuTemp - 40) * 8))"
                        />
                    </n-space>
                </n-gi>
            </n-grid>

            <!-- 风扇2 -->
            <n-grid :cols="2" :x-gap="16">
                <n-gi>
                    <n-space vertical>
                        <span>风扇2 开关</span>
                        <n-input v-model:value="config.fan2Switch" placeholder="gpuTemp > 40" />
                    </n-space>
                </n-gi>
                <n-gi>
                    <n-space vertical>
                        <span>风扇2 转速</span>
                        <n-input
                            v-model:value="config.fan2Pwm"
                            placeholder="Math.min(255, Math.max(0, (gpuTemp - 40) * 8))"
                        />
                    </n-space>
                </n-gi>
            </n-grid>

            <!-- 风扇3 -->
            <n-grid :cols="2" :x-gap="16">
                <n-gi>
                    <n-space vertical>
                        <span>风扇3 开关</span>
                        <n-input v-model:value="config.fan3Switch" placeholder="caseTemp > 35" />
                    </n-space>
                </n-gi>
                <n-gi>
                    <n-space vertical>
                        <span>风扇3 转速</span>
                        <n-input
                            v-model:value="config.fan3Pwm"
                            placeholder="Math.min(255, Math.max(0, (caseTemp - 35) * 10))"
                        />
                    </n-space>
                </n-gi>
            </n-grid>

            <!-- 测试区域 -->
            <n-space align="center">
                <span>测试温度:</span>
                <n-input-number v-model:value="testCpu" :min="-20" :max="120" size="small">
                    <template #prefix>CPU</template>
                </n-input-number>
                <n-input-number v-model:value="testCase" :min="-20" :max="120" size="small">
                    <template #prefix>机箱</template>
                </n-input-number>
                <n-button :loading="testing" @click="handleTest">测试</n-button>
                <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
            </n-space>

            <!-- 测试结果 -->
            <n-data-table
                v-if="testResults"
                :columns="testColumns"
                :data="testTableData"
                :bordered="false"
                size="small"
            />
        </n-space>
    </n-card>
</template>

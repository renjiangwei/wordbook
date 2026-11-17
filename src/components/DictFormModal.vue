<script setup lang="ts">
import { onMounted, ref } from "vue";
import { addDict, renameDict } from "../store";
import type { Dictionary } from "../types";

const props = defineProps<{ dict: Dictionary | null }>();
const emit = defineEmits<{ close: [] }>();

const name = ref(props.dict?.name ?? "");
const input = ref<HTMLInputElement | null>(null);
onMounted(() => input.value?.focus());

function valid(): boolean {
  return name.value.trim() !== "";
}

function submit() {
  if (!valid()) return;
  if (props.dict) renameDict(props.dict.id, name.value);
  else addDict(name.value);
  emit("close");
}
</script>

<template>
  <div class="modal-mask">
    <div class="modal dict-modal">
      <h2>{{ props.dict ? "重命名词库" : "新建词库" }}</h2>
      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">名称 *</span>
          <input
            ref="input"
            v-model="name"
            placeholder="例如：CET-6、雅思核心词"
            maxlength="30"
          />
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" @click="emit('close')">取消</button>
          <button type="submit" class="btn primary" :disabled="!valid()">
            保存
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

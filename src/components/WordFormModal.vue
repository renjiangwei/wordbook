<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { addWord, updateWord } from "../store";
import type { WordEntry } from "../types";

const props = defineProps<{ entry: WordEntry | null }>();
const emit = defineEmits<{ close: [] }>();

const form = reactive({
  name: props.entry?.name ?? "",
  trans: props.entry ? props.entry.trans.join("；") : "",
  usphone: props.entry?.usphone ?? "",
  ukphone: props.entry?.ukphone ?? "",
  note: props.entry?.note ?? "",
});

const nameInput = ref<HTMLInputElement | null>(null);
onMounted(() => nameInput.value?.focus());

function splitTrans(raw: string): string[] {
  return raw
    .split(/[；;，,、\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function valid(): boolean {
  return form.name.trim() !== "" && splitTrans(form.trans).length > 0;
}

function submit() {
  if (!valid()) return;
  const draft = {
    name: form.name.trim(),
    trans: splitTrans(form.trans),
    usphone: form.usphone.trim(),
    ukphone: form.ukphone.trim(),
    note: form.note.trim(),
  };
  if (props.entry) updateWord(props.entry.id, draft);
  else addWord(draft);
  emit("close");
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h2>{{ props.entry ? "编辑单词" : "添加单词" }}</h2>
      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">英文 *</span>
          <input ref="nameInput" v-model="form.name" placeholder="例如：massage" />
        </label>
        <label class="field">
          <span class="field-label">中文释义 *</span>
          <input v-model="form.trans" placeholder="多条释义用 ； 分隔，例如：按摩；揉捏" />
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field-label">美式音标</span>
            <input v-model="form.usphone" placeholder="mə'sɑʒ" />
          </label>
          <label class="field">
            <span class="field-label">英式音标</span>
            <input v-model="form.ukphone" placeholder="'mæsɑːʒ" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">备注 / 例句</span>
          <textarea
            v-model="form.note"
            rows="3"
            placeholder="示例句子或记忆笔记（可选）"
          ></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" @click="emit('close')">取消</button>
          <button type="submit" class="btn primary" :disabled="!valid()">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>

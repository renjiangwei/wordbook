<script setup lang="ts">
import { ref } from "vue";
import { ask, save } from "@tauri-apps/plugin-dialog";
import { exportBook } from "./api";
import DictFormModal from "./components/DictFormModal.vue";
import FlashcardView from "./components/FlashcardView.vue";
import WordListView from "./components/WordListView.vue";
import {
  dictWordCount,
  dictWords,
  moveDict,
  removeDict,
  setActiveDict,
  store,
  toast,
} from "./store";
import type { Dictionary } from "./types";

type Tab = "list" | "random" | "sequential";
const tab = ref<Tab>("list");

// ---- 词库管理 ----

const showDictForm = ref(false);
const editingDict = ref<Dictionary | null>(null);
const draggedDictId = ref<string | null>(null);
const dictDropTarget = ref<{ id: string; after: boolean } | null>(null);

function startDictDrag(event: DragEvent, id: string) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-wordbook-dict", id);
  draggedDictId.value = id;
}

function isAfterDict(event: DragEvent) {
  const row = event.currentTarget as HTMLElement;
  const bounds = row.getBoundingClientRect();
  return event.clientY >= bounds.top + bounds.height / 2;
}

function dragOverDict(event: DragEvent, id: string) {
  if (!draggedDictId.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  dictDropTarget.value = draggedDictId.value === id
    ? null
    : { id, after: isAfterDict(event) };
}

function dragLeaveDict(event: DragEvent, id: string) {
  const row = event.currentTarget as HTMLElement;
  if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
  if (dictDropTarget.value?.id === id) dictDropTarget.value = null;
}

function endDictDrag() {
  draggedDictId.value = null;
  dictDropTarget.value = null;
}

function dropDict(event: DragEvent, targetId: string) {
  const id = draggedDictId.value;
  if (!id) return;
  event.preventDefault();
  moveDict(id, targetId, isAfterDict(event));
  endDictDrag();
}

function openCreateDict() {
  editingDict.value = null;
  showDictForm.value = true;
}

function openRenameDict(d: Dictionary) {
  editingDict.value = d;
  showDictForm.value = true;
}

async function doDeleteDict(d: Dictionary) {
  const count = dictWordCount(d.id);
  const ok = await ask(
    count > 0
      ? `确定要删除词库「${d.name}」吗？其中的 ${count} 个单词也会一并删除。`
      : `确定要删除词库「${d.name}」吗？`,
    { title: "删除词库", kind: "warning" },
  );
  if (ok) {
    removeDict(d.id);
    toast("已删除词库");
  }
}

// ---- 备份 ----

async function doBackup() {
  if (store.words.length === 0) {
    toast("还没有任何单词");
    return;
  }
  const path = await save({
    defaultPath: "单词本备份.json",
    filters: [{ name: "JSON 词库备份", extensions: ["json"] }],
  });
  if (!path) return;
  try {
    await exportBook(path, store.dicts, store.words);
    toast("备份成功，包含全部词库及分组");
  } catch (e) {
    toast("备份失败: " + String(e));
  }
}
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">📖</span>
        <h1>单词本</h1>
      </div>

      <div class="section-label">词库</div>
      <div class="dict-list">
        <div
          v-for="d in store.dicts"
          :key="d.id"
          class="dict-item"
          :class="{
            active: d.id === store.activeDictId,
            dragging: d.id === draggedDictId,
            'drop-before': dictDropTarget?.id === d.id && !dictDropTarget.after,
            'drop-after': dictDropTarget?.id === d.id && dictDropTarget.after,
          }"
          :title="d.name"
          @click="setActiveDict(d.id)"
          @dragover="dragOverDict($event, d.id)"
          @dragleave="dragLeaveDict($event, d.id)"
          @drop="dropDict($event, d.id)"
        >
          <span
            class="dict-name"
            :draggable="store.dicts.length > 1"
            @dragstart="startDictDrag($event, d.id)"
            @dragend="endDictDrag"
          >{{ d.name }}</span>
          <span class="dict-count">{{ dictWordCount(d.id) }}</span>
          <span class="dict-ops">
            <button
              class="dict-op"
              title="重命名"
              @click.stop="openRenameDict(d)"
            >
              ✎
            </button>
            <button
              class="dict-op danger"
              title="删除"
              @click.stop="doDeleteDict(d)"
            >
              ✕
            </button>
          </span>
        </div>
      </div>
      <button class="dict-add" @click="openCreateDict">＋ 新建词库</button>

      <nav class="nav">
        <button :class="{ active: tab === 'list' }" @click="tab = 'list'">
          📚 单词本
        </button>
        <button :class="{ active: tab === 'random' }" @click="tab = 'random'">
          🎲 随机循环
        </button>
        <button :class="{ active: tab === 'sequential' }" @click="tab = 'sequential'">
          🔁 顺序循环
        </button>
      </nav>

      <div class="sidebar-footer">
        <span>共 {{ dictWords.length }} 个单词</span>
        <button class="link-btn" @click="doBackup">备份全部</button>
      </div>
    </aside>

    <main class="content">
      <WordListView v-if="tab === 'list'" />
      <FlashcardView v-else :key="tab" :order="tab" />
    </main>

    <DictFormModal
      v-if="showDictForm"
      :dict="editingDict"
      @close="showDictForm = false"
    />

    <transition name="toast">
      <div v-if="store.toast" class="toast">{{ store.toast }}</div>
    </transition>
  </div>
</template>

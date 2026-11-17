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
  removeDict,
  setActiveDict,
  store,
  toast,
} from "./store";
import type { Dictionary } from "./types";

type Tab = "list" | "cards";
const tab = ref<Tab>("list");

// ---- 词库管理 ----

const showDictForm = ref(false);
const editingDict = ref<Dictionary | null>(null);

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
          :class="{ active: d.id === store.activeDictId }"
          :title="d.name"
          @click="setActiveDict(d.id)"
        >
          <span class="dict-name">{{ d.name }}</span>
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
        <button :class="{ active: tab === 'cards' }" @click="tab = 'cards'">
          🎲 随机循环
        </button>
      </nav>

      <div class="sidebar-footer">
        <span>共 {{ dictWords.length }} 个单词</span>
        <button class="link-btn" @click="doBackup">备份全部</button>
      </div>
    </aside>

    <main class="content">
      <WordListView v-if="tab === 'list'" />
      <FlashcardView v-else />
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

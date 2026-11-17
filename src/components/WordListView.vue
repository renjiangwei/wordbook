<script setup lang="ts">
import { ref } from "vue";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { exportWords, importWords } from "../api";
import {
  activeDict,
  dictWords,
  filteredWords,
  formatTrans,
  importBook,
  importEntries,
  masteredCount,
  removeWord,
  setMastered,
  store,
  toast,
} from "../store";
import type { WordEntry } from "../types";
import WordFormModal from "./WordFormModal.vue";

const showForm = ref(false);
const editing = ref<WordEntry | null>(null);

function openAdd() {
  editing.value = null;
  showForm.value = true;
}

function openEdit(w: WordEntry) {
  editing.value = w;
  showForm.value = true;
}

async function doDelete(w: WordEntry) {
  const ok = await ask(`确定要删除「${w.name}」吗？`, {
    title: "删除单词",
    kind: "warning",
  });
  if (ok) {
    removeWord(w.id);
    toast("已删除");
  }
}

async function doImport() {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "JSON 词库", extensions: ["json"] }],
  });
  if (!path) return;
  try {
    const book = await importWords(path as string);
    // 文件里带词库结构时按词库合并，否则导入当前词库
    if (book.dicts && book.dicts.length > 0) {
      await importBook(book);
    } else {
      await importEntries(book.words ?? []);
    }
  } catch (e) {
    toast("导入失败: " + String(e));
  }
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "词库";
}

async function doExport() {
  const dict = activeDict.value;
  if (!dict) return;
  if (dictWords.value.length === 0) {
    toast(`词库「${dict.name}」还是空的，先添加或导入一些单词吧`);
    return;
  }
  const path = await save({
    defaultPath: safeFileName(dict.name) + ".json",
    filters: [{ name: "JSON 词库", extensions: ["json"] }],
  });
  if (!path) return;
  try {
    await exportWords(path, dictWords.value);
    toast("导出成功");
  } catch (e) {
    toast("导出失败: " + String(e));
  }
}
</script>

<template>
  <section class="view">
    <header class="view-head">
      <div>
        <h2>{{ activeDict?.name ?? "单词本" }}</h2>
        <p class="muted">
          共 {{ dictWords.length }} 个单词，已掌握 {{ masteredCount }}
        </p>
      </div>
      <div class="head-actions">
        <button class="btn" @click="doImport">导入</button>
        <button class="btn" @click="doExport">导出</button>
        <button class="btn primary" @click="openAdd">＋ 添加单词</button>
      </div>
    </header>

    <input
      v-model="store.query"
      class="search"
      placeholder="搜索单词、释义、备注或音标…"
    />

    <div class="word-list">
      <p v-if="dictWords.length === 0" class="empty">
        「{{ activeDict?.name }}」还没有单词。<br />
        点击右上角「添加单词」手动记录，或「导入」你已有的 JSON 词库文件。
      </p>
      <p v-else-if="filteredWords.length === 0" class="empty">
        没有匹配「{{ store.query }}」的单词。
      </p>

      <article
        v-for="w in filteredWords"
        :key="w.id"
        class="word-card"
        :class="{ mastered: w.mastered }"
      >
        <div class="word-main">
          <div class="word-title">
            <span class="word-name">{{ w.name }}</span>
            <span v-if="w.usphone" class="phone">美 {{ w.usphone }}</span>
            <span v-if="w.ukphone" class="phone">英 {{ w.ukphone }}</span>
            <span v-if="w.mastered" class="badge">已掌握</span>
          </div>
          <div class="word-trans">{{ formatTrans(w) }}</div>
          <div v-if="w.note" class="word-note">{{ w.note }}</div>
        </div>
        <div class="word-actions">
          <button class="btn small" @click="setMastered(w.id, !w.mastered)">
            {{ w.mastered ? "取消掌握" : "标记掌握" }}
          </button>
          <button class="btn small" @click="openEdit(w)">编辑</button>
          <button class="btn small danger" @click="doDelete(w)">删除</button>
        </div>
      </article>
    </div>

    <WordFormModal v-if="showForm" :entry="editing" @close="showForm = false" />
  </section>
</template>

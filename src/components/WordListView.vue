<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { exportWords, importWords } from "../api";
import {
  activeDict,
  dictWords,
  filteredWords,
  formatTrans,
  importBook,
  importEntries,
  pagedWords,
  removeWord,
  setDisplayMode,
  setFilter,
  setMastered,
  setSort,
  setView,
  setWordPage,
  statusCounts,
  store,
  toast,
  wordPage,
  wordPageCount,
} from "../store";
import type { SortMode, StatusFilter, WordDisplayMode, WordEntry } from "../types";
import WordFormModal from "./WordFormModal.vue";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "unmastered", label: "未掌握" },
  { value: "mastered", label: "已掌握" },
];

const showForm = ref(false);
const editing = ref<WordEntry | null>(null);
/** 紧凑列表中展开的单词 id */
const expandedId = ref<string | null>(null);
const wordList = ref<HTMLElement | null>(null);
const showEnglish = computed(() => store.displayMode !== "zh");
const showChinese = computed(() => store.displayMode !== "en");

watch(
  [
    () => store.activeDictId,
    () => store.query,
    () => store.filter,
    () => store.sort,
    () => store.view,
    wordPage,
  ],
  () => {
    expandedId.value = null;
    if (wordList.value) wordList.value.scrollTop = 0;
  },
);

function openAdd() {
  editing.value = null;
  showForm.value = true;
}

function openEdit(w: WordEntry) {
  editing.value = w;
  showForm.value = true;
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function onSortChange(e: Event) {
  setSort((e.target as HTMLSelectElement).value as SortMode);
}

function onDisplayModeChange(event: Event) {
  setDisplayMode((event.currentTarget as HTMLSelectElement).value as WordDisplayMode);
}

function onPageChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  setWordPage(input.valueAsNumber);
  input.value = String(wordPage.value);
}

function statusCount(f: StatusFilter): number {
  return f === "all" ? statusCounts.value.all : statusCounts.value[f];
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
          共 {{ dictWords.length }} 个单词，已掌握 {{ statusCounts.mastered }}
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

    <div class="list-toolbar">
      <div class="chips">
        <button
          v-for="f in FILTERS"
          :key="f.value"
          class="chip"
          :class="{ active: store.filter === f.value }"
          @click="setFilter(f.value)"
        >
          <span v-if="f.value !== 'all'" class="chip-dot" :class="f.value"></span>
          {{ f.label }}
          <span class="chip-n">{{ statusCount(f.value) }}</span>
        </button>
      </div>
      <div class="toolbar-right">
        <select
          class="toolbar-select"
          :value="store.displayMode"
          aria-label="显示语言"
          @change="onDisplayModeChange"
        >
          <option value="zh">仅显示中文</option>
          <option value="en">仅显示英文</option>
          <option value="both">中英都显示</option>
        </select>
        <select
          class="toolbar-select"
          :value="store.sort"
          title="排序方式"
          @change="onSortChange"
        >
          <option value="time">按时间（新→旧）</option>
          <option value="alpha">按字母 A→Z</option>
        </select>
        <div class="segmented" title="视图">
          <button
            :class="{ active: store.view === 'card' }"
            @click="setView('card')"
          >
            卡片
          </button>
          <button
            :class="{ active: store.view === 'compact' }"
            @click="setView('compact')"
          >
            列表
          </button>
        </div>
      </div>
    </div>

    <div ref="wordList" class="word-list" :class="{ compact: store.view === 'compact' }">
      <p v-if="dictWords.length === 0" class="empty">
        「{{ activeDict?.name }}」还没有单词。<br />
        点击右上角「添加单词」手动记录，或「导入」你已有的 JSON 词库文件。
      </p>
      <p v-else-if="filteredWords.length === 0" class="empty">
        <template v-if="store.query">没有匹配「{{ store.query }}」的单词。</template>
        <template v-else>
          当前筛选「{{ FILTERS.find((f) => f.value === store.filter)?.label }}」下没有单词。
        </template>
      </p>

      <!-- 卡片视图 -->
      <template v-if="store.view === 'card'">
        <article
          v-for="w in pagedWords"
          :key="w.id"
          class="word-card"
          :class="{ mastered: w.mastered }"
        >
          <div class="word-main">
            <div v-if="showEnglish || w.mastered" class="word-title">
              <template v-if="showEnglish">
                <span class="word-name">{{ w.name || "暂无英文" }}</span>
                <span v-if="w.usphone" class="phone">美 {{ w.usphone }}</span>
                <span v-if="w.ukphone" class="phone">英 {{ w.ukphone }}</span>
              </template>
              <span v-if="w.mastered" class="badge">已掌握</span>
            </div>
            <div v-if="showChinese" class="word-trans">
              {{ formatTrans(w) || "暂无中文释义" }}
            </div>
            <div v-if="store.displayMode === 'both' && w.note" class="word-note">
              {{ w.note }}
            </div>
          </div>
          <div class="word-actions">
            <button class="btn small" @click="setMastered(w.id, !w.mastered)">
              {{ w.mastered ? "取消掌握" : "标记掌握" }}
            </button>
            <button class="btn small" @click="openEdit(w)">编辑</button>
            <button class="btn small danger" @click="doDelete(w)">删除</button>
          </div>
        </article>
      </template>

      <!-- 紧凑列表视图：点击行展开详情和操作 -->
      <template v-else>
        <div
          v-for="w in pagedWords"
          :key="w.id"
          class="word-item"
          :class="{ open: expandedId === w.id, mastered: w.mastered }"
        >
          <div class="word-row" @click="toggleExpand(w.id)">
            <span
              class="s-dot"
              :class="{ mastered: w.mastered }"
              :title="w.mastered ? '已掌握' : '未掌握'"
            ></span>
            <span v-if="showEnglish" class="row-name">{{ w.name || "暂无英文" }}</span>
            <span v-if="showEnglish && w.usphone" class="row-phone">美 {{ w.usphone }}</span>
            <span v-if="showChinese" class="row-trans">
              {{ formatTrans(w) || "暂无中文释义" }}
            </span>
            <span class="row-chev">{{ expandedId === w.id ? "▾" : "▸" }}</span>
          </div>
          <div v-if="expandedId === w.id" class="row-detail">
            <div v-if="showEnglish && w.ukphone" class="detail-extra">英 {{ w.ukphone }}</div>
            <div v-if="showChinese" class="detail-trans">
              {{ formatTrans(w) || "暂无中文释义" }}
            </div>
            <div v-if="store.displayMode === 'both' && w.note" class="detail-note">
              {{ w.note }}
            </div>
            <div class="row-actions">
              <button class="btn small" @click="setMastered(w.id, !w.mastered)">
                {{ w.mastered ? "取消掌握" : "标记掌握" }}
              </button>
              <button class="btn small" @click="openEdit(w)">编辑</button>
              <button class="btn small danger" @click="doDelete(w)">删除</button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <nav v-if="wordPageCount > 1" class="pagination" aria-label="单词分页">
      <button
        class="btn small"
        :disabled="wordPage <= 1"
        @click="setWordPage(wordPage - 1)"
      >
        上一页
      </button>
      <label class="page-number">
        第
        <input
          type="number"
          min="1"
          :max="wordPageCount"
          :value="wordPage"
          aria-label="跳转页码"
          @change="onPageChange"
          @keydown.enter.prevent="onPageChange"
        />
        页 / 共 {{ wordPageCount }} 页
      </label>
      <button
        class="btn small"
        :disabled="wordPage >= wordPageCount"
        @click="setWordPage(wordPage + 1)"
      >
        下一页
      </button>
    </nav>

    <WordFormModal v-if="showForm" :entry="editing" @close="showForm = false" />
  </section>
</template>

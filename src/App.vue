<script setup lang="ts">
import { ref } from "vue";
import FlashcardView from "./components/FlashcardView.vue";
import WordListView from "./components/WordListView.vue";
import { store } from "./store";

type Tab = "list" | "cards";
const tab = ref<Tab>("list");
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">📖</span>
        <h1>单词本</h1>
      </div>
      <nav class="nav">
        <button :class="{ active: tab === 'list' }" @click="tab = 'list'">
          📚 单词本
        </button>
        <button :class="{ active: tab === 'cards' }" @click="tab = 'cards'">
          🎲 随机循环
        </button>
      </nav>
      <div class="sidebar-footer">
        共 {{ store.words.length }} 个单词
      </div>
    </aside>

    <main class="content">
      <WordListView v-if="tab === 'list'" />
      <FlashcardView v-else />
    </main>

    <transition name="toast">
      <div v-if="store.toast" class="toast">{{ store.toast }}</div>
    </transition>
  </div>
</template>

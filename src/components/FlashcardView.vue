<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { activeDict, dictWords, setMastered, store } from "../store";
import type { WordEntry } from "../types";

type Mode = "en2cn" | "cn2en" | "both";

const mode = ref<Mode>("en2cn");
const onlyUnmastered = ref(false);
const deck = ref<WordEntry[]>([]);
const idx = ref(0);
const revealed = ref(false);
const round = ref(1);

const pool = computed(() =>
  onlyUnmastered.value
    ? dictWords.value.filter((w) => !w.mastered)
    : dictWords.value,
);

const current = computed<WordEntry | null>(() => deck.value[idx.value] ?? null);
/** 中英同显模式下没有「翻开」的概念，直接全显示 */
const flipped = computed(() => mode.value === "both" || revealed.value);
const noWords = computed(() => dictWords.value.length === 0);
const allMastered = computed(
  () =>
    onlyUnmastered.value && pool.value.length === 0 && dictWords.value.length > 0,
);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rebuild() {
  deck.value = shuffle(pool.value);
  idx.value = 0;
  revealed.value = false;
  round.value = 1;
}

function setMode(m: Mode) {
  mode.value = m;
  revealed.value = false;
}

function toggleFlip() {
  if (mode.value === "both") return;
  revealed.value = !revealed.value;
}

function next() {
  if (deck.value.length === 0) return;
  revealed.value = false;
  if (idx.value + 1 >= deck.value.length) {
    // 到末尾后重新打乱，进入下一轮循环
    deck.value = shuffle(pool.value);
    idx.value = 0;
    round.value++;
  } else {
    idx.value++;
  }
}

function prev() {
  if (deck.value.length === 0) return;
  revealed.value = false;
  if (idx.value === 0) {
    idx.value = deck.value.length - 1;
  } else {
    idx.value--;
  }
}

/** 「仅未掌握」模式下，已掌握的单词直接移出卡组 */
function pruneDeck(id: string) {
  deck.value = deck.value.filter((x) => x.id !== id);
  if (idx.value >= deck.value.length) idx.value = 0;
  revealed.value = false;
}

function markCurrentMastered() {
  const w = current.value;
  if (!w) return;
  setMastered(w.id, true);
  if (onlyUnmastered.value) pruneDeck(w.id);
}

// ---- 默写（中 → 英模式） ----

const spellInput = ref<HTMLInputElement | null>(null);
const spelling = ref("");
const spellState = ref<"idle" | "correct" | "wrong">("idle");
let spellTimer: number | undefined;

function resetSpell() {
  window.clearTimeout(spellTimer);
  spelling.value = "";
  spellState.value = "idle";
}

function normalizeSpell(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 默写结果回写学情：答对标记已掌握，答错退回未掌握；
 * 「仅未掌握」模式下答对后直接移出卡组。
 */
function recordSpellResult(ok: boolean) {
  const w = current.value;
  if (!w) return;
  setMastered(w.id, ok);
  if (ok && onlyUnmastered.value) pruneDeck(w.id);
}

function submitSpell() {
  if (!current.value) return;
  if (spellState.value === "correct") return; // 正在等待自动切换下一个
  const ok =
    normalizeSpell(spelling.value) === normalizeSpell(current.value.name);
  recordSpellResult(ok);
  window.clearTimeout(spellTimer);
  if (ok) {
    // 答对：绿框示意一下，然后自动进入下一个单词
    spellState.value = "correct";
    spellTimer = window.setTimeout(() => {
      spelling.value = "";
      spellState.value = "idle";
      next();
    }, 450);
  } else {
    // 答错：抖动示意并清空，留在当前单词
    spelling.value = "";
    spellState.value = "wrong";
    spellTimer = window.setTimeout(() => {
      spellState.value = "idle";
    }, 600);
  }
  spellInput.value?.focus();
}

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  // 正在输入框打字时不响应全局快捷键（空格 / 方向键 / M）
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  ) {
    return;
  }
  if (!current.value) return;
  if (e.code === "Space") {
    e.preventDefault();
    toggleFlip();
  } else if (e.code === "ArrowRight") {
    next();
  } else if (e.code === "ArrowLeft") {
    prev();
  } else if (e.code === "KeyM") {
    markCurrentMastered();
  }
}

onMounted(() => {
  if (store.ready) rebuild();
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

// 词库在组件挂载后才加载完成时，重新构建卡组
watch(
  () => store.ready,
  (ready) => {
    if (ready) rebuild();
  },
);

// 切换「仅未掌握」时重建卡组
watch(onlyUnmastered, rebuild);

// 切换词库时重建卡组
watch(
  () => store.activeDictId,
  () => {
    if (store.ready) rebuild();
  },
);

// 换词后清空默写输入和状态
watch(
  () => current.value?.id,
  () => resetSpell(),
);

// 切换模式时清空拼写输入，并聚焦输入框方便继续打字
watch(mode, () => {
  resetSpell();
  nextTick(() => spellInput.value?.focus());
});
</script>

<template>
  <section class="view">
    <header class="view-head">
      <div>
        <h2>随机循环</h2>
        <p class="muted">
          空格 翻转 · ← → 切换单词 · M 标记掌握 · 回车 检查拼写
        </p>
      </div>
      <div class="fc-toolbar">
        <div class="segmented">
          <button :class="{ active: mode === 'en2cn' }" @click="setMode('en2cn')">
            英 → 中
          </button>
          <button :class="{ active: mode === 'cn2en' }" @click="setMode('cn2en')">
            中 → 英
          </button>
          <button :class="{ active: mode === 'both' }" @click="setMode('both')">
            中英同显
          </button>
        </div>
        <label class="check">
          <input v-model="onlyUnmastered" type="checkbox" />
          仅未掌握
        </label>
      </div>
    </header>

    <!-- 当前词库为空 -->
    <div v-if="noWords" class="card-area">
      <p class="empty">
        词库「{{ activeDict?.name }}」还是空的，先去「单词本」添加或导入一些单词吧。
      </p>
    </div>

    <!-- 仅未掌握模式下全部掌握 -->
    <div v-else-if="allMastered" class="card-area">
      <div class="flashcard static">
        <div class="fc-word">🎉</div>
        <div class="fc-trans">全部掌握！</div>
        <div class="fc-hint">取消勾选「仅未掌握」可以复习全部单词</div>
      </div>
    </div>

    <template v-else-if="current">
      <div class="card-area">
        <div class="fc-status">
          {{ activeDict?.name }} · 第 {{ round }} 轮 · {{ idx + 1 }} /
          {{ deck.length }} · {{ current.mastered ? "已掌握" : "未掌握" }}
          <template v-if="onlyUnmastered">（仅未掌握）</template>
        </div>

        <div class="flashcard" :class="{ flippable: mode !== 'both' }" @click="toggleFlip">
          <!-- 正面：英 → 中 -->
          <template v-if="!flipped && mode === 'en2cn'">
            <div class="fc-word">{{ current.name }}</div>
            <div v-if="current.usphone || current.ukphone" class="fc-phones">
              <span v-if="current.usphone">美 {{ current.usphone }}</span>
              <span v-if="current.ukphone">英 {{ current.ukphone }}</span>
            </div>
            <div class="fc-hint">点击卡片或按 空格 查看中文释义和备注</div>
          </template>

          <!-- 正面：中 → 英 -->
          <template v-else-if="!flipped && mode === 'cn2en'">
            <div class="fc-word">{{ current.trans.join("；") }}</div>
            <div class="fc-hint">点击卡片或按 空格 查看英文单词和备注</div>
          </template>

          <!-- 背面（显示答案）/ 中英同显：中英 + 音标 + 备注同时显示 -->
          <template v-else>
            <div v-if="mode === 'en2cn'" class="fc-word small">{{ current.name }}</div>
            <div v-else-if="mode === 'cn2en'" class="fc-word small">
              {{ current.trans.join("；") }}
            </div>
            <div class="fc-word">{{ current.name }}</div>
            <div v-if="current.usphone || current.ukphone" class="fc-phones">
              <span v-if="current.usphone">美 {{ current.usphone }}</span>
              <span v-if="current.ukphone">英 {{ current.ukphone }}</span>
            </div>
            <div class="fc-trans">{{ current.trans.join("；") }}</div>
            <div v-if="current.note" class="fc-note">{{ current.note }}</div>
          </template>
        </div>

        <!-- 拼写输入框：所有模式可用，答对自动下一个 -->
        <input
          ref="spellInput"
          v-model="spelling"
          class="spell-input"
          :class="{
            correct: spellState === 'correct',
            wrong: spellState === 'wrong',
          }"
          placeholder="输入英文单词，回车检查（答对自动下一个）"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @keydown.enter.prevent="submitSpell"
        />

        <div class="fc-progress">
          <div class="fc-progress-bar">
            <div
              class="fc-progress-fill"
              :style="{ width: ((idx + 1) / deck.length) * 100 + '%' }"
            ></div>
          </div>
        </div>

        <div class="fc-controls">
          <button class="btn" @click="prev">← 上一个</button>
          <button
            class="btn primary"
            :disabled="mode === 'both'"
            @click="toggleFlip"
          >
            {{ flipped ? "隐藏答案" : "显示答案" }}
          </button>
          <button class="btn" @click="next">下一个 →</button>
          <button class="btn" @click="markCurrentMastered">标记掌握 (M)</button>
        </div>
      </div>
    </template>
  </section>
</template>

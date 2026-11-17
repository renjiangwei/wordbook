import { computed, reactive } from "vue";
import { loadWords, saveWords } from "./api";
import type { WordDraft, WordEntry } from "./types";

export const store = reactive({
  ready: false,
  words: [] as WordEntry[],
  query: "",
  toast: "",
});

export const filteredWords = computed(() => {
  const q = store.query.trim().toLowerCase();
  if (!q) return store.words;
  return store.words.filter(
    (w) =>
      w.name.toLowerCase().includes(q) ||
      w.trans.some((t) => t.toLowerCase().includes(q)) ||
      w.note.toLowerCase().includes(q) ||
      w.usphone.toLowerCase().includes(q) ||
      w.ukphone.toLowerCase().includes(q),
  );
});

export const masteredCount = computed(
  () => store.words.filter((w) => w.mastered).length,
);

// ---- 提示条 ----

let toastTimer: number | undefined;
export function toast(text: string) {
  store.toast = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (store.toast = ""), 2600);
}

// ---- 持久化 ----

let saveTimer: number | undefined;
function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveWords(store.words).catch((e) => toast("保存失败: " + String(e)));
  }, 200);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "w-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/** 用于判重的键：单词 + 全部释义 */
function entryKey(w: { name: string; trans: string[] }): string {
  return w.name + "\u0000" + w.trans.join("\u0001");
}

/** 补全缺失字段、生成 id、过滤完全空的条目 */
function normalize(words: Array<Partial<WordEntry>>): WordEntry[] {
  return words
    .filter((w) => (w.name ?? "").trim() !== "" || (w.trans ?? []).length > 0)
    .map((w) => ({
      id: w.id || uuid(),
      name: (w.name ?? "").trim(),
      trans: (w.trans ?? []).map((t) => t.trim()).filter(Boolean),
      usphone: (w.usphone ?? "").trim(),
      ukphone: (w.ukphone ?? "").trim(),
      note: (w.note ?? "").trim(),
      mastered: w.mastered ?? false,
      created_at: w.created_at || nowSec(),
      updated_at: w.updated_at || nowSec(),
    }));
}

export async function initStore() {
  try {
    const book = await loadWords();
    store.words = normalize(book.words);
  } catch (e) {
    toast("读取词库失败: " + String(e));
  }
  store.ready = true;
}

// ---- 增删改 ----

export function addWord(draft: WordDraft) {
  const ts = nowSec();
  store.words.unshift({
    id: uuid(),
    ...draft,
    mastered: false,
    created_at: ts,
    updated_at: ts,
  });
  persist();
}

export function updateWord(id: string, draft: WordDraft) {
  const w = store.words.find((x) => x.id === id);
  if (!w) return;
  Object.assign(w, draft, { updated_at: nowSec() });
  persist();
}

export function removeWord(id: string) {
  const i = store.words.findIndex((x) => x.id === id);
  if (i >= 0) {
    store.words.splice(i, 1);
    persist();
  }
}

export function setMastered(id: string, val: boolean) {
  const w = store.words.find((x) => x.id === id);
  if (!w || w.mastered === val) return;
  w.mastered = val;
  w.updated_at = nowSec();
  persist();
}

/** 导入条目并按「单词+释义」去重 */
export async function importEntries(incoming: Array<Partial<WordEntry>>) {
  const list = normalize(incoming);
  const seen = new Set(store.words.map(entryKey));
  const fresh: WordEntry[] = [];
  let skipped = 0;
  for (const w of list) {
    const key = entryKey(w);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    fresh.push(w);
  }
  if (fresh.length) {
    store.words = [...fresh, ...store.words];
    persist();
  }
  const skippedText = skipped ? `，跳过重复 ${skipped} 条` : "";
  toast(
    fresh.length
      ? `导入 ${fresh.length} 条${skippedText}`
      : `没有新的单词可导入${skipped ? `（跳过重复 ${skipped} 条）` : ""}`,
  );
}

export function formatTrans(w: WordEntry): string {
  return w.trans.join("；");
}

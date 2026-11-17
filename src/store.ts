import { computed, reactive } from "vue";
import { loadWords, saveWords } from "./api";
import type { Dictionary, WordDraft, WordEntry } from "./types";

export const store = reactive({
  ready: false,
  dicts: [] as Dictionary[],
  words: [] as WordEntry[],
  activeDictId: "",
  query: "",
  toast: "",
});

export const activeDict = computed(
  () => store.dicts.find((d) => d.id === store.activeDictId) ?? null,
);

/** 当前词库下的全部单词 */
export const dictWords = computed(() =>
  store.words.filter((w) => w.dictId === store.activeDictId),
);

export const filteredWords = computed(() => {
  const q = store.query.trim().toLowerCase();
  if (!q) return dictWords.value;
  return dictWords.value.filter(
    (w) =>
      w.name.toLowerCase().includes(q) ||
      w.trans.some((t) => t.toLowerCase().includes(q)) ||
      w.note.toLowerCase().includes(q) ||
      w.usphone.toLowerCase().includes(q) ||
      w.ukphone.toLowerCase().includes(q),
  );
});

export const masteredCount = computed(
  () => dictWords.value.filter((w) => w.mastered).length,
);

export function dictWordCount(dictId: string): number {
  let n = 0;
  for (const w of store.words) if (w.dictId === dictId) n++;
  return n;
}

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
    saveWords(store.dicts, store.words).catch((e) =>
      toast("保存失败: " + String(e)),
    );
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
      dictId: w.dictId || "",
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

/** 补全词库元信息（名称为空时给占位名） */
function normalizeDicts(dicts: Array<Partial<Dictionary>>): Dictionary[] {
  return dicts.map((d) => ({
    id: d.id || uuid(),
    name: (d.name ?? "").trim() || "未命名词库",
    created_at: d.created_at || nowSec(),
  }));
}

const ACTIVE_DICT_KEY = "wordbook.activeDictId";

export async function initStore() {
  try {
    const book = await loadWords();
    store.dicts = normalizeDicts(book.dicts ?? []);
    const words = normalize(book.words ?? []);
    if (store.dicts.length === 0) {
      // 旧版本数据没有词库分组：建一个默认词库承接全部单词
      const def: Dictionary = {
        id: uuid(),
        name: "我的词库",
        created_at: nowSec(),
      };
      store.dicts = [def];
      store.words = words.map((w) => ({ ...w, dictId: def.id }));
      persist();
    } else {
      // 把指向已不存在词库的单词归入第一个词库
      const known = new Set(store.dicts.map((d) => d.id));
      const fallback = store.dicts[0].id;
      store.words = words.map((w) =>
        known.has(w.dictId) ? w : { ...w, dictId: fallback },
      );
    }
  } catch (e) {
    toast("读取词库失败: " + String(e));
    // 读取失败也要保证应用可用：给一个空词库
    if (store.dicts.length === 0) {
      store.dicts = [
        { id: uuid(), name: "我的词库", created_at: nowSec() },
      ];
    }
  }
  // 恢复上次选中的词库
  const saved = localStorage.getItem(ACTIVE_DICT_KEY);
  store.activeDictId =
    saved && store.dicts.some((d) => d.id === saved)
      ? saved
      : store.dicts[0].id;
  localStorage.setItem(ACTIVE_DICT_KEY, store.activeDictId);
  store.ready = true;
}

// ---- 词库管理 ----

export function setActiveDict(id: string) {
  if (store.activeDictId === id) return;
  if (!store.dicts.some((d) => d.id === id)) return;
  store.activeDictId = id;
  store.query = "";
  localStorage.setItem(ACTIVE_DICT_KEY, id);
}

export function addDict(name: string): Dictionary {
  const dict: Dictionary = {
    id: uuid(),
    name: name.trim() || "未命名词库",
    created_at: nowSec(),
  };
  store.dicts.push(dict);
  setActiveDict(dict.id);
  persist();
  return dict;
}

export function renameDict(id: string, name: string) {
  const d = store.dicts.find((x) => x.id === id);
  if (!d) return;
  d.name = name.trim() || d.name;
  persist();
}

export function removeDict(id: string) {
  if (store.dicts.length <= 1) {
    toast("至少保留一个词库");
    return;
  }
  const i = store.dicts.findIndex((x) => x.id === id);
  if (i < 0) return;
  store.dicts.splice(i, 1);
  store.words = store.words.filter((w) => w.dictId !== id);
  if (store.activeDictId === id) {
    setActiveDict(store.dicts[Math.min(i, store.dicts.length - 1)].id);
  }
  persist();
}

// ---- 单词增删改 ----

export function addWord(draft: WordDraft, dictId: string = store.activeDictId) {
  const ts = nowSec();
  store.words.unshift({
    id: uuid(),
    dictId,
    ...draft,
    mastered: false,
    created_at: ts,
    updated_at: ts,
  });
  persist();
}

export function updateWord(id: string, draft: WordDraft, dictId?: string) {
  const w = store.words.find((x) => x.id === id);
  if (!w) return;
  Object.assign(w, draft, { updated_at: nowSec() });
  if (dictId) w.dictId = dictId;
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

/** 导入条目到当前词库并按「单词+释义」去重 */
export async function importEntries(incoming: Array<Partial<WordEntry>>) {
  await importBook({ words: incoming });
}

/**
 * 导入一份词库数据：
 * - 带词库结构时按名称合并词库，单词去重后归入对应词库；
 * - 无词库结构（外部数组 / 旧版格式）时全部进入当前词库。
 */
export async function importBook(book: {
  dicts?: Array<Partial<Dictionary>>;
  words?: Array<Partial<WordEntry>>;
}) {
  // 按名称合并词库，记录「文件内词库 id → 本地词库 id」的映射
  const idMap = new Map<string, string>();
  let createdDicts = 0;
  const rawDicts = book.dicts ?? [];
  const normalized = normalizeDicts(rawDicts);
  rawDicts.forEach((raw, i) => {
    const dict = normalized[i];
    const existing = store.dicts.find((d) => d.name === dict.name);
    if (existing) {
      idMap.set(raw.id ?? "", existing.id);
    } else {
      store.dicts.push(dict);
      idMap.set(raw.id ?? "", dict.id);
      createdDicts++;
    }
  });

  const incoming = normalize(book.words ?? []).map((w) => ({
    ...w,
    dictId: idMap.get(w.dictId) ?? store.activeDictId,
  }));

  // 每个词库各自维护一套去重键
  const seenByDict = new Map<string, Set<string>>();
  const seenSetFor = (dictId: string): Set<string> => {
    let set = seenByDict.get(dictId);
    if (!set) {
      set = new Set();
      seenByDict.set(dictId, set);
    }
    return set;
  };
  for (const w of store.words) {
    seenSetFor(w.dictId).add(entryKey(w));
  }

  const fresh: WordEntry[] = [];
  let skipped = 0;
  for (const w of incoming) {
    const seen = seenSetFor(w.dictId);
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
  }
  if (fresh.length || createdDicts) persist();

  const parts = [
    createdDicts ? `新建 ${createdDicts} 个词库` : "",
    fresh.length ? `导入 ${fresh.length} 个单词` : "",
    skipped ? `跳过重复 ${skipped} 条` : "",
  ].filter(Boolean);
  toast(parts.length ? parts.join("，") : "没有新的内容可导入");
}

export function formatTrans(w: WordEntry): string {
  return w.trans.join("；");
}

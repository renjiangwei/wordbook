/** 词库（分组）元信息，单词通过 dictId 关联到词库 */
export interface Dictionary {
  id: string;
  name: string;
  created_at: number;
}

export interface WordEntry {
  id: string;
  /** 所属词库 id */
  dictId: string;
  /** 英文单词 */
  name: string;
  /** 中文释义，可多条 */
  trans: string[];
  /** 美式音标 */
  usphone: string;
  /** 英式音标 */
  ukphone: string;
  /** 备注 / 例句 */
  note: string;
  mastered: boolean;
  created_at: number;
  updated_at: number;
}

/** 列表学情筛选 */
export type StatusFilter = "all" | "unmastered" | "mastered";
/** 列表排序：按添加/导入时间（新→旧）或字母序 */
export type SortMode = "time" | "alpha";
/** 列表视图：卡片 / 紧凑列表 */
export type ViewMode = "card" | "compact";
/** 单词本显示的语言 */
export type WordDisplayMode = "zh" | "en" | "both";

export interface WordBook {
  version: number;
  dicts: Dictionary[];
  words: WordEntry[];
}

export interface WordDraft {
  name: string;
  trans: string[];
  usphone: string;
  ukphone: string;
  note: string;
}

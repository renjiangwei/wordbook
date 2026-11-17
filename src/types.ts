export interface WordEntry {
  id: string;
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

export interface WordBook {
  version: number;
  words: WordEntry[];
}

export interface WordDraft {
  name: string;
  trans: string[];
  usphone: string;
  ukphone: string;
  note: string;
}

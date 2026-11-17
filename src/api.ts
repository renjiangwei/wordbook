import { invoke } from "@tauri-apps/api/core";
import type { Dictionary, WordBook, WordEntry } from "./types";

export function loadWords(): Promise<WordBook> {
  return invoke("load_words");
}

export function saveWords(dicts: Dictionary[], words: WordEntry[]): Promise<void> {
  return invoke("save_words", { book: { version: 2, dicts, words } });
}

export function importWords(path: string): Promise<WordBook> {
  return invoke("import_words", { path });
}

export function exportWords(path: string, words: WordEntry[]): Promise<void> {
  return invoke("export_words", { path, book: { version: 2, dicts: [], words } });
}

/** 导出包含词库分组结构的完整备份 */
export function exportBook(
  path: string,
  dicts: Dictionary[],
  words: WordEntry[],
): Promise<void> {
  return invoke("export_book", { path, book: { version: 2, dicts, words } });
}

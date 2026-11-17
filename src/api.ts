import { invoke } from "@tauri-apps/api/core";
import type { WordBook, WordEntry } from "./types";

export function loadWords(): Promise<WordBook> {
  return invoke("load_words");
}

export function saveWords(words: WordEntry[]): Promise<void> {
  return invoke("save_words", { book: { version: 1, words } });
}

export function importWords(path: string): Promise<WordBook> {
  return invoke("import_words", { path });
}

export function exportWords(path: string, words: WordEntry[]): Promise<void> {
  return invoke("export_words", { path, book: { version: 1, words } });
}

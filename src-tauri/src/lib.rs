use serde::{Deserialize, Deserializer, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const STORAGE_FILE: &str = "wordbook.json";

/// 单词条目。name/trans/usphone/ukphone 与外部词库格式一致，
/// 其余为应用自有字段，全部带默认值，便于兼容各种来源的 JSON。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WordEntry {
    pub id: String,
    #[serde(deserialize_with = "null_or_string")]
    pub name: String,
    #[serde(deserialize_with = "null_or_string_vec")]
    pub trans: Vec<String>,
    #[serde(deserialize_with = "null_or_string")]
    pub usphone: String,
    #[serde(deserialize_with = "null_or_string")]
    pub ukphone: String,
    #[serde(deserialize_with = "null_or_string")]
    pub note: String,
    #[serde(deserialize_with = "null_or_bool")]
    pub mastered: bool,
    #[serde(deserialize_with = "null_or_u64")]
    pub created_at: u64,
    #[serde(deserialize_with = "null_or_u64")]
    pub updated_at: u64,
}

impl Default for WordEntry {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            trans: Vec::new(),
            usphone: String::new(),
            ukphone: String::new(),
            note: String::new(),
            mastered: false,
            created_at: 0,
            updated_at: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WordBook {
    pub version: u32,
    pub words: Vec<WordEntry>,
}

impl Default for WordBook {
    fn default() -> Self {
        Self {
            version: 1,
            words: Vec::new(),
        }
    }
}

// ---- 容错反序列化：字段缺失或为 null 时取默认值 ----

fn null_or_string<'de, D>(d: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(match serde_json::Value::deserialize(d)? {
        serde_json::Value::String(s) => s,
        _ => String::new(),
    })
}

fn null_or_string_vec<'de, D>(d: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    match serde_json::Value::deserialize(d)? {
        serde_json::Value::Array(items) => Ok(items
            .into_iter()
            .map(|x| match x {
                serde_json::Value::String(s) => s,
                _ => String::new(),
            })
            .collect()),
        _ => Ok(Vec::new()),
    }
}

fn null_or_bool<'de, D>(d: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(serde_json::Value::deserialize(d)?.as_bool().unwrap_or(false))
}

fn null_or_u64<'de, D>(d: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(serde_json::Value::deserialize(d)?.as_u64().unwrap_or(0))
}

// ---- 存储 ----

fn storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {e}"))?;
    Ok(dir.join(STORAGE_FILE))
}

/// 解析词库文本，兼容两种格式：
/// 1. 本应用格式：`{ "version": 1, "words": [ ... ] }`
/// 2. 外部词库格式：直接数组 `[ { "name": ..., "trans": [...], "usphone": "...", "ukphone": "..." } ]`
fn parse_book(content: &str) -> Result<WordBook, String> {
    if content.trim().is_empty() {
        return Ok(WordBook::default());
    }
    if let Ok(book) = serde_json::from_str::<WordBook>(content) {
        return Ok(fill_ids(book));
    }
    let words: Vec<WordEntry> = serde_json::from_str(content)
        .map_err(|e| format!("无法识别的 JSON 词库格式: {e}"))?;
    Ok(fill_ids(WordBook { version: 1, words }))
}

/// 给缺少 id 的条目（如外部导入的）补一个唯一 id
fn fill_ids(mut book: WordBook) -> WordBook {
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    for (i, w) in book.words.iter_mut().enumerate() {
        if w.id.is_empty() {
            w.id = format!("w{}-{}", seed, i);
        }
    }
    book
}

#[tauri::command]
fn load_words(app: tauri::AppHandle) -> Result<WordBook, String> {
    let path = storage_path(&app)?;
    if !path.exists() {
        return Ok(WordBook::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("读取词库失败: {e}"))?;
    parse_book(&content)
}

#[tauri::command]
fn save_words(app: tauri::AppHandle, book: WordBook) -> Result<(), String> {
    let path = storage_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建数据目录失败: {e}"))?;
    }
    let content = serde_json::to_string_pretty(&book).map_err(|e| e.to_string())?;
    // 先写临时文件再替换，避免写入中途出错损坏词库
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content).map_err(|e| format!("写入词库失败: {e}"))?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("写入词库失败: {e}"))?;
    }
    fs::rename(&tmp, &path).map_err(|e| format!("写入词库失败: {e}"))?;
    Ok(())
}

#[tauri::command]
fn import_words(path: String) -> Result<WordBook, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {e}"))?;
    parse_book(&content)
}

/// 导出为外部词库兼容的数组格式（保留全部字段，外部工具可按 name/trans/usphone/ukphone 读取）
#[tauri::command]
fn export_words(path: String, book: WordBook) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&book.words).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_words,
            save_words,
            import_words,
            export_words
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

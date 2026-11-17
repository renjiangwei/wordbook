# 单词本 (WordBook)

一个用 Tauri 2 + Vue 3 编写的桌面单词本应用。

## 功能

- **手动记录**：录入英文、中文释义（可多条）、美/英音标、备注（例句 / 记忆笔记）
- **总览**：列表查看全部单词，支持按单词、释义、备注、音标搜索
- **标记掌握**：每个单词可标记 / 取消「已掌握」
- **随机循环**：
  - 三种模式：英 → 中、中 → 英、中英同显
  - 顺序随机打乱，到末尾后自动重新洗牌循环
  - 可选「仅未掌握」单词循环
  - 翻开答案时同时显示中英文、音标和备注
  - 键盘快捷键：`空格` 翻转、`←` `→` 切换、`M` 标记掌握
- **导入 / 导出**：JSON 文件导入导出，去重合并

## 数据格式

存储文件位于系统应用数据目录（Windows 下为
`%APPDATA%\com.wordbook.app\wordbook.json`），格式如下：

```json
{
  "version": 1,
  "words": [
    {
      "id": "...",
      "name": "massage",
      "trans": ["按摩"],
      "usphone": "mə'sɑʒ",
      "ukphone": "'mæsɑːʒ; mə'sɑːʒ; -dʒ",
      "note": "备注或例句",
      "mastered": false,
      "created_at": 1700000000,
      "updated_at": 1700000000
    }
  ]
}
```

同时**兼容导入**外部词库格式（直接数组，应用会自动补全缺失字段）：

```json
[
  {
    "name": "massage",
    "trans": ["按摩"],
    "usphone": "mə'sɑʒ",
    "ukphone": "'mæsɑːʒ; mə'sɑːʒ; -dʒ"
  }
]
```

导出时也使用这种数组格式（附带全部字段，外部工具可按 `name` / `trans` 读取）。

## 开发

```bash
npm install       # 安装依赖（本项目使用 npmmirror 镜像，见 .npmrc）
npm run tauri dev # 开发模式运行
npm run tauri build # 打包安装程序
```

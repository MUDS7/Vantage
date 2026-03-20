# POST /api/chat — 对话接口（支持文件上传）

## 基本信息

| 项目 | 说明 |
|------|------|
| **URL** | `/api/chat` |
| **Method** | `POST` |
| **Content-Type** | `multipart/form-data` |
| **说明** | 与 DeepSeek 大模型对话，支持同时上传文件作为对话上下文 |

---

## 请求字段

通过 `multipart/form-data` 提交，各字段如下：

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `message` | `string` | ✅ 是 | 用户输入的消息文本 |
| `history` | `string` (JSON) | 否 | 历史对话记录，JSON 数组字符串，格式见下方 |
| `model` | `string` | 否 | 模型名称，默认 `"deepseek-chat"`。可选 `"deepseek-reasoner"`（思考模式） |
| `thinking` | `string` | 否 | 是否启用思考模式，值为 `"true"` 或 `"false"` |
| `session_id` | `string` | 否 | 会话 ID。不传则创建新会话，传入则继续已有会话 |
| `files` | `File` | 否 | 上传的文件，**支持多个**（多次 append 同名字段 `files`）。支持格式：`pdf`、`docx`、`doc`、`xlsx`、`xls`、`csv`、`md`、`txt`。图片文件（png/jpg/jpeg）会被忽略 |

### `history` 字段格式

JSON 数组字符串，每个元素包含 `role` 和 `content`：

```json
[
  { "role": "user", "content": "你好" },
  { "role": "assistant", "content": "你好！有什么可以帮助你的？" },
  { "role": "user", "content": "请介绍一下你自己" }
]
```

---

## 响应

### 成功响应 `200 OK`

```json
{
  "success": true,
  "reply": "这是大模型的回复内容...",
  "reasoning_content": "这是思维链内容（仅思考模式下存在，普通模式无此字段）",
  "usage": {
    "prompt_tokens": 128,
    "completion_tokens": 256,
    "total_tokens": 384
  },
  "session_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | `boolean` | 固定为 `true` |
| `reply` | `string` | 大模型的回复内容 |
| `reasoning_content` | `string \| null` | 思维链内容，仅在思考模式（`deepseek-reasoner` 或 `thinking=true`）下返回，普通模式不返回此字段 |
| `usage` | `object \| null` | Token 用量统计，可能为 null |
| `usage.prompt_tokens` | `number` | 提示 token 数 |
| `usage.completion_tokens` | `number` | 回复 token 数 |
| `usage.total_tokens` | `number` | 总 token 数 |
| `session_id` | `string` | 会话 ID（新建的或传入的） |

### 失败响应 `4xx / 5xx`

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

---

## 前端调用示例

### 纯文本对话（无文件）

```javascript
const formData = new FormData();
formData.append('message', '你好，请介绍一下你自己');

const resp = await fetch('/api/chat', {
  method: 'POST',
  body: formData,
});
const data = await resp.json();
console.log(data.reply);
console.log(data.session_id); // 后续对话传入此 ID
```

### 携带文件对话

```javascript
const formData = new FormData();
formData.append('message', '请帮我总结这两份文档的要点');
formData.append('session_id', '之前返回的会话ID');  // 可选
formData.append('files', fileInput.files[0]);        // 第一个文件
formData.append('files', fileInput.files[1]);        // 第二个文件（可多个）

const resp = await fetch('/api/chat', {
  method: 'POST',
  body: formData,
});
const data = await resp.json();
```

### 使用思考模式

```javascript
const formData = new FormData();
formData.append('message', '请深入分析这个问题...');
formData.append('model', 'deepseek-reasoner');
// 或者用 thinking 字段：
// formData.append('thinking', 'true');

const resp = await fetch('/api/chat', {
  method: 'POST',
  body: formData,
});
const data = await resp.json();
console.log(data.reasoning_content); // 思维链内容
console.log(data.reply);             // 最终回答
```

### 携带历史记录的多轮对话

```javascript
const formData = new FormData();
formData.append('message', '继续上面的话题...');
formData.append('session_id', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
formData.append('history', JSON.stringify([
  { role: 'user', content: '之前的问题' },
  { role: 'assistant', content: '之前的回答' }
]));

const resp = await fetch('/api/chat', {
  method: 'POST',
  body: formData,
});
```

---

## 注意事项

1. **文件仅作为临时上下文**：上传的文件只用于本次对话的上下文理解，不会被持久化存储（与 `/api/upload` 不同）
2. **支持的文件格式**：`pdf`、`docx`、`doc`、`xlsx`、`xls`、`csv`、`md`、`txt`
3. **图片文件会被忽略**：`png`、`jpg`、`jpeg` 格式的文件不会被处理
4. **多文件上传**：多次 append 同名 `files` 字段即可上传多个文件
5. **会话记录中保存的是原始用户消息**（不含文件上下文内容）
6. **新会话**会由后台异步生成 5-10 字的中文标题

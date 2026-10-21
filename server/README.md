# バックエンドAPI仕様

認証なしで利用できるシンプルなタスクAPIです。すべてのリクエストとレスポンスはJSON形式です。

## 起動

```bash
pip install flask
python server.py
```

デフォルトでは`http://localhost:5000`で起動します。

## `GET /api/ping`

サーバーの起動確認。

```json
{"message": "pong"}
```

# ユーザーAPI

認証はありません。ユーザーIDは作成時にサーバーが自動発行します。ユーザーを削除すると、そのユーザーのタスクも削除されます。

## `GET /api/users`

ユーザー一覧を取得します。

```json
{
  "users": [
    {"user_id": 1, "name": "tori"}
  ],
  "total": 1
}
```

## `POST /api/users`

ユーザーを作成します。`name`は必須です。

```json
{"name": "neko"}
```

成功時は`201 Created`を返します。

## `GET /api/users/{user_id}`

ユーザー情報を1件取得します。

## `PATCH /api/users/{user_id}`

ユーザー名を更新します。

```json
{"name": "new name"}
```

## `DELETE /api/users/{user_id}`

ユーザーを削除します。成功時は`204 No Content`を返します。

# タスクAPI
## `GET /api/users/{user_id}/tasks`

ユーザーのタスク一覧を取得します。`status`で`todo`、`in_progress`、`done`を指定して絞り込めます。

```http
GET /api/users/1/tasks?status=todo
```

```json
{
  "tasks": [
    {
      "task_id": "1",
      "title": "task1",
      "description": "This is the first task.",
      "due_date": null,
      "status": "todo"
    }
  ],
  "total": 1
}
```

## `POST /api/users/{user_id}/tasks`

タスクを追加します。`task_id`はサーバーがUUIDで発行します。

### Request

```json
{
  "title": "task2",
  "description": "新しいタスク",
  "due_date": "2026-10-30",
  "status": "todo"
}
```

`title`は必須です。`description`、`due_date`は任意で、`status`を省略すると`todo`になります。

### Response `201 Created`

```json
{
  "task": {
    "task_id": "generated-uuid",
    "title": "task2",
    "description": "新しいタスク",
    "due_date": "2026-10-30",
    "status": "todo"
  }
}
```

## `PATCH /api/users/{user_id}/tasks/{task_id}`

指定した項目だけを更新します。

```json
{"status": "done"}
```

## `DELETE /api/users/{user_id}/tasks/{task_id}`

タスクを削除します。成功時は`204 No Content`を返します。

## エラー

| 状況                   |        ステータス |
| ---------------------- | ----------------: |
| 入力値不正             | `400 Bad Request` |
| ユーザー・タスク不存在 |   `404 Not Found` |

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力値が不正です",
    "details": {
      "title": "titleは必須です"
    }
  }
}
```

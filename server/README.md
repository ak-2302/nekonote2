# バックエンドAPI仕様

Bearerトークン認証を使用するシンプルなタスクAPIです。すべてのリクエストとレスポンスはJSON形式です。

## 起動

```bash
pip install flask
python server.py
```

デフォルトでは`http://localhost:5000`で起動します。

## 実装構成

`server.py`は次の責務に分けています。

- `JsonStore`: `data.json`の読み書きとユーザー検索
- `AuthService`: パスワードハッシュとBearerトークンの管理
- `Validator`: ユーザー・ログイン・タスク入力の検証
- `Server`: Flaskルート、認証、レスポンスの組み立て

## 認証

### `POST /api/users`

ユーザーを登録します。`password`は8文字以上で指定してください。サーバーにはパスワードそのものではなく、ハッシュ値だけを保存します。

```json
{
  "name": "tori",
  "username": "tori",
  "password": "password123"
}
```

### `POST /api/login`

ログインに成功するとBearerアクセストークンを返します。

```json
{
  "username": "tori",
  "password": "password123"
}
```

レスポンス:

```json
{
  "access_token": "token",
  "token_type": "Bearer",
  "user": {
    "user_id": 2,
    "name": "tori",
    "username": "tori"
  }
}
```

以降の認証が必要なリクエストには、次のヘッダーを付けます。

```http
Authorization: Bearer token
```

### `POST /api/logout`

ログアウトしてアクセストークンを無効化します。認証が必要です。

### `GET /api/me`

ログイン中のユーザー情報を取得します。認証が必要です。

## API通信の順序

クライアントは、次の順序で認証付きAPIを利用します。

1. `POST /api/users`でユーザーを登録します。パスワードはサーバー側でハッシュ化して保存されます。
2. `POST /api/login`に`username`と`password`を送信します。
3. サーバーが認証に成功すると、`access_token`を返します。
4. タスクAPIを呼び出すときは、毎回次のヘッダーにトークンを付けます。

   ```http
   Authorization: Bearer <access_token>
   ```

5. サーバーはトークンからユーザーを特定し、そのユーザー自身のタスクだけを処理します。
6. 利用を終えるときは`POST /api/logout`を呼び出し、トークンを無効化します。

```text
ユーザー登録
  POST /api/users
      ↓
ログイン
  POST /api/login
      ↓ access_token
タスク操作
  GET/POST/PATCH/DELETE /api/task
      ↓ Authorizationヘッダー
ログアウト
  POST /api/logout
```

トークンがない、期限切れ、または無効な場合は`401 Unauthorized`を返します。

## `GET /api/ping`

サーバーの起動確認。

```json
{"message": "pong"}
```

# ユーザーAPI

ユーザー登録以外のユーザー操作には認証が必要です。ユーザーIDは作成時にサーバーが自動発行されます。ユーザーを削除すると、そのユーザーのタスクも削除されます。

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

# タスクAPI（認証必須）

ログイン後は、ユーザーIDをURLに指定せず、`/api/task`を使用します。タスクはトークンのユーザー自身のものだけが対象です。

## `GET /api/task`

自分のタスク一覧を取得します。`status`で絞り込めます。

## `POST /api/task`

自分のタスクを追加します。

```json
{
  "title": "task2",
  "description": "新しいタスク",
  "due_date": "2026-10-30",
  "status": "todo"
}
```

## `PATCH /api/task/{task_id}`

自分のタスクを更新します。

## `DELETE /api/task/{task_id}`

自分のタスクを削除します。

## 旧タスクAPI

既存の`/api/users/{user_id}/tasks`も互換性のため残しています。新規クライアントは、ユーザーIDのなりすましを防ぐため認証付きの`/api/task`を使用してください。

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
| 認証情報がない・無効   | `401 Unauthorized` |
| 他ユーザーの操作       | `403 Forbidden` |
| ユーザー・タスク不存在 |   `404 Not Found` |
| 不正なURL               |   `404 Not Found` |

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

存在しないURLにアクセスした場合は、次のレスポンスを返します。

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "指定されたURLが見つかりません"
  }
}
```

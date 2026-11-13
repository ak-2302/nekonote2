# バックエンドAPI仕様

Bearerトークン認証を使用するシンプルなタスクAPIです。すべてのリクエストとレスポンスはJSON形式です。

## 起動

```bash
pip install -r ../requirements.txt
python server.py
```

デフォルトでは`http://localhost:8001`で起動します。画面も同じサーバーから配信するので、`http://localhost:8001/app/register/index.html`を開いてください。

初回起動時にWeb Push用の秘密鍵`vapid_private.pem`が自動で作られます。gitには含めません。削除すると鍵が作り直され、各端末で通知を有効にし直す必要があります（ログイン時に自動で登録し直します）。

## スマホでの確認（Cloudflare Tunnel）

PWAとプッシュ通知はHTTPSでしか動かないため、Cloudflare Tunnelで一時的に公開して確認します。

```bash
# 1. server/ でサーバーを起動
python server.py

# 2. 別のターミナルでトンネルを開く（cloudflared をインストール済みであること）
cloudflared tunnel --url http://localhost:8001
```

表示された`https://xxxx.trycloudflare.com`に`/app/register/index.html`を付けて、スマホで開きます。

1. ブラウザの共有メニューから「ホーム画面に追加」する（iPhoneはiOS 16.4以降で、ホーム画面から開いたときだけ通知を使える）
2. ホーム画面のアイコンから開いてログインし、「通知を有効にする」を押して許可する
3. タスクを追加するときに「開始時刻に通知」か「開始5分前に通知」を選ぶ
4. 指定した時刻になると通知が届く（30秒ごとに確認するので、最大30秒ほど遅れる）。通知を押すと、そのタスクのタイマー画面が開いてタイマーが動き始める

注意点:

- `trycloudflare.com`のURLは起動するたびに変わります。URLが変わると別のアプリとして扱われるため、ホーム画面への追加と通知の許可をやり直してください。
- ログイン用のトークンはサーバーのメモリにしかないため、サーバーを再起動すると再ログインが必要です。通知の登録先は`data.json`に保存されるので、通知は再起動後も届きます。
- 通知はサーバーが動いている間しか送れません。
- VS CodeのLive Serverで画面だけ開いて見た目を確認することもできますが、APIと通知はこのサーバー経由で確認してください。

## 実装構成

`server.py`は次の責務に分けています。

- `JsonStore`: `data.json`の読み書きとユーザー検索
- `AuthService`: パスワードハッシュとBearerトークンの管理
- `PushService`: Web Pushの鍵管理と、通知時刻になったタスクの通知送信（バックグラウンドスレッド）
- `Validator`: ユーザー・ログイン・タスク・通知購読の入力検証
- `Server`: Flaskルート、認証、レスポンスの組み立て

## `PATCH /api/app/tasks/{task_id}`

認証が必要です。ログイン中のユーザーのタスクの完了状態を変更します。指定できるのは`done`だけで、他の項目を含めると`400`になります。他のユーザーのタスクや存在しないタスクは`404`です。

```json
{ "done": true }
```

成功時は`200`で、更新後のタスクを`{"task": {...}}`で返します。完了済みのタスクはデータとして残り、トップ画面の一覧で表示しないだけです。

## プッシュ通知API

### `GET /api/push/public-key`

認証不要です。購読に使うVAPID公開鍵を返します。

```json
{ "public_key": "BPx..." }
```

### `POST /api/push/subscribe`

認証が必要です。ブラウザの`PushSubscription.toJSON()`をそのまま送ると、ログイン中のユーザーの通知先として登録します。同じ`endpoint`が他のユーザーに登録されていた場合は、そちらから外します。成功時は`204`です。

```json
{ "endpoint": "https://...", "keys": { "p256dh": "...", "auth": "..." } }
```

### `POST /api/push/unsubscribe`

認証が必要です。`{"endpoint": "..."}`で指定した通知先を外します。ログアウト時に呼びます。成功時は`204`です。

### 通知の送信条件

`POST /api/app/tasks`で`notify_before`（`0`または`5`、省略時は`0`）を指定できます。`start - notify_before × 60`の時刻を過ぎ、まだ`end`前で、未完了かつ未通知のタスクに通知を送り、`notified: true`を記録します。通知を押すと`/app/timer/index.html?task=<id>`が開きます。

## 認証

### `POST /api/users`

ユーザーを登録します。サーバーにはパスワードそのものではなく、ハッシュ値だけを保存します。

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

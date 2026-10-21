# バックエンドAPIの仕様

## GET /api/ping
- `pong`を返す。
- `200 OK`
- `application/json`
- `{"message": "pong"}`

## GET /api/fetch_tasks
```bash
curl --location --request GET 'http://nekonote.おいで.みんな/api/fetch_tasks' \
--header 'Content-Type: application/json' \
--data-raw '{
    "user_id": "ユーザーID"
}'
```
- `200 OK`



## GET /api/add_task
```bash
curl --location --request GET 'http://nekonote.おいで.みんな/api/add_task' \
--header 'Content-Type: application/json' \
--data-raw '{
    "user_id": "ユーザーID",
    "task_name": "タスク名",
    "task_description": "タスクの説明",
    "task_priority": "優先度",
    "task_starttime": "開始時刻",
    "task_endtime": "終了時刻"
}'
```
- `200 OK`


import json
import os
import secrets
import uuid
from datetime import date, datetime
from functools import wraps

from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash


class JsonStore:
    def __init__(self, path):
        self.path = path
        self.data = self._load()

    def _load(self):
        with open(self.path, "r", encoding="utf-8") as data_file:
            return json.load(data_file)

    def save(self):
        with open(self.path, "w", encoding="utf-8") as data_file:
            json.dump(self.data, data_file, ensure_ascii=False, indent=4)

    @property
    def users(self):
        return self.data["users"]

    def find_user(self, user_id):
        return next(
            (user for user in self.users if user["user_id"] == user_id),
            None,
        )

    def find_by_username(self, username):
        username = username.strip().lower()
        return next(
            (
                user
                for user in self.users
                if user.get("username", "").lower() == username
            ),
            None,
        )

    def username_exists(self, username):
        return self.find_by_username(username) is not None

    def add_user(self, name, username, password_hash):
        user = {
            "user_id": max(
                (user["user_id"] for user in self.users),
                default=0,
            )
            + 1,
            "name": name,
            "username": username,
            "password_hash": password_hash,
            "tasks": [],
        }
        self.users.append(user)
        self.save()
        return user

    def delete_user(self, user_id):
        self.data["users"] = [
            user for user in self.users if user["user_id"] != user_id
        ]
        self.save()


class AuthService:
    def __init__(self, store):
        self.store = store
        self.tokens = {}

    def create_password_hash(self, password):
        return generate_password_hash(password)

    def authenticate(self, username, password):
        user = self.store.find_by_username(username)
        if user is None or not user.get("password_hash"):
            return None
        if not check_password_hash(user["password_hash"], password):
            return None
        return user

    def issue_token(self, user):
        token = secrets.token_urlsafe(32)
        self.tokens[token] = user["user_id"]
        return token

    def revoke_token(self, token):
        self.tokens.pop(token, None)

    def user_from_token(self, token):
        user_id = self.tokens.get(token)
        return self.store.find_user(user_id) if user_id is not None else None


class Validator:
    @staticmethod
    def user(data, partial=False):
        if not isinstance(data, dict):
            return {"body": "リクエストボディはJSONオブジェクトで指定してください"}

        unknown = set(data) - {"name", "username", "password"}
        if unknown:
            return {"body": f"未対応の項目があります: {', '.join(sorted(unknown))}"}
        if not partial and not isinstance(data.get("name"), str):
            return {"name": "nameは必須です"}
        if "name" in data and (
            not isinstance(data["name"], str) or not data["name"].strip()
        ):
            return {"name": "nameは空でない文字列で指定してください"}
        if not partial and not isinstance(data.get("username"), str):
            return {"username": "usernameは必須です"}
        if "username" in data and (
            not isinstance(data["username"], str) or not data["username"].strip()
        ):
            return {"username": "usernameは空でない文字列で指定してください"}
        if not partial and not isinstance(data.get("password"), str):
            return {"password": "passwordは必須です"}
        if "password" in data and (
            not isinstance(data["password"], str) or len(data["password"]) < 8
        ):
            return {"password": "passwordは8文字以上で指定してください"}
        return None

    @staticmethod
    def login(data):
        if not isinstance(data, dict):
            return {"body": "リクエストボディはJSONオブジェクトで指定してください"}
        if not isinstance(data.get("username"), str):
            return {"username": "usernameは必須です"}
        if not isinstance(data.get("password"), str):
            return {"password": "passwordは必須です"}
        return None

    @staticmethod
    def task(data, partial=False):
        if not isinstance(data, dict):
            return {"body": "リクエストボディはJSONオブジェクトで指定してください"}

        unknown = set(data) - {"title", "description", "due_date", "status"}
        if unknown:
            return {"body": f"未対応の項目があります: {', '.join(sorted(unknown))}"}
        if not partial and not isinstance(data.get("title"), str):
            return {"title": "titleは必須です"}
        if "title" in data and (
            not isinstance(data["title"], str) or not data["title"].strip()
        ):
            return {"title": "titleは空でない文字列で指定してください"}
        if "description" in data and not isinstance(data["description"], str):
            return {"description": "descriptionは文字列で指定してください"}
        if "due_date" in data and data["due_date"] is not None:
            try:
                date.fromisoformat(data["due_date"])
            except (TypeError, ValueError):
                return {"due_date": "due_dateはYYYY-MM-DD形式で指定してください"}
        if "status" in data and data["status"] not in {
            "todo",
            "in_progress",
            "done",
        }:
            return {"status": "statusはtodo、in_progress、doneのいずれかです"}
        return None


class Server:
    def __init__(self, host="localhost", port=8001):
        self.host = host
        self.port = port
        self.app = Flask(__name__)
        data_path = os.path.join(os.path.dirname(__file__), "data.json")
        self.store = JsonStore(data_path)
        self.auth = AuthService(self.store)
        self.register_routes()
        self.register_error_handlers()

    @staticmethod
    def public_user(user):
        return {
            "user_id": user["user_id"],
            "name": user["name"],
            "username": user.get("username"),
        }

    @staticmethod
    def error(code, message, status, details=None):
        payload = {"code": code, "message": message}
        if details:
            payload["details"] = details
        return jsonify({"error": payload}), status

    @staticmethod
    def task_from(data):
        return {
            "task_id": str(uuid.uuid4()),
            "title": data["title"].strip(),
            "description": data.get("description", ""),
            "due_date": data.get("due_date"),
            "status": data.get("status", "todo"),
        }

    @staticmethod
    def find_task(user, task_id):
        return next(
            (
                task
                for task in user["tasks"]
                if str(task["task_id"]) == task_id
            ),
            None,
        )

    def authenticated(self, handler):
        @wraps(handler)
        def wrapper(*args, **kwargs):
            authorization = request.headers.get("Authorization", "")
            if not authorization.startswith("Bearer "):
                return self.error(
                    "UNAUTHORIZED",
                    "Authorization Bearerトークンが必要です",
                    401,
                )
            token = authorization.removeprefix("Bearer ").strip()
            user = self.auth.user_from_token(token)
            if user is None:
                return self.error("UNAUTHORIZED", "トークンが無効です", 401)
            request.current_user = user
            request.current_token = token
            return handler(*args, **kwargs)

        return wrapper

    def validate_task_request(self, partial=False):
        data = request.get_json(silent=True)
        details = Validator.task(data, partial=partial)
        if details:
            return None, self.error("VALIDATION_ERROR", "入力値が不正です", 400, details)
        return data, None

    def task_list_response(self, user):
        tasks = user["tasks"]
        status = request.args.get("status")
        if status is not None:
            if status not in {"todo", "in_progress", "done"}:
                return self.error(
                    "VALIDATION_ERROR",
                    "statusが不正です",
                    400,
                    {"status": "todo、in_progress、doneのいずれかです"},
                )
            tasks = [task for task in tasks if task["status"] == status]
        return jsonify({"tasks": tasks, "total": len(tasks)})

    @staticmethod
    def development_task(task):
        if "start" in task and "end" in task:
            start = task["start"]
            end = task["end"]
        else:
            due_date = task.get("due_date")
            start = int(datetime.fromisoformat(f"{due_date}T09:00:00").timestamp()) if due_date else 0
            end = start + 3600
        return {
            "id": str(task.get("id", task.get("task_id"))),
            "name": task.get("name", task.get("title", "")),
            "description": task.get("description", ""),
            "start": start,
            "end": end,
            "done": task.get("done", task.get("status") == "done"),
        }

    def owned_user(self, user_id):
        user = self.store.find_user(user_id)
        if user is None:
            return None, self.error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)
        if request.current_user["user_id"] != user_id:
            return None, self.error("FORBIDDEN", "このユーザーを操作できません", 403)
        return user, None

    def register_error_handlers(self):
        @self.app.errorhandler(404)
        def handle_not_found(error):
            return self.error("NOT_FOUND", "指定されたURLが見つかりません", 404)

    def register_routes(self):
        @self.app.after_request
        def development_cors(response):
            if request.path.startswith("/api/dev/"):
                response.headers["Access-Control-Allow-Origin"] = "*"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            return response

        @self.app.get("/api/ping")
        def ping():
            return jsonify({"message": "pong"})

        @self.app.get("/api/users")
        def fetch_users():
            users = [self.public_user(user) for user in self.store.users]
            return jsonify({"users": users, "total": len(users)})

        @self.app.get("/api/dev/tasks")
        def development_tasks():
            tasks = [
                self.development_task(task)
                for user in self.store.users
                for task in user.get("tasks", [])
            ]
            return jsonify({"tasks": tasks, "total": len(tasks)})

        @self.app.post("/api/dev/tasks")
        def add_development_task():
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return self.error("VALIDATION_ERROR", "入力値が不正です", 400)
            required = {"name", "start", "end", "done"}
            if not required.issubset(data):
                return self.error(
                    "VALIDATION_ERROR",
                    "name、start、end、doneは必須です",
                    400,
                )
            if not isinstance(data["name"], str) or not data["name"].strip():
                return self.error("VALIDATION_ERROR", "nameは必須です", 400)
            if not all(isinstance(data[key], (int, float)) for key in ("start", "end")):
                return self.error("VALIDATION_ERROR", "startとendは数値で指定してください", 400)
            if not isinstance(data["done"], bool) or data["end"] <= data["start"]:
                return self.error("VALIDATION_ERROR", "タスクの時間または完了状態が不正です", 400)
            task = {
                "id": str(data.get("id", uuid.uuid4())),
                "name": data["name"].strip(),
                "description": data.get("description", ""),
                "start": int(data["start"]),
                "end": int(data["end"]),
                "done": data["done"],
            }
            user = self.store.users[0]
            user.setdefault("tasks", []).append(task)
            self.store.save()
            return jsonify({"task": task}), 201

        @self.app.post("/api/users")
        def add_user():
            data = request.get_json(silent=True)
            details = Validator.user(data)
            if details:
                return self.error("VALIDATION_ERROR", "入力値が不正です", 400, details)
            username = data["username"].strip()
            if self.store.username_exists(username):
                return self.error(
                    "USERNAME_ALREADY_EXISTS",
                    "usernameは既に使用されています",
                    409,
                )
            user = self.store.add_user(
                data["name"].strip(),
                username,
                self.auth.create_password_hash(data["password"]),
            )
            return jsonify({"user": self.public_user(user)}), 201

        @self.app.post("/api/login")
        def login():
            data = request.get_json(silent=True)
            details = Validator.login(data)
            if details:
                return self.error("VALIDATION_ERROR", "入力値が不正です", 400, details)
            user = self.auth.authenticate(data["username"], data["password"])
            if user is None:
                return self.error(
                    "INVALID_CREDENTIALS",
                    "ユーザー名またはパスワードが正しくありません",
                    401,
                )
            return jsonify(
                {
                    "access_token": self.auth.issue_token(user),
                    "token_type": "Bearer",
                    "user": self.public_user(user),
                }
            )

        @self.app.post("/api/logout")
        @self.authenticated
        def logout():
            self.auth.revoke_token(request.current_token)
            return "", 204

        @self.app.get("/api/me")
        @self.authenticated
        def current_user():
            return jsonify({"user": self.public_user(request.current_user)})

        @self.app.get("/api/task")
        @self.authenticated
        def fetch_current_tasks():
            return self.task_list_response(request.current_user)

        @self.app.post("/api/task")
        @self.authenticated
        def add_current_task():
            data, error = self.validate_task_request()
            if error:
                return error
            task = self.task_from(data)
            request.current_user["tasks"].append(task)
            self.store.save()
            return jsonify({"task": task}), 201

        @self.app.patch("/api/task/<task_id>")
        @self.authenticated
        def update_current_task(task_id):
            task = self.find_task(request.current_user, task_id)
            if task is None:
                return self.error("TASK_NOT_FOUND", "タスクが見つかりません", 404)
            data, error = self.validate_task_request(partial=True)
            if error:
                return error
            task.update(data)
            if "title" in task:
                task["title"] = task["title"].strip()
            self.store.save()
            return jsonify({"task": task})

        @self.app.delete("/api/task/<task_id>")
        @self.authenticated
        def delete_current_task(task_id):
            return self.delete_task_from_user(request.current_user, task_id)

        @self.app.get("/api/users/<int:user_id>")
        @self.authenticated
        def fetch_user(user_id):
            user, error = self.owned_user(user_id)
            return error or jsonify({"user": self.public_user(user)})

        @self.app.patch("/api/users/<int:user_id>")
        @self.authenticated
        def update_user(user_id):
            user, error = self.owned_user(user_id)
            if error:
                return error
            data = request.get_json(silent=True)
            details = Validator.user(data, partial=True)
            if details:
                return self.error("VALIDATION_ERROR", "入力値が不正です", 400, details)
            if "name" in data:
                user["name"] = data["name"].strip()
            self.store.save()
            return jsonify({"user": self.public_user(user)})

        @self.app.delete("/api/users/<int:user_id>")
        @self.authenticated
        def delete_user(user_id):
            user, error = self.owned_user(user_id)
            if error:
                return error
            self.store.delete_user(user["user_id"])
            return "", 204

        self.register_legacy_task_routes()

    def delete_task_from_user(self, user, task_id):
        original_count = len(user["tasks"])
        user["tasks"] = [
            task for task in user["tasks"] if str(task["task_id"]) != task_id
        ]
        if len(user["tasks"]) == original_count:
            return self.error("TASK_NOT_FOUND", "タスクが見つかりません", 404)
        self.store.save()
        return "", 204

    def register_legacy_task_routes(self):
        @self.app.get("/api/users/<int:user_id>/tasks")
        @self.authenticated
        def fetch_tasks(user_id):
            user, error = self.owned_user(user_id)
            return error or self.task_list_response(user)

        @self.app.post("/api/users/<int:user_id>/tasks")
        @self.authenticated
        def add_task(user_id):
            user, error = self.owned_user(user_id)
            if error:
                return error
            data, error = self.validate_task_request()
            if error:
                return error
            task = self.task_from(data)
            user["tasks"].append(task)
            self.store.save()
            return jsonify({"task": task}), 201

        @self.app.patch("/api/users/<int:user_id>/tasks/<task_id>")
        @self.authenticated
        def update_task(user_id, task_id):
            user, error = self.owned_user(user_id)
            if error:
                return error
            task = self.find_task(user, task_id)
            if task is None:
                return self.error("TASK_NOT_FOUND", "タスクが見つかりません", 404)
            data, error = self.validate_task_request(partial=True)
            if error:
                return error
            task.update(data)
            if "title" in task:
                task["title"] = task["title"].strip()
            self.store.save()
            return jsonify({"task": task})

        @self.app.delete("/api/users/<int:user_id>/tasks/<task_id>")
        @self.authenticated
        def delete_task(user_id, task_id):
            user, error = self.owned_user(user_id)
            return error or self.delete_task_from_user(user, task_id)

    def run(self):
        self.app.run(host=self.host, port=self.port)


if __name__ == "__main__":
    Server().run()

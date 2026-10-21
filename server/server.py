import json
import os
import uuid
from datetime import date

from flask import Flask, jsonify, request


class Server:
    def __init__(self, host="localhost", port=5000):
        self.host = host
        self.port = port
        self.app = Flask(__name__)
        self.data_path = os.path.join(os.path.dirname(__file__), "data.json")
        self.data = self._load_data()
        self.register_routes()

    def _load_data(self):
        with open(self.data_path, "r", encoding="utf-8") as data_file:
            return json.load(data_file)

    def _save_data(self):
        with open(self.data_path, "w", encoding="utf-8") as data_file:
            json.dump(self.data, data_file, ensure_ascii=False, indent=4)

    def _find_user(self, user_id):
        return next(
            (user for user in self.data["users"] if user["user_id"] == user_id),
            None,
        )

    @staticmethod
    def _public_user(user):
        return {
            "user_id": user["user_id"],
            "name": user["name"],
        }

    @staticmethod
    def _validate_user(user_data, partial=False):
        if not isinstance(user_data, dict):
            return {"body": "リクエストボディはJSONオブジェクトで指定してください"}

        unknown_fields = set(user_data) - {"name"}
        if unknown_fields:
            return {"body": f"未対応の項目があります: {', '.join(sorted(unknown_fields))}"}
        if not partial and not isinstance(user_data.get("name"), str):
            return {"name": "nameは必須です"}
        if "name" in user_data and (
            not isinstance(user_data["name"], str) or not user_data["name"].strip()
        ):
            return {"name": "nameは空でない文字列で指定してください"}
        return None

    @staticmethod
    def _validate_task(task_data, partial=False):
        if not isinstance(task_data, dict):
            return {"body": "リクエストボディはJSONオブジェクトで指定してください"}

        allowed_fields = {"title", "description", "due_date", "status"}
        unknown_fields = set(task_data) - allowed_fields
        if unknown_fields:
            return {"body": f"未対応の項目があります: {', '.join(sorted(unknown_fields))}"}

        if not partial and not isinstance(task_data.get("title"), str):
            return {"title": "titleは必須です"}
        if "title" in task_data and (
            not isinstance(task_data["title"], str) or not task_data["title"].strip()
        ):
            return {"title": "titleは空でない文字列で指定してください"}
        if "description" in task_data and not isinstance(
            task_data["description"], str
        ):
            return {"description": "descriptionは文字列で指定してください"}
        if "due_date" in task_data and task_data["due_date"] is not None:
            try:
                date.fromisoformat(task_data["due_date"])
            except (TypeError, ValueError):
                return {"due_date": "due_dateはYYYY-MM-DD形式で指定してください"}
        if "status" in task_data and task_data["status"] not in {
            "todo",
            "in_progress",
            "done",
        }:
            return {"status": "statusはtodo、in_progress、doneのいずれかです"}
        return None

    def _error(self, code, message, status, details=None):
        error = {"code": code, "message": message}
        if details:
            error["details"] = details
        return jsonify({"error": error}), status

    def run(self):
        self.app.run(host=self.host, port=self.port)

    def register_routes(self):
        @self.app.get("/api/ping")
        def ping():
            return jsonify({"message": "pong"})

        @self.app.get("/api/users")
        def fetch_users():
            users = [self._public_user(user) for user in self.data["users"]]
            return jsonify({"users": users, "total": len(users)})

        @self.app.post("/api/users")
        def add_user():
            user_data = request.get_json(silent=True)
            validation_error = self._validate_user(user_data)
            if validation_error:
                return self._error(
                    "VALIDATION_ERROR",
                    "入力値が不正です",
                    400,
                    validation_error,
                )

            user_id = max(
                (user["user_id"] for user in self.data["users"]),
                default=0,
            ) + 1
            user = {
                "user_id": user_id,
                "name": user_data["name"].strip(),
                "tasks": [],
            }
            self.data["users"].append(user)
            self._save_data()
            return jsonify({"user": self._public_user(user)}), 201

        @self.app.get("/api/users/<int:user_id>")
        def fetch_user(user_id):
            user = self._find_user(user_id)
            if user is None:
                return self._error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)
            return jsonify({"user": self._public_user(user)})

        @self.app.patch("/api/users/<int:user_id>")
        def update_user(user_id):
            user = self._find_user(user_id)
            if user is None:
                return self._error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)

            user_data = request.get_json(silent=True)
            validation_error = self._validate_user(user_data, partial=True)
            if validation_error:
                return self._error(
                    "VALIDATION_ERROR",
                    "入力値が不正です",
                    400,
                    validation_error,
                )
            if "name" in user_data:
                user["name"] = user_data["name"].strip()
            self._save_data()
            return jsonify({"user": self._public_user(user)})

        @self.app.delete("/api/users/<int:user_id>")
        def delete_user(user_id):
            if self._find_user(user_id) is None:
                return self._error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)
            self.data["users"] = [
                user for user in self.data["users"] if user["user_id"] != user_id
            ]
            self._save_data()
            return "", 204

        @self.app.get("/api/users/<int:user_id>/tasks")
        def fetch_tasks(user_id):
            user = self._find_user(user_id)
            if user is None:
                return self._error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)

            tasks = user["tasks"]
            status = request.args.get("status")
            if status is not None:
                if status not in {"todo", "in_progress", "done"}:
                    return self._error(
                        "VALIDATION_ERROR",
                        "statusが不正です",
                        400,
                        {"status": "todo、in_progress、doneのいずれかです"},
                    )
                tasks = [task for task in tasks if task["status"] == status]
            return jsonify({"tasks": tasks, "total": len(tasks)})

        @self.app.post("/api/users/<int:user_id>/tasks")
        def add_task(user_id):
            user = self._find_user(user_id)
            if user is None:
                return self._error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)

            task_data = request.get_json(silent=True)
            validation_error = self._validate_task(task_data)
            if validation_error:
                return self._error(
                    "VALIDATION_ERROR",
                    "入力値が不正です",
                    400,
                    validation_error,
                )

            task = {
                "task_id": str(uuid.uuid4()),
                "title": task_data["title"].strip(),
                "description": task_data.get("description", ""),
                "due_date": task_data.get("due_date"),
                "status": task_data.get("status", "todo"),
            }
            user["tasks"].append(task)
            self._save_data()
            return jsonify({"task": task}), 201

        @self.app.patch("/api/users/<int:user_id>/tasks/<task_id>")
        def update_task(user_id, task_id):
            user = self._find_user(user_id)
            if user is None:
                return self._error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)

            task = next(
                (task for task in user["tasks"] if str(task["task_id"]) == task_id),
                None,
            )
            if task is None:
                return self._error("TASK_NOT_FOUND", "タスクが見つかりません", 404)

            task_data = request.get_json(silent=True)
            validation_error = self._validate_task(task_data, partial=True)
            if validation_error:
                return self._error(
                    "VALIDATION_ERROR",
                    "入力値が不正です",
                    400,
                    validation_error,
                )
            task.update(task_data)
            if "title" in task:
                task["title"] = task["title"].strip()
            self._save_data()
            return jsonify({"task": task})

        @self.app.delete("/api/users/<int:user_id>/tasks/<task_id>")
        def delete_task(user_id, task_id):
            user = self._find_user(user_id)
            if user is None:
                return self._error("USER_NOT_FOUND", "ユーザーが見つかりません", 404)

            original_count = len(user["tasks"])
            user["tasks"] = [
                task for task in user["tasks"] if str(task["task_id"]) != task_id
            ]
            if len(user["tasks"]) == original_count:
                return self._error("TASK_NOT_FOUND", "タスクが見つかりません", 404)
            self._save_data()
            return "", 204


if __name__ == "__main__":
    Server().run()

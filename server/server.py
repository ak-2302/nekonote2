from flask import Flask, request, jsonify
import os
import json
import sys
import uuid

class Server:
    def __init__(self, host='127.0.0.1', port=5000):
        self.host = host
        self.port = port
        self.app = Flask(__name__)
        self.app.config['JSON_AS_ASCII'] = False
        self.register_routes()
        self.config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        self.config = json.load(open(self.config_path, 'r', encoding='utf-8'))
        self.data_path = os.path.join(os.path.dirname(__file__), 'data.json')
        self.data = json.load(open(self.data_path, 'r', encoding='utf-8'))
    
    def run(self):
        self.app.run(host=self.host, port=self.port)

    def register_routes(self):
        
        ## ping
        @self.app.route('/api/ping', methods=['GET'])
        def ping():
            return json.dumps({'message': 'pong'}), 200
        
        @self.app.route('/api/fetch_tasks', methods=['GET'])
        def tasks():
            _data = request.get_json()
            if _data is None:
                return json.dumps({'error': 'No data provided'}), 400
            
            _data_user_id = _data.get('user_id')
            if _data_user_id is None:
                return json.dumps({'error': 'No user_id provided'}), 400

            _result = {"tasks": []}
            
            for user in self.data['user']:
                if user['user_id'] == _data_user_id:
                    _result = json.loads(user['tasks'])
            return json.dumps(_result), 200
        
        @self.app.route('/api/add_task', methods=['GET'])
        def add_task():
            _data = request.get_json()
            if _data is None:
                return json.dumps({'error': 'No data provided'}), 400
            
            _data_user_id = _data.get('user_id')
            _data_task = _data.get('task')
            if _data_user_id is None or _data_task is None:
                return json.dumps({'error': 'Missing user_id or task'}), 400

            _task_element = {
                "task_id": str(uuid.uuid4()),
                "title": _data_task.get('title'),
                "description": _data_task.get('description'),
                "due_date": _data_task.get('due_date'),
                "status": _data_task.get('status')
            }
            
            for user in self.data['user']:
                if user['user_id'] == _data_user_id:
                    tasks = json.loads(user['tasks'])
                    tasks.append(_task_element)
                    user['tasks'] = json.dumps(tasks)
                    with open(self.data_path, 'w', encoding='utf-8') as f:
                        json.dump(self.data, f, ensure_ascii=False, indent=4)
                    return json.dumps({'message': 'Task added successfully'}), 200
            
            return json.dumps({'error': 'User not found'}), 404


if __name__ == '__main__':
    server = Server()
    server.run()
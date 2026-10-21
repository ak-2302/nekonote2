from flask import Flask, request, jsonify
import os
import json
import sys

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
        @self.app.route('/api/ping', methods=['GET'])
        def ping():
            return json.dumps({'message': 'pong'}), 200
        
        @self.app.route('/api/fetch_task', methods=['GET'])
        def task():
            _data = request.get_json()
            if _data is None:
                return json.dumps({'error': 'No data provided'}), 400
            _data_keys = _data.keys() if _data else []
            
            _result = {
                "task_name": "",
                "task_description": "",
                "task_status": "",
                "task_duration": "",
                "task_starttime": "",
                "task_endtime": "",
                "task_priority": "",
                }
            
            return json.dumps({'task': self.data.get('task', 'No task available')}), 200


if __name__ == '__main__':
    server = Server()
    server.run()
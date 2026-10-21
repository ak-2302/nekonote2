from flask import Flask
import os
import json


class Server:
    def __init__(self, host='127.0.0.1', port=5000):
        self.host = host
        self.port = port
        self.app = Flask(__name__)
        self.app.config['JSON_AS_ASCII'] = False
        self.register_routes()
    
    def run(self):
        self.app.run(host=self.host, port=self.port)

    def register_routes(self):
        @self.app.route('/api/hello', methods=['GET'])
        def hello():
            return json.dumps({'message': 'Hello, World!'})

        @self.app.route('/api/health', methods=['GET'])
        def health():
            return json.dumps({'status': 'OK'})


if __name__ == '__main__':
    server = Server()
    server.run()
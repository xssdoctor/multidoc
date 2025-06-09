import os
import subprocess
import json
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for

app = Flask(__name__, static_folder='../frontend')
app.secret_key = 'dev_secret_key'  # IMPORTANT: Change this in a real application!

# Path to the Go application
# Assuming app.go is in the parent directory of web_gui
GO_APP_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', '..'))
# Assumes app.go is in the root of multidoc_project
GO_APP_PATH = os.path.join(GO_APP_DIR, 'app.go')


@app.route('/')
def index():
    # Serve index.html from the frontend folder
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    # Serve other static files (like CSS, JS) from the frontend folder
    return send_from_directory(app.static_folder, path)


@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if username == 'admin' and password == 'password':
        session['logged_in'] = True
        session['username'] = username
        return jsonify({'status': 'success', 'message': 'Logged in successfully'}), 200
    else:
        return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401


@app.route('/logout', methods=['POST'])
def logout():
    session.pop('logged_in', None)
    session.pop('username', None)
    return jsonify({'status': 'success', 'message': 'Logged out successfully'}), 200


@app.route('/check_auth', methods=['GET'])
def check_auth():
    return jsonify({'logged_in': session.get('logged_in', False)})


def get_history_filepath(username):
    # Store history files in the same directory as app.py for simplicity
    return os.path.join(os.path.dirname(__file__), f"{username}_history.json")


def load_user_history(username):
    filepath = get_history_filepath(username)
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, 'r') as f:
            history = json.load(f)
            # Ensure it's a list
            return history if isinstance(history, list) else []
    except (json.JSONDecodeError, IOError):
        return []  # Return empty list on error or if file is corrupted


def save_user_history(username, history_data):
    filepath = get_history_filepath(username)
    try:
        with open(filepath, 'w') as f:
            json.dump(history_data, f, indent=4)
        return True
    except IOError:
        return False


@app.route('/api/history', methods=['GET', 'POST'])
def manage_history():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'error': 'Unauthorized. Please log in.'}), 401

    username = session.get('username')
    if not username:
        return jsonify({'status': 'error', 'error': 'Username not found in session.'}), 400

    if request.method == 'GET':
        history = load_user_history(username)
        return jsonify(history), 200

    if request.method == 'POST':
        new_item = request.json
        if not new_item or 'prompt' not in new_item or 'response' not in new_item:
            return jsonify({'status': 'error', 'message': 'Invalid history item format'}), 400

        current_history = load_user_history(username)
        current_history.append(new_item)
        if save_user_history(username, current_history):
            return jsonify({'status': 'success', 'message': 'History updated'}), 200
        else:
            return jsonify({'status': 'error', 'message': 'Failed to save history'}), 500


@app.route('/run', methods=['POST'])
def run_command():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'error': 'Unauthorized. Please log in.'}), 401
    try:
        data = request.json

        prompt_text = data.get('prompt', '')
        use_lambda_chat = data.get('lambdaChat', False)

        if not prompt_text:
            return jsonify({'status': 'error', 'output': '', 'error': 'No prompt provided'}), 400

        cmd = ['go', 'run', GO_APP_PATH]
        if use_lambda_chat:
            cmd.append('-lc')

        # Ensure the input to app.go ends with a newline
        prompt_with_newline = prompt_text + '\n'

        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=GO_APP_DIR
        )

        try:
            # For LambdaChat, use a longer timeout since it may take more time
            # 10 minutes for LambdaChat, 5 minutes otherwise
            timeout_value = 600 if use_lambda_chat else 300
            stdout, stderr = process.communicate(
                input=prompt_with_newline, timeout=timeout_value)
        except subprocess.TimeoutExpired:
            process.kill()
            return jsonify({
                'status': 'error',
                'output': '',
                'error': f'Command timed out after {timeout_value//60} minutes. Please try again with a shorter prompt or without LambdaChat option.'
            }), 500

        # Process completed - check return code
        if process.returncode == 0:
            return jsonify({'status': 'success', 'output': stdout, 'error': stderr})
        else:
            return jsonify({'status': 'error', 'output': stdout, 'error': stderr, 'return_code': process.returncode}), 500

    except FileNotFoundError:
        # This could happen if 'go' is not in PATH or GO_APP_PATH is incorrect
        return jsonify({'status': 'error', 'error': f"Failed to run command. Ensure 'go' is installed and '{GO_APP_PATH}' is correct."}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


if __name__ == '__main__':
    # Ensure the frontend directory exists
    frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    if not os.path.exists(frontend_dir):
        os.makedirs(frontend_dir)
        print(f"Created frontend directory: {frontend_dir}")
    app.run(debug=True, host='0.0.0.0', port=5002)

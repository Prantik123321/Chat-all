from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room
from datetime import datetime

app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
socketio = SocketIO(app, cors_allowed_origins="*")

# Simple storage
rooms = {'public-chat': {'users': [], 'messages': []}}
users = {}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat')
def chat():
    return render_template('chat.html')

@socketio.on('connect')
def handle_connect():
    print('Client connected:', request.sid)

@socketio.on('join_public')
def handle_join(data):
    username = data.get('username', 'Guest')
    room = 'public-chat'
    
    users[username] = {'sid': request.sid, 'room': room}
    
    if username not in rooms[room]['users']:
        rooms[room]['users'].append(username)
    
    join_room(room)
    
    # Welcome message
    welcome = {
        'id': len(rooms[room]['messages']) + 1,
        'username': '🤖 Chat-Bot',
        'message': f'Welcome {username}!',
        'type': 'system',
        'timestamp': datetime.now().isoformat()
    }
    rooms[room]['messages'].append(welcome)
    
    emit('joined_success', {'username': username})
    emit('user_joined', {
        'username': username,
        'online_users': rooms[room]['users']
    }, room=room, broadcast=True)
    emit('chat_history', {'messages': rooms[room]['messages'][-50:]})
    emit('online_users', {'users': rooms[room]['users']})

@socketio.on('send_message')
def handle_message(data):
    username = data.get('username')
    message = data.get('message', '')
    msg_type = data.get('type', 'text')
    
    if username in users:
        room = users[username]['room']
        
        msg_data = {
            'id': len(rooms[room]['messages']) + 1,
            'username': username,
            'message': message,
            'type': msg_type,
            'timestamp': datetime.now().isoformat()
        }
        
        rooms[room]['messages'].append(msg_data)
        emit('new_message', msg_data, room=room, broadcast=True)

@socketio.on('typing')
def handle_typing(data):
    username = data.get('username')
    if username in users:
        room = users[username]['room']
        emit('user_typing', {
            'username': username,
            'is_typing': data.get('is_typing', False)
        }, room=room, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    user_to_remove = None
    for username, data in users.items():
        if data['sid'] == request.sid:
            user_to_remove = username
            room = data['room']
            break
    
    if user_to_remove:
        del users[user_to_remove]
        if user_to_remove in rooms[room]['users']:
            rooms[room]['users'].remove(user_to_remove)
            emit('user_left', {
                'username': user_to_remove,
                'online_users': rooms[room]['users']
            }, room=room, broadcast=True)

if __name__ == '__main__':
    print("Chat Server running on http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
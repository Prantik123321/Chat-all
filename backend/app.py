from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from datetime import datetime
import threading
import time
import traceback
import atexit
import os

app = Flask(__name__, 
            static_folder='../frontend', 
            template_folder='../frontend',
            static_url_path='')

CORS(app)
app.config['SECRET_KEY'] = 'chat-box-secure-key-2024'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Store chat data
rooms = {
    'public-chat': {
        'users': [],
        'messages': [],
        'created_at': datetime.now().isoformat(),
        'type': 'public'
    }
}
users = {}
lock = threading.Lock()

# Initialize message_limits for rate limiting
message_limits = {}

# Health monitoring
server_start_time = time.time()
total_connections = 0
total_messages = 0

def cleanup():
    """Cleanup resources before exit"""
    print("🔄 Cleaning up resources...")
    with lock:
        users.clear()
        message_limits.clear()
        for room in rooms.values():
            room['users'].clear()

atexit.register(cleanup)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat')
def chat_page():
    return render_template('chat.html')

@app.route('/health')
def health_check():
    """Health endpoint for monitoring"""
    with lock:
        online_users = sum(len(room['users']) for room in rooms.values())
        total_msgs = sum(len(room['messages']) for room in rooms.values())
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'uptime': int(time.time() - server_start_time),
        'online_users': online_users,
        'total_messages': total_msgs,
        'total_connections': total_connections,
        'rooms': len(rooms),
        'message_limits_count': len(message_limits)
    })

@socketio.on('connect')
def handle_connect():
    global total_connections
    total_connections += 1
    
    client_ip = request.remote_addr
    print(f"✅ Client connected: {request.sid} from {client_ip}")
    
    try:
        emit('connected', {
            'message': 'Welcome to Chat-Box!',
            'server_time': datetime.now().isoformat(),
            'client_id': request.sid[:8]
        })
    except Exception as e:
        print(f"❌ Error in connect handler: {e}")

@socketio.on_error_default
def default_error_handler(e):
    """Default error handler for Socket.IO"""
    print(f"⚠️ Socket.IO error: {e}")
    traceback.print_exc()

@socketio.on('join_public')
def handle_join_public(data):
    try:
        username = data.get('username', 'Guest').strip()
        
        if not username or len(username) > 20:
            emit('error', {'message': 'Invalid username'})
            return
        
        # Default room
        room = 'public-chat'
        
        with lock:
            # Check for duplicate usernames
            original_username = username
            counter = 1
            while username in users:
                username = f"{original_username}_{counter}"
                counter += 1
            
            # Store user
            users[username] = {
                'sid': request.sid,
                'room': room,
                'joined_at': datetime.now().isoformat(),
                'ip': request.remote_addr
            }
            
            # Add to room
            if room not in rooms:
                rooms[room] = {
                    'users': [],
                    'messages': [],
                    'created_at': datetime.now().isoformat()
                }
            
            if username not in rooms[room]['users']:
                rooms[room]['users'].append(username)
        
        join_room(room)
        
        # Welcome message
        welcome_msg = {
            'id': len(rooms[room]['messages']) + 1,
            'username': '🤖 Chat-Bot',
            'message': f'Welcome {username}! Start chatting with everyone! 🎉',
            'type': 'system',
            'timestamp': datetime.now().isoformat()
        }
        rooms[room]['messages'].append(welcome_msg)
        
        # Notify everyone
        emit('joined_success', {
            'username': username,
            'room': room
        })
        
        emit('user_joined', {
            'username': username,
            'online_users': rooms[room]['users']
        }, room=room, broadcast=True)
        
        # Send history
        emit('chat_history', {
            'messages': rooms[room]['messages'][-100:]
        })
        
        emit('online_users', {
            'users': rooms[room]['users']
        })
        
        print(f"👤 {username} joined {room}")
        
    except Exception as e:
        print(f"❌ Error in join_public: {e}")
        traceback.print_exc()
        emit('error', {'message': 'Internal server error'})

@socketio.on('send_message')
def handle_message(data):
    global total_messages
    
    try:
        username = data.get('username')
        message = data.get('message', '').strip()
        msg_type = data.get('type', 'text')
        file_name = data.get('file_name', '')
        
        if not username or username not in users:
            emit('error', {'message': 'User not found'})
            return
        
        room = users[username]['room']
        
        if room not in rooms:
            emit('error', {'message': 'Room not found'})
            return
        
        # Rate limiting
        current_time = time.time()
        if username in message_limits:
            last_time, count = message_limits[username]
            if current_time - last_time < 1:
                if count > 5:
                    emit('error', {'message': 'Sending too fast. Slow down!'})
                    return
                message_limits[username] = (last_time, count + 1)
            else:
                message_limits[username] = (current_time, 1)
        else:
            message_limits[username] = (current_time, 1)
        
        # For text messages, check if message is empty
        if msg_type == 'text' and not message:
            emit('error', {'message': 'Message cannot be empty'})
            return
        
        # Create message
        message_data = {
            'id': len(rooms[room]['messages']) + 1,
            'username': username,
            'message': message,
            'type': msg_type,
            'file_name': file_name,
            'timestamp': datetime.now().isoformat()
        }
        
        # Handle large messages
        if msg_type in ['image', 'video']:
            # Estimate size
            estimated_size = len(message) * 0.75
            if estimated_size > 5 * 1024 * 1024:  # 5MB limit
                emit('error', {'message': 'File too large. Max 5MB'})
                return
        
        with lock:
            rooms[room]['messages'].append(message_data)
            if len(rooms[room]['messages']) > 1000:
                rooms[room]['messages'] = rooms[room]['messages'][-1000:]
        
        # Broadcast
        emit('new_message', message_data, room=room, broadcast=True)
        
        total_messages += 1
        
        if msg_type == 'text':
            print(f"💬 {username}: {message[:50]}...")
        else:
            print(f"📎 {username} sent {msg_type}: {file_name}")
        
    except Exception as e:
        print(f"❌ Error in send_message: {e}")
        traceback.print_exc()
        emit('error', {'message': 'Failed to send message'})

@socketio.on('typing')
def handle_typing(data):
    try:
        username = data.get('username')
        is_typing = data.get('is_typing')
        
        if username in users:
            room = users[username]['room']
            emit('user_typing', {
                'username': username,
                'is_typing': is_typing
            }, room=room, broadcast=True)
    except Exception as e:
        print(f"❌ Error in typing handler: {e}")

@socketio.on('disconnect')
def handle_disconnect():
    try:
        with lock:
            user_to_remove = None
            for username, data in list(users.items()):
                if data['sid'] == request.sid:
                    user_to_remove = username
                    room = data['room']
                    break
            
            if user_to_remove:
                if user_to_remove in message_limits:
                    del message_limits[user_to_remove]
                
                del users[user_to_remove]
                if room in rooms and user_to_remove in rooms[room]['users']:
                    rooms[room]['users'].remove(user_to_remove)
                    
                    goodbye_msg = {
                        'id': len(rooms[room]['messages']) + 1,
                        'username': '🤖 Chat-Bot',
                        'message': f'{user_to_remove} left the chat 👋',
                        'type': 'system',
                        'timestamp': datetime.now().isoformat()
                    }
                    rooms[room]['messages'].append(goodbye_msg)
                    
                    emit('user_left', {
                        'username': user_to_remove,
                        'online_users': rooms[room]['users']
                    }, room=room, broadcast=True)
        
        print(f"❌ Client disconnected: {request.sid}")
        
    except Exception as e:
        print(f"❌ Error in disconnect handler: {e}")

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Chat-Box Server Starting...")
    print("💬 Public Chat Room: 'public-chat'")
    print("🌐 Web Interface: http://localhost:5000")
    print("⚡ Socket.IO: ws://localhost:5000/socket.io")
    print("🏥 Health Check: http://localhost:5000/health")
    print("=" * 60)
    
    try:
        socketio.run(app, 
                    host='0.0.0.0', 
                    port=5000, 
                    debug=True,
                    allow_unsafe_werkzeug=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"\n💥 Server crashed with error: {e}")
        traceback.print_exc()
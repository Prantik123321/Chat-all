class ChatApplication {
    constructor() {
        this.socket = null;
        this.username = '';
        this.room = 'public-chat';
        this.isTyping = false;
        this.typingTimeout = null;
        this.filePreview = null;
        this.emojiPickerVisible = false;
        
        this.initialize();
    }
    
    initialize() {
        this.username = localStorage.getItem('chatBoxUsername') || 'Guest';
        document.getElementById('currentUser').textContent = this.username;
        document.getElementById('userAvatar').textContent = this.username.charAt(0).toUpperCase();
        
        this.initSocket();
        this.setupEventListeners();
        this.setupEmojiPicker();
        this.showWelcome();
    }
    
    initSocket() {
        this.socket = io(window.location.origin, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.showNotification('Connected to chat server', 'success');
            this.joinPublicChat();
        });
        
        this.socket.on('connected', (data) => {
            console.log('Server:', data.message);
        });
        
        this.socket.on('joined_success', (data) => {
            console.log('Joined chat:', data.username);
            this.username = data.username;
            document.getElementById('currentUser').textContent = this.username;
            document.getElementById('userAvatar').textContent = this.username.charAt(0).toUpperCase();
        });
        
        this.socket.on('user_joined', (data) => {
            if (data.username !== this.username) {
                this.showNotification(`${data.username} joined the chat`, 'info');
            }
            this.updateOnlineUsers(data.online_users);
        });
        
        this.socket.on('user_left', (data) => {
            this.showNotification(`${data.username} left the chat`, 'info');
            this.updateOnlineUsers(data.online_users);
        });
        
        this.socket.on('new_message', (data) => {
            this.addMessage(data);
            this.scrollToBottom();
        });
        
        this.socket.on('chat_history', (data) => {
            this.loadChatHistory(data.messages);
        });
        
        this.socket.on('online_users', (data) => {
            this.updateOnlineUsers(data.users);
        });
        
        this.socket.on('user_typing', (data) => {
            this.showTypingIndicator(data);
        });
        
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });
        
        this.socket.on('disconnect', () => {
            this.showNotification('Disconnected from server', 'error');
        });
    }
    
    joinPublicChat() {
        if (this.socket && this.username) {
            this.socket.emit('join_public', {
                username: this.username
            });
        }
    }
    
    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        const sendMessage = () => {
            const message = messageInput.value.trim();
            if (message && this.socket) {
                this.socket.emit('send_message', {
                    username: this.username,
                    message: message,
                    type: 'text'
                });
                messageInput.value = '';
                messageInput.style.height = 'auto';
                this.stopTyping();
                sendBtn.disabled = true;
            }
        };
        
        sendBtn.addEventListener('click', sendMessage);
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
            
            sendBtn.disabled = messageInput.value.trim() === '';
            
            if (!this.isTyping && messageInput.value.trim()) {
                this.isTyping = true;
                this.socket.emit('typing', {
                    username: this.username,
                    is_typing: true
                });
            }
            
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.isTyping = false;
                this.socket.emit('typing', {
                    username: this.username,
                    is_typing: false
                });
            }, 1000);
        });
        
        const fileInput = document.getElementById('fileInput');
        const photoBtn = document.getElementById('photoBtn');
        const videoBtn = document.getElementById('videoBtn');
        const attachBtn = document.getElementById('attachBtn') || photoBtn;
        
        photoBtn.addEventListener('click', () => {
            fileInput.accept = 'image/*';
            fileInput.click();
        });
        
        videoBtn.addEventListener('click', () => {
            fileInput.accept = 'video/*';
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.previewFile(file);
            }
        });
        
        const emojiBtn = document.getElementById('emojiBtn');
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleEmojiPicker();
        });
        
        document.addEventListener('click', (e) => {
            const emojiPicker = document.querySelector('.emoji-picker-container');
            if (emojiPicker && !emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
                emojiPicker.classList.remove('show');
                this.emojiPickerVisible = false;
            }
            
            const filePreview = document.querySelector('.file-preview-container');
            if (filePreview && !filePreview.contains(e.target) && !attachBtn.contains(e.target)) {
                filePreview.classList.remove('show');
                this.filePreview = null;
                fileInput.value = '';
            }
        });
        
        const leaveBtn = document.getElementById('leaveRoom');
        leaveBtn.addEventListener('click', () => {
            if (confirm('Leave the chat room?')) {
                window.location.href = 'index.html';
            }
        });
        
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('active');
            });
        }
    }
    
    setupEmojiPicker() {
        const emojis = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
            '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
            '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
            '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
            '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
            '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
            '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
            '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
            '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
            '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
            '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
            '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
            '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸'
        ];
        
        const emojiPicker = document.getElementById('emojiPicker');
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'emoji-grid';
        
        emojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', () => {
                this.addEmojiToInput(emoji);
            });
            emojiGrid.appendChild(emojiItem);
        });
        
        emojiPicker.appendChild(emojiGrid);
    }
    
    toggleEmojiPicker() {
        const emojiPicker = document.querySelector('.emoji-picker-container');
        this.emojiPickerVisible = !this.emojiPickerVisible;
        
        if (this.emojiPickerVisible) {
            emojiPicker.classList.add('show');
        } else {
            emojiPicker.classList.remove('show');
        }
    }
    
    addEmojiToInput(emoji) {
        const messageInput = document.getElementById('messageInput');
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;
        
        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.focus();
        messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        
        messageInput.dispatchEvent(new Event('input'));
    }
    
    previewFile(file) {
        document.querySelector('.emoji-picker-container').classList.remove('show');
        this.emojiPickerVisible = false;
        
        const previewContainer = document.querySelector('.file-preview-container');
        const previewContent = previewContainer.querySelector('.preview-content');
        const fileName = previewContainer.querySelector('.file-name');
        const sendFileBtn = previewContainer.querySelector('.send-file-btn');
        
        previewContent.innerHTML = '';
        this.filePreview = null;
        
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileType = file.type.startsWith('image/') ? 'image' : 'video';
                
                if (fileType === 'image') {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.maxWidth = '200px';
                    previewContent.appendChild(img);
                } else {
                    const video = document.createElement('video');
                    video.src = e.target.result;
                    video.controls = true;
                    video.style.maxWidth = '200px';
                    previewContent.appendChild(video);
                }
                
                this.filePreview = {
                    type: fileType,
                    data: e.target.result,
                    file: file,
                    name: file.name
                };
            };
            
            reader.onerror = () => {
                this.showNotification('Error reading file', 'error');
            };
            
            reader.readAsDataURL(file);
        } else {
            this.showNotification('Please select an image or video file', 'error');
            return;
        }
        
        fileName.textContent = file.name;
        
        const fileType = file.type.startsWith('image/') ? 'image' : 'video';
        sendFileBtn.textContent = `Send ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}`;
        sendFileBtn.onclick = () => this.sendFile();
        
        previewContainer.classList.add('show');
    }
    
    sendFile() {
        if (!this.filePreview || !this.socket) return;
        
        this.socket.emit('send_message', {
            username: this.username,
            message: this.filePreview.data,
            type: this.filePreview.type,
            file_name: this.filePreview.name
        });
        
        document.querySelector('.file-preview-container').classList.remove('show');
        this.filePreview = null;
        document.getElementById('fileInput').value = '';
        
        this.showNotification('File sent successfully', 'success');
    }
    
    addMessage(data) {
        const messagesContainer = document.getElementById('messagesContainer');
        
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const isCurrentUser = data.username === this.username;
        const isSystem = data.type === 'system';
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isCurrentUser ? 'outgoing' : 'incoming'} ${isSystem ? 'system' : ''}`;
        
        let messageHTML = '';
        
        if (isSystem) {
            messageHTML = `
                <div class="message-system">${data.message}</div>
            `;
        } else if (data.type === 'image' || data.type === 'video') {
            const time = new Date(data.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageHTML = `
                <div class="message-header">
                    <div class="message-sender">${data.username}</div>
                    <div class="message-time">${time}</div>
                </div>
                <div class="message-bubble">
                    <div class="file-info">
                        <i class="fas fa-${data.type === 'image' ? 'image' : 'video'}"></i>
                        <div class="file-name">${data.file_name || `${data.type} file`}</div>
                    </div>
                    <div class="file-preview">
                        ${data.type === 'image' ? 
                            `<img src="${data.message}" alt="Image" style="max-width: 200px; border-radius: 8px;">` :
                            `<video src="${data.message}" controls style="max-width: 200px; border-radius: 8px;"></video>`
                        }
                    </div>
                </div>
            `;
        } else {
            const time = new Date(data.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageHTML = `
                <div class="message-header">
                    <div class="message-sender">${data.username}</div>
                    <div class="message-time">${time}</div>
                </div>
                <div class="message-bubble">
                    ${this.formatMessage(data.message)}
                </div>
            `;
        }
        
        messageElement.innerHTML = messageHTML;
        messagesContainer.appendChild(messageElement);
    }
    
    loadChatHistory(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            this.showWelcome();
        } else {
            messages.forEach(message => this.addMessage(message));
            this.scrollToBottom();
        }
    }
    
    showWelcome() {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h3>Welcome to Chat-Box!</h3>
                <p>You're now connected to the public chat room</p>
                <div class="welcome-tips">
                    <div class="tip">
                        <i class="fas fa-comment"></i>
                        <span>Start typing to send a message</span>
                    </div>
                    <div class="tip">
                        <i class="fas fa-image"></i>
                        <span>Click the image/video buttons to share media</span>
                    </div>
                    <div class="tip">
                        <i class="fas fa-smile"></i>
                        <span>Use the emoji button to add emojis</span>
                    </div>
                    <div class="tip">
                        <i class="fas fa-users"></i>
                        <span>See who's online in the sidebar</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    updateOnlineUsers(users) {
        const onlineUsersList = document.getElementById('onlineUsersList');
        const onlineCount = document.getElementById('onlineCount');
        
        if (!onlineUsersList || !onlineCount) return;
        
        onlineCount.textContent = users.length;
        onlineUsersList.innerHTML = '';
        
        users.forEach(user => {
            const isYou = user === this.username;
            
            const li = document.createElement('li');
            li.className = `user-item ${isYou ? 'you' : ''}`;
            li.innerHTML = `
                <div class="user-avatar-small">
                    ${user.charAt(0).toUpperCase()}
                </div>
                <div class="user-details-small">
                    <div class="name">${user}${isYou ? ' (You)' : ''}</div>
                    <div class="status">Online</div>
                </div>
            `;
            onlineUsersList.appendChild(li);
        });
    }
    
    showTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            if (data.is_typing && data.username !== this.username) {
                typingIndicator.textContent = `${data.username} is typing...`;
                typingIndicator.classList.add('active');
            } else {
                typingIndicator.textContent = '';
                typingIndicator.classList.remove('active');
            }
        }
    }
    
    stopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            this.socket.emit('typing', {
                username: this.username,
                is_typing: false
            });
        }
    }
    
    formatMessage(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, url => 
            `<a href="${url}" target="_blank" style="color: inherit; text-decoration: underline;">${url}</a>`
        );
    }
    
    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    showNotification(message, type = 'info') {
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        
        notification.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <div class="notification-content">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('chat.html')) {
        new ChatApplication();
    }
});
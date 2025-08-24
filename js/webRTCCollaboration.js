// webRTCCollaboration.js
// Advanced Real-Time Collaboration System using WebRTC
// P2P communication with advanced features

class WebRTCCollaborationEngine {
    constructor() {
        this.version = "1.0.0-webrtc";
        this.initialized = false;
        
        // WebRTC Configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:turnserver.example.com:3478',
                    username: 'user',
                    credential: 'pass'
                }
            ],
            iceCandidatePoolSize: 10
        };
        
        // Peer connections management
        this.peerConnections = new Map();
        this.dataChannels = new Map();
        this.mediaStreams = new Map();
        
        // Collaboration features
        this.collaborationRooms = new Map();
        this.activeUsers = new Map();
        this.sharedDocuments = new Map();
        this.realTimeOperations = new Map();
        
        // Advanced features
        this.whiteboard = {
            canvas: null,
            context: null,
            operations: [],
            cursors: new Map()
        };
        
        this.voiceCommands = {
            recognition: null,
            commands: new Map(),
            enabled: false
        };
        
        this.aiAssistant = {
            enabled: true,
            suggestions: [],
            contextAnalysis: null
        };
        
        // Security and encryption
        this.encryption = {
            keys: new Map(),
            algorithm: 'AES-GCM',
            keyLength: 256
        };
        
        // Performance monitoring
        this.metrics = {
            latency: [],
            bandwidth: [],
            connection_quality: [],
            operations_per_second: 0
        };
        
        console.log('🌐 WebRTC Collaboration Engine initialized');
    }

    async init() {
        console.log('🚀 Initializing WebRTC Collaboration...');
        
        try {
            // Check WebRTC support
            if (!this.checkWebRTCSupport()) {
                throw new Error('WebRTC not supported');
            }
            
            // Initialize media devices
            await this.initializeMediaDevices();
            
            // Setup voice commands
            await this.initializeVoiceCommands();
            
            // Initialize whiteboard
            this.initializeWhiteboard();
            
            // Setup encryption
            await this.initializeEncryption();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            this.initialized = true;
            console.log('✅ WebRTC Collaboration ready');
            
        } catch (error) {
            console.error('❌ WebRTC initialization failed:', error);
        }
    }

    // Create or join collaboration room
    async createRoom(roomId, options = {}) {
        console.log(`🏠 Creating collaboration room: ${roomId}`);
        
        const room = {
            id: roomId,
            created_at: Date.now(),
            creator: options.userId || 'anonymous',
            participants: new Set(),
            features: {
                voice: options.voice !== false,
                video: options.video !== false,
                screen_share: options.screenShare !== false,
                whiteboard: options.whiteboard !== false,
                ai_assistant: options.aiAssistant !== false
            },
            documents: new Map(),
            operations: [],
            settings: {
                max_participants: options.maxParticipants || 10,
                encryption_enabled: true,
                recording_enabled: options.recording || false
            }
        };
        
        this.collaborationRooms.set(roomId, room);
        
        // Setup signaling for the room
        await this.setupSignaling(roomId);
        
        return room;
    }

    async joinRoom(roomId, userId, userInfo = {}) {
        console.log(`👥 User ${userId} joining room ${roomId}`);
        
        const room = this.collaborationRooms.get(roomId);
        if (!room) {
            throw new Error(`Room ${roomId} not found`);
        }
        
        if (room.participants.size >= room.settings.max_participants) {
            throw new Error('Room is full');
        }
        
        // Add user to room
        room.participants.add(userId);
        
        const user = {
            id: userId,
            info: userInfo,
            joined_at: Date.now(),
            permissions: this.getDefaultPermissions(),
            cursor_position: null,
            status: 'active'
        };
        
        this.activeUsers.set(userId, user);
        
        // Create peer connections for existing participants
        for (const participantId of room.participants) {
            if (participantId !== userId) {
                await this.createPeerConnection(userId, participantId);
            }
        }
        
        // Initialize user's collaboration features
        await this.initializeUserFeatures(userId, room);
        
        // Broadcast user joined event
        this.broadcastToRoom(roomId, {
            type: 'user_joined',
            userId,
            userInfo,
            timestamp: Date.now()
        });
        
        return user;
    }

    // Peer-to-peer connection management
    async createPeerConnection(localUserId, remoteUserId) {
        console.log(`🔗 Creating peer connection: ${localUserId} <-> ${remoteUserId}`);
        
        const connectionId = `${localUserId}-${remoteUserId}`;
        
        const peerConnection = new RTCPeerConnection(this.rtcConfig);
        
        // Setup event handlers
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage(remoteUserId, {
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    from: localUserId
                });
            }
        };
        
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state: ${peerConnection.connectionState}`);
            this.updateConnectionMetrics(connectionId, peerConnection);
        };
        
        peerConnection.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, connectionId);
        };
        
        // Create data channel for collaboration
        const dataChannel = peerConnection.createDataChannel('collaboration', {
            ordered: true
        });
        
        this.setupDataChannel(dataChannel, connectionId);
        
        this.peerConnections.set(connectionId, peerConnection);
        
        return peerConnection;
    }

    setupDataChannel(dataChannel, connectionId) {
        dataChannel.onopen = () => {
            console.log(`📡 Data channel opened: ${connectionId}`);
            this.dataChannels.set(connectionId, dataChannel);
        };
        
        dataChannel.onmessage = (event) => {
            this.handleCollaborationMessage(JSON.parse(event.data));
        };
        
        dataChannel.onerror = (error) => {
            console.error(`❌ Data channel error: ${error}`);
        };
    }

    // Real-time collaborative editing
    async shareDocument(roomId, documentId, content, type = 'text') {
        const room = this.collaborationRooms.get(roomId);
        if (!room) {
            throw new Error(`Room ${roomId} not found`);
        }
        
        const document = {
            id: documentId,
            type,
            content,
            version: 1,
            operations: [],
            cursors: new Map(),
            last_modified: Date.now(),
            created_by: 'system'
        };
        
        room.documents.set(documentId, document);
        this.sharedDocuments.set(documentId, document);
        
        // Broadcast document shared
        this.broadcastToRoom(roomId, {
            type: 'document_shared',
            documentId,
            document,
            timestamp: Date.now()
        });
        
        console.log(`📄 Document shared: ${documentId} in room ${roomId}`);
        
        return document;
    }

    applyOperation(documentId, operation, userId) {
        const document = this.sharedDocuments.get(documentId);
        if (!document) {
            throw new Error(`Document ${documentId} not found`);
        }
        
        // Apply operational transformation
        const transformedOperation = this.transformOperation(operation, document.operations);
        
        // Apply operation to document
        document.content = this.applyOperationToContent(document.content, transformedOperation);
        document.version++;
        document.operations.push({
            ...transformedOperation,
            userId,
            timestamp: Date.now(),
            version: document.version
        });
        document.last_modified = Date.now();
        
        // Broadcast operation to all participants
        const roomId = this.findRoomForDocument(documentId);
        if (roomId) {
            this.broadcastToRoom(roomId, {
                type: 'operation_applied',
                documentId,
                operation: transformedOperation,
                userId,
                version: document.version,
                timestamp: Date.now()
            });
        }
        
        return transformedOperation;
    }

    // Operational Transformation (OT) for conflict resolution
    transformOperation(operation, historicalOperations) {
        let transformedOp = { ...operation };
        
        // Apply transformations against all concurrent operations
        for (const histOp of historicalOperations) {
            if (histOp.timestamp > operation.timestamp) {
                transformedOp = this.transformAgainstOperation(transformedOp, histOp);
            }
        }
        
        return transformedOp;
    }

    transformAgainstOperation(op1, op2) {
        // Simplified operational transformation
        if (op1.type === 'insert' && op2.type === 'insert') {
            if (op1.position <= op2.position) {
                return op1;
            } else {
                return {
                    ...op1,
                    position: op1.position + op2.content.length
                };
            }
        } else if (op1.type === 'delete' && op2.type === 'insert') {
            if (op1.position < op2.position) {
                return op1;
            } else {
                return {
                    ...op1,
                    position: op1.position + op2.content.length
                };
            }
        } else if (op1.type === 'insert' && op2.type === 'delete') {
            if (op1.position <= op2.position) {
                return op1;
            } else {
                return {
                    ...op1,
                    position: Math.max(op2.position, op1.position - op2.length)
                };
            }
        } else if (op1.type === 'delete' && op2.type === 'delete') {
            if (op1.position < op2.position) {
                return op1;
            } else if (op1.position >= op2.position + op2.length) {
                return {
                    ...op1,
                    position: op1.position - op2.length
                };
            } else {
                // Overlapping deletes - more complex transformation needed
                return this.transformOverlappingDeletes(op1, op2);
            }
        }
        
        return op1;
    }

    applyOperationToContent(content, operation) {
        switch (operation.type) {
            case 'insert':
                return content.slice(0, operation.position) +
                       operation.content +
                       content.slice(operation.position);
            
            case 'delete':
                return content.slice(0, operation.position) +
                       content.slice(operation.position + operation.length);
            
            case 'replace':
                return content.slice(0, operation.position) +
                       operation.content +
                       content.slice(operation.position + operation.length);
            
            default:
                console.warn(`Unknown operation type: ${operation.type}`);
                return content;
        }
    }

    // Real-time whiteboard collaboration
    initializeWhiteboard() {
        if (typeof document !== 'undefined') {
            this.whiteboard.canvas = document.createElement('canvas');
            this.whiteboard.context = this.whiteboard.canvas.getContext('2d');
            
            // Setup whiteboard event handlers
            this.setupWhiteboardEvents();
        }
        
        console.log('🎨 Whiteboard initialized');
    }

    setupWhiteboardEvents() {
        if (!this.whiteboard.canvas) return;
        
        let isDrawing = false;
        let lastPoint = null;
        
        this.whiteboard.canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            lastPoint = { x: e.offsetX, y: e.offsetY };
        });
        
        this.whiteboard.canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) {
                // Update cursor position
                this.broadcastCursorPosition({ x: e.offsetX, y: e.offsetY });
                return;
            }
            
            const currentPoint = { x: e.offsetX, y: e.offsetY };
            
            // Draw line
            this.drawLine(lastPoint, currentPoint);
            
            // Broadcast drawing operation
            this.broadcastDrawingOperation({
                type: 'line',
                from: lastPoint,
                to: currentPoint,
                timestamp: Date.now()
            });
            
            lastPoint = currentPoint;
        });
        
        this.whiteboard.canvas.addEventListener('mouseup', () => {
            isDrawing = false;
            lastPoint = null;
        });
    }

    drawLine(from, to, style = {}) {
        const ctx = this.whiteboard.context;
        
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = style.color || '#000000';
        ctx.lineWidth = style.width || 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Store operation
        this.whiteboard.operations.push({
            type: 'line',
            from,
            to,
            style,
            timestamp: Date.now()
        });
    }

    // Voice commands integration
    async initializeVoiceCommands() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.voiceCommands.recognition = new SpeechRecognition();
            
            this.voiceCommands.recognition.continuous = true;
            this.voiceCommands.recognition.interimResults = true;
            this.voiceCommands.recognition.lang = 'fr-FR';
            
            this.voiceCommands.recognition.onresult = (event) => {
                this.handleVoiceCommand(event);
            };
            
            // Register voice commands
            this.registerVoiceCommands();
            
            console.log('🎤 Voice commands initialized');
        }
    }

    registerVoiceCommands() {
        const commands = {
            'démarrer participation': () => this.executeCommand('start_participation'),
            'arrêter participation': () => this.executeCommand('stop_participation'),
            'afficher statistiques': () => this.executeCommand('show_stats'),
            'nouveau document': () => this.executeCommand('new_document'),
            'partager écran': () => this.executeCommand('share_screen'),
            'activer tableau blanc': () => this.executeCommand('enable_whiteboard'),
            'inviter utilisateur': () => this.executeCommand('invite_user')
        };
        
        Object.entries(commands).forEach(([phrase, action]) => {
            this.voiceCommands.commands.set(phrase.toLowerCase(), action);
        });
    }

    handleVoiceCommand(event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            
            if (event.results[i].isFinal) {
                const command = this.voiceCommands.commands.get(transcript);
                if (command) {
                    console.log(`🎤 Voice command executed: ${transcript}`);
                    command();
                }
            }
        }
    }

    // Screen sharing
    async startScreenShare(userId) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            this.mediaStreams.set(`${userId}-screen`, stream);
            
            // Add screen share tracks to peer connections
            for (const [connectionId, peerConnection] of this.peerConnections) {
                if (connectionId.includes(userId)) {
                    stream.getTracks().forEach(track => {
                        peerConnection.addTrack(track, stream);
                    });
                }
            }
            
            console.log(`🖥️ Screen sharing started for user ${userId}`);
            
            return stream;
            
        } catch (error) {
            console.error('❌ Screen sharing failed:', error);
            throw error;
        }
    }

    // AI Assistant integration
    async activateAIAssistant(roomId) {
        const room = this.collaborationRooms.get(roomId);
        if (!room) return;
        
        this.aiAssistant.enabled = true;
        
        // Analyze collaboration context
        const context = await this.analyzeCollaborationContext(room);
        
        // Generate AI suggestions
        const suggestions = await this.generateAISuggestions(context);
        
        this.aiAssistant.suggestions = suggestions;
        
        // Broadcast AI suggestions
        this.broadcastToRoom(roomId, {
            type: 'ai_suggestions',
            suggestions,
            context: context.summary,
            timestamp: Date.now()
        });
        
        console.log('🤖 AI Assistant activated');
    }

    async analyzeCollaborationContext(room) {
        const analysis = {
            participants_count: room.participants.size,
            active_documents: room.documents.size,
            recent_operations: room.operations.slice(-10),
            collaboration_intensity: this.calculateCollaborationIntensity(room),
            summary: ''
        };
        
        // Generate context summary
        if (analysis.participants_count > 1) {
            analysis.summary += `${analysis.participants_count} participants actively collaborating. `;
        }
        
        if (analysis.active_documents > 0) {
            analysis.summary += `${analysis.active_documents} documents being worked on. `;
        }
        
        analysis.summary += `Collaboration intensity: ${analysis.collaboration_intensity.toFixed(2)}/10.`;
        
        return analysis;
    }

    async generateAISuggestions(context) {
        const suggestions = [];
        
        // Suggest based on collaboration patterns
        if (context.collaboration_intensity > 7) {
            suggestions.push({
                type: 'optimization',
                message: 'High activity detected. Consider organizing tasks or using voice communication.',
                action: 'organize_tasks'
            });
        }
        
        if (context.participants_count > 5) {
            suggestions.push({
                type: 'management',
                message: 'Large team detected. Consider appointing a collaboration leader.',
                action: 'appoint_leader'
            });
        }
        
        if (context.active_documents === 0) {
            suggestions.push({
                type: 'productivity',
                message: 'No active documents. Start by creating a shared document or whiteboard.',
                action: 'create_document'
            });
        }
        
        return suggestions;
    }

    // Security and encryption
    async initializeEncryption() {
        // Generate encryption keys for secure communication
        const key = await crypto.subtle.generateKey(
            {
                name: 'AES-GCM',
                length: 256
            },
            true,
            ['encrypt', 'decrypt']
        );
        
        this.encryption.keys.set('default', key);
        
        console.log('🔐 Encryption initialized');
    }

    async encryptMessage(message, keyId = 'default') {
        const key = this.encryption.keys.get(keyId);
        if (!key) {
            throw new Error(`Encryption key ${keyId} not found`);
        }
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedMessage = new TextEncoder().encode(JSON.stringify(message));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encodedMessage
        );
        
        return {
            encrypted: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv),
            keyId
        };
    }

    async decryptMessage(encryptedData) {
        const key = this.encryption.keys.get(encryptedData.keyId);
        if (!key) {
            throw new Error(`Encryption key ${encryptedData.keyId} not found`);
        }
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
            key,
            new Uint8Array(encryptedData.encrypted)
        );
        
        const message = new TextDecoder().decode(decrypted);
        return JSON.parse(message);
    }

    // Utility methods
    checkWebRTCSupport() {
        return !!(window.RTCPeerConnection && 
                 navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia);
    }

    async initializeMediaDevices() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            this.mediaStreams.set('local', stream);
            console.log('📹 Media devices initialized');
            
        } catch (error) {
            console.warn('⚠️ Media devices access denied:', error);
        }
    }

    async initializeUserFeatures(userId, room) {
        // Initialize user-specific collaboration features
        if (room.features.voice && this.mediaStreams.has('local')) {
            await this.enableVoiceForUser(userId);
        }
        
        if (room.features.ai_assistant) {
            await this.activateAIAssistant(room.id);
        }
    }

    getDefaultPermissions() {
        return {
            edit_documents: true,
            share_screen: true,
            use_whiteboard: true,
            voice_commands: true,
            invite_users: false,
            manage_room: false
        };
    }

    calculateCollaborationIntensity(room) {
        const recentOps = room.operations.filter(op => 
            Date.now() - op.timestamp < 60000  // Last minute
        );
        
        return Math.min(10, recentOps.length / 2);
    }

    findRoomForDocument(documentId) {
        for (const [roomId, room] of this.collaborationRooms) {
            if (room.documents.has(documentId)) {
                return roomId;
            }
        }
        return null;
    }

    transformOverlappingDeletes(op1, op2) {
        // Handle overlapping delete operations
        const start1 = op1.position;
        const end1 = op1.position + op1.length;
        const start2 = op2.position;
        const end2 = op2.position + op2.length;
        
        if (start1 >= end2 || start2 >= end1) {
            // No overlap
            return op1;
        }
        
        // Calculate new position and length
        const newStart = Math.max(start1, start2);
        const newEnd = Math.min(end1, end2);
        
        if (newStart >= newEnd) {
            // Complete overlap - operation is cancelled
            return { ...op1, type: 'noop' };
        }
        
        return {
            ...op1,
            position: newStart - (start2 < start1 ? Math.min(op2.length, start1 - start2) : 0),
            length: newEnd - newStart
        };
    }

    // Broadcasting and messaging
    broadcastToRoom(roomId, message) {
        const room = this.collaborationRooms.get(roomId);
        if (!room) return;
        
        const encryptedMessage = message;  // Would encrypt in production
        
        for (const participantId of room.participants) {
            this.sendToUser(participantId, encryptedMessage);
        }
    }

    sendToUser(userId, message) {
        // Find connections for this user
        for (const [connectionId, dataChannel] of this.dataChannels) {
            if (connectionId.includes(userId) && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify(message));
            }
        }
    }

    handleCollaborationMessage(message) {
        switch (message.type) {
            case 'operation_applied':
                this.handleRemoteOperation(message);
                break;
            case 'cursor_position':
                this.handleCursorUpdate(message);
                break;
            case 'drawing_operation':
                this.handleRemoteDrawing(message);
                break;
            case 'voice_command':
                this.handleRemoteVoiceCommand(message);
                break;
            default:
                console.warn(`Unknown message type: ${message.type}`);
        }
    }

    // Event handlers
    handleRemoteOperation(message) {
        const document = this.sharedDocuments.get(message.documentId);
        if (document && message.version > document.version) {
            document.content = this.applyOperationToContent(document.content, message.operation);
            document.version = message.version;
        }
    }

    handleCursorUpdate(message) {
        this.whiteboard.cursors.set(message.userId, message.position);
    }

    handleRemoteDrawing(message) {
        if (message.operation.type === 'line') {
            this.drawLine(message.operation.from, message.operation.to, message.operation.style);
        }
    }

    handleRemoteVoiceCommand(message) {
        console.log(`🎤 Remote voice command: ${message.command} from ${message.userId}`);
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 5000);
    }

    updatePerformanceMetrics() {
        for (const [connectionId, peerConnection] of this.peerConnections) {
            peerConnection.getStats().then(stats => {
                stats.forEach(report => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        this.metrics.latency.push(report.currentRoundTripTime * 1000);
                    }
                });
                
                // Keep only recent metrics
                if (this.metrics.latency.length > 100) {
                    this.metrics.latency = this.metrics.latency.slice(-50);
                }
            });
        }
    }

    updateConnectionMetrics(connectionId, peerConnection) {
        peerConnection.getStats().then(stats => {
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                    this.metrics.bandwidth.push(report.bytesReceived);
                }
            });
        });
    }

    // API methods
    getCollaborationMetrics() {
        return {
            active_rooms: this.collaborationRooms.size,
            active_connections: this.peerConnections.size,
            shared_documents: this.sharedDocuments.size,
            average_latency: this.metrics.latency.length > 0 ? 
                this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length : 0,
            operations_per_second: this.metrics.operations_per_second
        };
    }

    // Cleanup
    async leaveRoom(roomId, userId) {
        const room = this.collaborationRooms.get(roomId);
        if (room && room.participants.has(userId)) {
            room.participants.delete(userId);
            this.activeUsers.delete(userId);
            
            // Close peer connections
            for (const [connectionId, peerConnection] of this.peerConnections) {
                if (connectionId.includes(userId)) {
                    peerConnection.close();
                    this.peerConnections.delete(connectionId);
                }
            }
            
            // Broadcast user left
            this.broadcastToRoom(roomId, {
                type: 'user_left',
                userId,
                timestamp: Date.now()
            });
            
            console.log(`👋 User ${userId} left room ${roomId}`);
        }
    }

    async shutdown() {
        // Close all connections
        for (const peerConnection of this.peerConnections.values()) {
            peerConnection.close();
        }
        
        // Close media streams
        for (const stream of this.mediaStreams.values()) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        console.log('🔌 WebRTC Collaboration Engine shutdown');
    }

    // Placeholder methods for signaling (would use WebSocket in production)
    async setupSignaling(roomId) {
        console.log(`📡 Setting up signaling for room ${roomId}`);
    }

    sendSignalingMessage(userId, message) {
        console.log(`📤 Signaling message to ${userId}:`, message.type);
    }

    executeCommand(command) {
        console.log(`⚡ Executing command: ${command}`);
    }

    broadcastCursorPosition(position) {
        // Broadcast cursor position to all participants
    }

    broadcastDrawingOperation(operation) {
        // Broadcast drawing operation to all participants
    }

    async enableVoiceForUser(userId) {
        console.log(`🎤 Voice enabled for user ${userId}`);
    }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebRTCCollaborationEngine;
}

// Global instance
if (typeof window !== 'undefined') {
    window.WebRTCCollaborationEngine = WebRTCCollaborationEngine;
}
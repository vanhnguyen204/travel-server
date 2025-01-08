const { Server } = require('socket.io');
const http = require('http');

class SocketManager {
    static instance = null;
    io = null;

    // Private constructor to prevent direct instantiation
    constructor() { }

    // Get the unique instance of SocketManager
    static getInstance() {
        if (!SocketManager.instance) {
            SocketManager.instance = new SocketManager();
        }
        return SocketManager.instance;
    }

    // Initialize and configure Socket.IO
    initialize(server, options = {}) {
        if (!this.io) {
            this.io = new Server(server, {
                cors: {
                    origin: "*",
                    methods: ["GET", "POST"],
                    credentials: true,
                    ...options,
                },
            });
        }
        return this.io;
    }

    // Get the instance of Socket.IO
    getIO() {
        if (!this.io) {
            throw new Error("Socket.IO has not been initialized. Call initialize() first.");
        }
        return this.io;
    }
}

module.exports = new SocketManager()

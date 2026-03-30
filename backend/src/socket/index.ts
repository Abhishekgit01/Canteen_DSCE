import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer;

export function setupSocket(socketServer: SocketIOServer) {
  io = socketServer;

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // User joins their personal room for order updates
    socket.on('user:join', (userId: string) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined their room`);
    });

    // Subscribe to specific order updates
    socket.on('order:subscribe', (orderId: string) => {
      socket.join(`order:${orderId}`);
      console.log(`📦 Client subscribed to order ${orderId}`);
    });

    // Unsubscribe from order updates
    socket.on('order:unsubscribe', (orderId: string) => {
      socket.leave(`order:${orderId}`);
      console.log(`📦 Client unsubscribed from order ${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

export function getSocketIO(): SocketIOServer {
  return io;
}

export function emitOrderUpdate(userId: string, data: any) {
  io.to(userId).emit('order:update', data);
}

export function emitToOrder(orderId: string, event: string, data: any) {
  io.to(`order:${orderId}`).emit(event, data);
}

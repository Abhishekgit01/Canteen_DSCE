import { io, Socket } from 'socket.io-client';
import { OrderStatus } from './api';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

type OrderUpdateEvent = {
  orderId: string;
  status: OrderStatus;
  eta: number;
  message: string;
};

type EventCallbacks = {
  'order:update': (data: OrderUpdateEvent) => void;
  'order:created': (data: unknown) => void;
};

class SocketClient {
  private socket: Socket | null = null;
  private connected = false;

  connect(userId?: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: { userId },
      });

      this.socket.on('connect', () => {
        console.log('🔌 Socket connected');
        this.connected = true;
        if (userId) {
          this.socket?.emit('user:join', userId);
        }
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
        this.connected = false;
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribeToOrder(orderId: string) {
    this.socket?.emit('order:subscribe', orderId);
  }

  unsubscribeFromOrder(orderId: string) {
    this.socket?.emit('order:unsubscribe', orderId);
  }

  on<K extends keyof EventCallbacks>(event: K, callback: EventCallbacks[K]) {
    this.socket?.on(event as string, callback as any);
  }

  off<K extends keyof EventCallbacks>(event: K, callback?: EventCallbacks[K]) {
    this.socket?.off(event as string, callback as any);
  }
}

export const socketClient = new SocketClient();

import { io, Socket } from 'socket.io-client';
import { API_BASE } from './index';
import { useAuthStore } from '../stores/authStore';
import { useOrderStore } from '../stores/orderStore';

const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

let socket: Socket | null = null;
let activeToken: string | null = null;

export const connectSocket = (token: string) => {
  if (socket && activeToken === token) {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket?.disconnect();
  activeToken = token;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
    socket?.emit('join');

    const role = useAuthStore.getState().user?.role;
    if (role && role !== 'student') {
      socket?.emit('join:staff');
    }
  });

  socket.on('order:paid', ({ orderId, qrToken }: { orderId: string; qrToken: string }) => {
    useOrderStore.getState().updateOrder(orderId, { status: 'paid', qrToken });
  });

  socket.on('order:failed', ({ orderId }: { orderId: string }) => {
    useOrderStore.getState().updateOrder(orderId, { status: 'failed' });
  });

  socket.on('order:updated', ({ orderId, status }: { orderId: string; status: string }) => {
    useOrderStore.getState().updateOrder(orderId, { status: status as any });
  });

  socket.on('order:fulfilled', ({ orderId }: { orderId: string }) => {
    useOrderStore.getState().updateOrder(orderId, { status: 'fulfilled' });
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  activeToken = null;
};

export const getSocket = () => socket;

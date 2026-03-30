import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

let socket: ReturnType<typeof io> | null = null;

export const connectSocket = (token: string) => {
  socket = io('http://localhost:3001', {
    auth: { token },
  });
  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const getSocket = () => socket;

export const joinRoom = (userId: string) => {
  socket?.emit('join', userId);
};

export const subscribeToOrder = (orderId: string) => {
  socket?.emit('subscribeOrder', orderId);
};

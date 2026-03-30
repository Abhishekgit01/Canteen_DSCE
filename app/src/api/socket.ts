import { io, Socket } from 'socket.io-client';
import { API_BASE } from './index';
import { useAuthStore } from '../stores/authStore';

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
  });

  socket.on('connect', () => {
    socket?.emit('join');

    const role = useAuthStore.getState().user?.role;
    if (role && role !== 'student') {
      socket?.emit('join:staff');
    }
  });

  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  activeToken = null;
};

export const getSocket = () => socket;

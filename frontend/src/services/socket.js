import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinUser(userId) {
  const s = connectSocket();
  s.emit('join:user', userId);
}

export function joinStaff() {
  const s = connectSocket();
  s.emit('join:staff');
}

export function onSessionStarted(callback) {
  const s = connectSocket();
  s.on('session:started', callback);
  return () => s.off('session:started', callback);
}

export function onSessionEnded(callback) {
  const s = connectSocket();
  s.on('session:ended', callback);
  return () => s.off('session:ended', callback);
}

export function onSessionOvertime(callback) {
  const s = connectSocket();
  s.on('session:overtime', callback);
  return () => s.off('session:overtime', callback);
}

export function onSessionAlert15Min(callback) {
  const s = connectSocket();
  s.on('session:alert-15min', callback);
  return () => s.off('session:alert-15min', callback);
}

export function onSessionTimer(callback) {
  const s = connectSocket();
  s.on('session:timer', callback);
  return () => s.off('session:timer', callback);
}

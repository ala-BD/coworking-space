const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

let io = null;

function initSocket(server, supabaseUrl, supabaseServiceKey) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connecté : ${socket.id}`);

    socket.on('join:user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`👤 Socket ${socket.id} rejoint user:${userId}`);
      }
    });

    socket.on('join:staff', () => {
      socket.join('staff');
      console.log(`🏢 Socket ${socket.id} rejoint staff`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket déconnecté : ${socket.id}`);
    });
  });

  console.log('✅ Socket.io initialisé.');
  return io;
}

function getIO() {
  return io;
}

function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

function emitToStaff(event, data) {
  if (io) io.to('staff').emit(event, data);
}

function emitSessionStarted(sessionData) {
  emitToUser(sessionData.user_id, 'session:started', sessionData);
  emitToStaff('session:started', sessionData);
}

function emitSessionEnded(sessionData) {
  emitToUser(sessionData.user_id, 'session:ended', sessionData);
  emitToStaff('session:ended', sessionData);
}

function emitSessionOvertime(sessionData) {
  emitToUser(sessionData.user_id, 'session:overtime', sessionData);
  emitToStaff('session:overtime', sessionData);
}

function emitSessionAlert15Min(sessionData) {
  emitToUser(sessionData.user_id, 'session:alert-15min', sessionData);
  emitToStaff('session:alert-15min', sessionData);
}

function emitTimerUpdate(userId, timerData) {
  emitToUser(userId, 'session:timer', timerData);
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToStaff,
  emitSessionStarted,
  emitSessionEnded,
  emitSessionOvertime,
  emitSessionAlert15Min,
  emitTimerUpdate,
};

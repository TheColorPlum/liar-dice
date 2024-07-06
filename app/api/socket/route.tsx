import { Server as SocketIOServer } from 'socket.io';
import type { NextApiRequest } from 'next';
import type { Socket as SocketIOSocket } from 'socket.io';

export function GET(req: NextApiRequest, res: any) {
  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server...');
    const io = new SocketIOServer(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket: SocketIOSocket) => {
      console.log('New client connected');

      socket.on('message', (message: string) => {
        console.log('Message received:', message);
        const data = JSON.parse(message);
        // Handle different types of messages here
        // Broadcast updates to all clients
        io.emit('message', data);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });
  }

  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};
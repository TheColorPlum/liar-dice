import { Server } from 'ws';

export function GET(req: Request) {
  if (!(req as any).socket.server.wss) {
    console.log('Socket is initializing');
    const wss = new Server({ noServer: true });
    (req as any).socket.server.wss = wss;

    wss.on('connection', (ws) => {
      ws.on('message', (message: string) => {
        const data = JSON.parse(message);
        // Handle different types of messages here
        // Broadcast updates to all clients
        wss.clients.forEach((client) => {
          client.send(JSON.stringify(data));
        });
      });
    });
  }

  return new Response('WebSocket server is running', { status: 200 });
}
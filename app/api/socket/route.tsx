import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';

export function GET(req: Request) {
  if (!(req as any).socket.server.wss) {
    const wss = new WebSocketServer({ noServer: true });
    (req as any).socket.server.wss = wss;

    wss.on('connection', (ws: WSWebSocket) => {
      ws.on('message', (message: WSWebSocket.RawData) => {
        const data = JSON.parse(message.toString());
        // Handle different types of messages here
        // Broadcast updates to all clients
        wss.clients.forEach((client) => {
          if (client.readyState === WSWebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      });
    });
  }

  return new Response('WebSocket server is running', { status: 200 });
}
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return NextResponse.json({ message: "WebSocket server is running" }, { status: 200 });
}
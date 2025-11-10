import { Response } from "express";
import Log from "../components/loger.js";
import { startConsoleStr } from "../config.js";

interface Client {
  id: number;
  res: Response;
  closed: boolean;
  levels?: Set<string>; // reserved for potential future filtering
}

let clientSeq = 0;
const clients: Client[] = [];

setInterval(async ()=>{
  clients.forEach((client) => {
    if (client.closed) return;
    try {
      client.res.write(`: hb ${Date.now()}\n\n`);
    } catch {
      client.closed = true;
    }
  })
},8000)

export function logConnHeartbeat() {
  if (clients.length === 0) return;
  const now = Date.now();
  for (const c of [...clients]) {
    if (c.closed) continue;
    try {
      c.res.write(`: hb ${now}\n\n`);
    } catch {
      c.closed = true;
    }
  }
  cleanup();
}

function cleanup() {
  if (clients.length === 0) return;
  for (let i = clients.length - 1; i >= 0; i--) {
    if (clients[i].closed) clients.splice(i, 1);
  }
  if(clients.length === 0){
    Log.setDebugMode(false)
  }
}

export function addLogClient(res: Response) {
  Log.setDebugMode(true)
  const client: Client = { id: ++clientSeq, res, closed: false };
  clients.push(client);
  res.on("close", () => {
    client.closed = true;
  });
  res.write(`: connected ${client.id}\n`);
  res.write(`event: ready\n`);
  res.write(`data: {"id":${client.id}}\n\n`);
  publishLogEvent(`info`, startConsoleStr)
}

export interface PublishLogEvent {
  level: string;
  message: string;
  time: string;
  ts: number;
}

export function publishLogEvent(level: string, message: string) {
  if (clients.length === 0) return; // nobody listening, drop
  // Defer actual writes to avoid blocking caller
  setImmediate(() => {
    if (clients.length === 0) {
      return;
    }
    const evt: PublishLogEvent = {
      level,
      message,
      time: new Date().toISOString(),
      ts: Date.now(),
    };
    const serialized = JSON.stringify(evt);
    for (const c of [...clients]) {
      if (c.closed) continue;
      try {
        c.res.write(`event: log\n`);
        c.res.write(`data: ${serialized}\n\n`);
      } catch {
        c.closed = true;
      }
    }
    cleanup();
  });
}


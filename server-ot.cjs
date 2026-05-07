#!/usr/bin/env node
/**
 * Variant D — Operational Transformation WebSocket Server
 *
 * Replaces server.cjs for Variant D. Clients connect via WebSocket and
 * submit operations together with their last-seen revision number. The server
 * transforms incoming ops against any ops applied since that revision, applies
 * the (possibly no-op'd) op, and broadcasts the result to all connected clients.
 *
 * Protocol (JSON over WebSocket):
 *   Client → Server:  { type: 'submit',        op: OTOperation }
 *   Client → Server:  { type: 'sync_request',  clientId: string }
 *   Server → Client:  { type: 'op',            op: ServerOperation }
 *   Server → Client:  { type: 'sync_response', revision: number, objects: SceneObject[] }
 *
 * Usage:  node server-ot.cjs
 *         PORT=1234 node server-ot.cjs
 */

'use strict';

const WebSocket = require('ws');
const http      = require('http');

const PORT = process.env.PORT || 1234;

// ---------------------------------------------------------------------------
// Transform function (mirrors src/collaboration/variants/variant-d.ts)
// ---------------------------------------------------------------------------

function transform(op1, op2) {
  if (op1.type === 'noop') return op1;

  if (op1.type === 'setProperty' && op2.type === 'setProperty'
      && op1.id === op2.id && op1.property === op2.property) {
    return { ...op1, type: 'noop' };
  }

  if (op1.type === 'setProperty' && op2.type === 'delete' && op1.id === op2.id) {
    return { ...op1, type: 'noop' };
  }

  if (op1.type === 'delete' && op2.type === 'delete' && op1.id === op2.id) {
    return { ...op1, type: 'noop' };
  }

  if (op1.type === 'reparent' && op2.type === 'delete' && op1.newParentId === op2.id) {
    return { ...op1, newParentId: null };
  }

  if (op1.type === 'reparent' && op2.type === 'reparent' && op1.id === op2.id) {
    return { ...op1, type: 'noop' };
  }

  return op1;
}

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

/** @type {Map<string, { log: any[], state: Map<string, any>, conns: Set<WebSocket> }>} */
const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) {
    rooms.set(name, {
      log:   [],         // ServerOperation[]
      state: new Map(),  // id → SceneObject
      conns: new Set(),
    });
  }
  return rooms.get(name);
}

function applyToState(state, op) {
  switch (op.type) {
    case 'create':
      if (op.object) state.set(op.id, { ...op.object });
      break;
    case 'delete':
      state.delete(op.id);
      break;
    case 'setProperty': {
      const obj = state.get(op.id);
      if (obj && op.property !== undefined) obj[op.property] = op.value;
      break;
    }
    case 'reparent': {
      const child = state.get(op.id);
      if (!child) break;
      if (child.parentId) {
        const old = state.get(child.parentId);
        if (old) old.childIds = (old.childIds || []).filter(id => id !== op.id);
      }
      child.parentId = op.newParentId ?? null;
      if (op.newParentId) {
        const np = state.get(op.newParentId);
        if (np) {
          if (!np.childIds) np.childIds = [];
          if (!np.childIds.includes(op.id)) np.childIds = [...np.childIds, op.id];
        }
      }
      break;
    }
    case 'noop':
      break;
  }
}

function send(conn, payload) {
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(JSON.stringify(payload));
  }
}

// ---------------------------------------------------------------------------
// HTTP + WS server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OT WebSocket Server (Variant D) is running\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  const roomName = req.url.slice(1).split('?')[0] || 'default';
  console.log(`[OT] Client connected to room: ${roomName}`);

  const room = getRoom(roomName);
  room.conns.add(conn);

  conn.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'sync_request') {
      // Send current state snapshot
      send(conn, {
        type:     'sync_response',
        revision: room.log.length,
        objects:  Array.from(room.state.values()),
      });
      return;
    }

    if (msg.type === 'submit') {
      const incomingOp = msg.op;
      if (!incomingOp || typeof incomingOp.clientRevision !== 'number') return;

      const missed = room.log.slice(incomingOp.clientRevision);
      let transformed = { ...incomingOp };
      for (const missedOp of missed) {
        transformed = transform(transformed, missedOp);
      }

      const serverRevision = room.log.length + 1;
      const serverOp = { ...transformed, serverRevision };
      room.log.push(serverOp);
      applyToState(room.state, serverOp);

      // Broadcast to all clients
      room.conns.forEach(c => send(c, { type: 'op', op: serverOp }));
      return;
    }
  });

  conn.on('close', () => {
    console.log(`[OT] Client disconnected from room: ${roomName}`);
    room.conns.delete(conn);
  });
});

server.listen(PORT, () => {
  console.log(`OT WebSocket server (Variant D) running on ws://localhost:${PORT}`);
});

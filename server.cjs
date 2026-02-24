#!/usr/bin/env node

/**
 * Y.js WebSocket Server
 * Run this server to enable real-time collaboration between multiple users.
 * 
 * Usage: node server.cjs
 * 
 * The server will run on port 1234 by default.
 */

const WebSocket = require('ws');
const http = require('http');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

const PORT = process.env.PORT || 1234;

// Store documents by room name
const docs = new Map();

const messageSync = 0;
const messageAwareness = 1;

const getYDoc = (docName) => {
  if (!docs.has(docName)) {
    const doc = new Y.Doc();
    docs.set(docName, {
      doc,
      conns: new Set(),
      awareness: new awarenessProtocol.Awareness(doc)
    });
  }
  return docs.get(docName);
};

const send = (conn, message) => {
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(message, (err) => {
      if (err) console.error(err);
    });
  }
};

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Y.js WebSocket Server is running\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  // Extract room name from URL (e.g., /scene-room)
  const docName = req.url.slice(1).split('?')[0] || 'default';
  console.log(`New client connected to room: ${docName}`);
  
  const { doc, conns, awareness } = getYDoc(docName);
  conns.add(conn);

  conn.on('message', (message) => {
    const decoder = decoding.createDecoder(new Uint8Array(message));
    const messageType = decoding.readVarUint(decoder);
    
    switch (messageType) {
      case messageSync: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);
        if (syncMessageType !== syncProtocol.messageYjsSyncStep1) {
          // Broadcast to all other clients
          const msg = encoding.toUint8Array(encoder);
          if (encoding.length(encoder) > 1) {
            conns.forEach((c) => {
              if (c !== conn) send(c, msg);
            });
          }
        }
        if (encoding.length(encoder) > 1) {
          send(conn, encoding.toUint8Array(encoder));
        }
        break;
      }
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          awareness,
          decoding.readVarUint8Array(decoder),
          conn
        );
        break;
      }
    }
  });

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(conn, encoding.toUint8Array(encoder));

  // Listen for document updates and broadcast
  const updateHandler = (update, origin) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    conns.forEach((c) => {
      if (c !== origin) send(c, msg);
    });
  };
  doc.on('update', updateHandler);

  // Listen for awareness updates
  const awarenessHandler = ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated).concat(removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, 
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const msg = encoding.toUint8Array(encoder);
    conns.forEach((c) => send(c, msg));
  };
  awareness.on('update', awarenessHandler);

  conn.on('close', () => {
    console.log(`Client disconnected from room: ${docName}`);
    conns.delete(conn);
    doc.off('update', updateHandler);
    awareness.off('update', awarenessHandler);
  });
});

server.listen(PORT, () => {
  console.log(`Y.js WebSocket server running on ws://localhost:${PORT}`);
  console.log('Clients can now connect and collaborate in real-time!');
});

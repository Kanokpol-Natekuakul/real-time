import express from 'express';
import dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './middleware/auth';
import { db } from './firebaseAdmin';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as Y from 'yjs';
import { WebSocketServer } from 'ws';
// @ts-ignore
import { setupWSConnection } from 'y-websocket/bin/utils';
import { setupYjsPersistence } from './yjsPersistence';

dotenv.config();

export const app = express();
// Render terminates TLS at its proxy; trust it so req.ip is the real client IP
// (otherwise every user shares one rate-limit bucket keyed on the proxy IP)
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// A single failed Firestore write must not take down every websocket connection
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

const createDocLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many documents created from this IP, please try again later.'
});

const saveVersionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many versions saved from this IP, please try again later.'
});

app.use('/api', globalLimiter);

// Initialize Yjs persistence with Firestore
setupYjsPersistence();

const server = http.createServer(app);

// Keep Socket.io for presence/other features if needed
export const io = new Server(server, { 
  cors: { origin: '*' },
  destroyUpgrade: false 
});

io.on('connection', (socket) => {
  socket.on('join-document', ({ documentId }) => {
    socket.join(`doc:${documentId}`);
  });
  
  socket.on('leave-document', ({ documentId }) => {
    socket.leave(`doc:${documentId}`);
  });
});

// Add standard WebSocket server for y-websocket on the same server
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req);
});

// Route upgrade requests between Socket.IO and Yjs
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;
  // Socket.IO handles its own upgrades natively because it's attached to 'server'
  if (pathname && pathname.startsWith('/socket.io')) {
    return;
  }
  // Let y-websocket handle other paths (e.g. document IDs)
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get all documents for the logged in user
app.get('/api/documents', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ownerId = req.user?.uid;
    let snapshot;
    
    if (req.query.shared === 'true') {
      snapshot = await db.collection('documents').get();
    } else {
      snapshot = await db.collection('documents')
        .where('ownerId', '==', ownerId)
        .get();
    }
      
    const docs = snapshot.docs.map((doc: any) => {
      // content (full Yjs state) and versions (every HTML snapshot) are far too
      // heavy for a list response — keep them out of the payload
      const { content, versions, updatedAt, ...docData } = doc.data();
      let contentPreview = '';
      if (content) {
        const ydoc = new Y.Doc();
        try {
          Y.applyUpdate(ydoc, Buffer.from(content, 'base64'));
          const xml = ydoc.getXmlFragment('default');
          const html = xml.toString();
          contentPreview = html.replace(/<[^>]*>?/gm, '').substring(0, 200);
        } catch (e) {
          contentPreview = '';
        } finally {
          ydoc.destroy();
        }
      }
      return {
        _id: doc.id,
        ...docData,
        updatedAt: updatedAt?.toDate ? updatedAt.toDate().toISOString() : updatedAt ?? null,
        contentPreview
      };
    }).sort((a: any, b: any) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
    
    res.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Create a new document
app.post('/api/documents', requireAuth, createDocLimiter, async (req: AuthRequest, res) => {
  try {
    const ownerId = req.user?.uid;
    const newDocRef = db.collection('documents').doc();
    const newDoc = {
      title: 'Untitled Document',
      ownerId,
      updatedAt: new Date()
    };
    await newDocRef.set(newDoc);
    res.json({ _id: newDocRef.id, ...newDoc });
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Get a single document (for loading the title)
app.get('/api/documents/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const docRef = db.collection('documents').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Document not found' });
    res.json({ _id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Update document title
app.put('/api/documents/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const docRef = db.collection('documents').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Document not found' });
    
    await docRef.update({ title, updatedAt: new Date() });
    res.json({ _id: docSnap.id, ...docSnap.data(), title });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete a document (Only owner can delete)
app.delete('/api/documents/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const docRef = db.collection('documents').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Document not found' });
    
    const data = docSnap.data();
    if (data?.ownerId !== req.user?.uid) {
      return res.status(403).json({ error: 'Only the owner can delete this document' });
    }

    await docRef.delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Save a document version
app.post('/api/documents/:id/versions', requireAuth, saveVersionLimiter, async (req: AuthRequest, res) => {
  try {
    const { html } = req.body;
    const docRef = db.collection('documents').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Document not found' });
    
    const data = docSnap.data();
    if (data?.ownerId !== req.user?.uid) return res.status(403).json({ error: 'Forbidden' });
    
    const versions = data?.versions || [];
    versions.push({ timestamp: new Date().toISOString(), data: html || '' });
    
    await docRef.update({ versions, updatedAt: new Date() });
    res.json({ success: true, versions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save version' });
  }
});

// Get document versions
app.get('/api/documents/:id/versions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const docRef = db.collection('documents').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Document not found' });
    
    const data = docSnap.data();
    res.json(data?.versions || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// GET /api/documents/:id/comments
app.get('/api/documents/:id/comments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const snapshot = await db.collection('documents').doc(req.params.id).collection('comments').orderBy('createdAt', 'asc').get();
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/documents/:id/comments
app.post('/api/documents/:id/comments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body;
    const { uid, name, picture } = req.user as any;
    const newComment = {
      text,
      userId: uid,
      userName: name || 'Anonymous',
      userPhoto: picture || '',
      createdAt: new Date().toISOString()
    };
    const docRef = await db.collection('documents').doc(req.params.id).collection('comments').add(newComment);
    const commentData = { id: docRef.id, ...newComment };
    io.to(`doc:${req.params.id}`).emit('new-comment', commentData);
    res.json(commentData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// DELETE /api/documents/:id/comments/:commentId
app.delete('/api/documents/:id/comments/:commentId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const commentRef = db.collection('documents').doc(req.params.id).collection('comments').doc(req.params.commentId);
    const commentSnap = await commentRef.get();
    if (!commentSnap.exists) return res.status(404).json({ error: 'Not found' });
    if (commentSnap.data()?.userId !== req.user?.uid) return res.status(403).json({ error: 'Forbidden' });
    
    await commentRef.delete();
    io.to(`doc:${req.params.id}`).emit('delete-comment', req.params.commentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

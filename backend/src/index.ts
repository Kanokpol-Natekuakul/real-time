import express from 'express';
import dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './middleware/auth';
import { db } from './firebaseAdmin';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { WebSocketServer } from 'ws';
// @ts-ignore
import { setupWSConnection } from 'y-websocket/bin/utils';
import { setupYjsPersistence } from './yjsPersistence';

dotenv.config();

export const app = express();
app.use(cors());
app.use(express.json());

// Initialize Yjs persistence with Firestore
setupYjsPersistence();

const server = http.createServer(app);

// Keep Socket.io for presence/other features if needed
export const io = new Server(server, { cors: { origin: '*' } });

// Add standard WebSocket server for y-websocket on the same server
const wss = new WebSocketServer({ server });
wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req);
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get all documents for the logged in user
app.get('/api/documents', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ownerId = req.user?.uid;
    const snapshot = await db.collection('documents')
      .where('ownerId', '==', ownerId)
      // Note: Firestore requires an index for ordering with where(), or we can just sort in memory for simplicity
      .get();
      
    const docs = snapshot.docs.map((doc: any) => ({
      _id: doc.id,
      ...doc.data()
    })).sort((a: any, b: any) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
    
    res.json(docs);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Create a new document
app.post('/api/documents', requireAuth, async (req: AuthRequest, res) => {
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
app.post('/api/documents/:id/versions', requireAuth, async (req: AuthRequest, res) => {
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

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

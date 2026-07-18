import * as Y from 'yjs';
import { db } from './firebaseAdmin';
// @ts-ignore
import { setPersistence } from 'y-websocket/bin/utils';

export const setupYjsPersistence = () => {
  setPersistence({
    bindState: async (docName: string, ydoc: Y.Doc) => {
      // Load document from Firestore
      const docRef = db.collection('documents').doc(docName);
      const docSnap = await docRef.get();
      if (docSnap.exists && docSnap.data()?.content) {
        // Apply existing state to ydoc
        const binaryState = Buffer.from(docSnap.data()!.content, 'base64');
        Y.applyUpdate(ydoc, binaryState);
      }
      
      // Save to Firestore on every update
      ydoc.on('update', async (update: Uint8Array) => {
        const base64Update = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
        await docRef.set({
          content: base64Update,
          updatedAt: new Date()
        }, { merge: true });
      });
    },
    writeState: async (docName: string, ydoc: Y.Doc) => {
      // Called when the document is destroyed / all clients disconnect
      const base64Update = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
      const docRef = db.collection('documents').doc(docName);
      await docRef.set({
        content: base64Update,
        updatedAt: new Date()
      }, { merge: true });
    }
  });
};

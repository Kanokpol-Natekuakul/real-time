import * as Y from 'yjs';
import { db } from './firebaseAdmin';
// @ts-ignore
import { setPersistence } from 'y-websocket/bin/utils';

// Writing on every Yjs update means a Firestore write per keystroke batch,
// which burns through quota and hits the 1 write/sec/doc limit. Debounce so a
// doc is saved at most once per interval; writeState still flushes on close.
const SAVE_DEBOUNCE_MS = 2000;

const saveDoc = async (docName: string, ydoc: Y.Doc) => {
  // Never let a failed write escape as an unhandled rejection — that would
  // crash the process and close every client connection
  try {
    const base64Update = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
    await db.collection('documents').doc(docName).set({
      content: base64Update,
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error(`Failed to save document ${docName}:`, error);
  }
};

export const setupYjsPersistence = () => {
  setPersistence({
    bindState: async (docName: string, ydoc: Y.Doc) => {
      // Load document from Firestore
      try {
        const docRef = db.collection('documents').doc(docName);
        const docSnap = await docRef.get();
        if (docSnap.exists && docSnap.data()?.content) {
          // Apply existing state to ydoc
          const binaryState = Buffer.from(docSnap.data()!.content, 'base64');
          Y.applyUpdate(ydoc, binaryState);
        }
      } catch (error) {
        console.error(`Failed to load document ${docName}:`, error);
      }

      let saveTimeout: NodeJS.Timeout | null = null;
      ydoc.on('update', () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveTimeout = null;
          void saveDoc(docName, ydoc);
        }, SAVE_DEBOUNCE_MS);
      });
      ydoc.on('destroy', () => {
        if (saveTimeout) clearTimeout(saveTimeout);
      });
    },
    writeState: async (docName: string, ydoc: Y.Doc) => {
      // Called when the document is destroyed / all clients disconnect
      await saveDoc(docName, ydoc);
    }
  });
};

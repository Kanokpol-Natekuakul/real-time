import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require(serviceAccountPath);
  }
} catch (error) {
  console.error("Failed to load serviceAccountKey.json at", serviceAccountPath);
  console.error("Please place the serviceAccountKey.json file in the backend/ folder.");
  process.exit(1);
}

const app = getApps().length === 0 
  ? initializeApp({ credential: cert(serviceAccount) }) 
  : getApp();

export const db = getFirestore(app);

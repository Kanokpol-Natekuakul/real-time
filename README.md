# Real-Time Collaborative Editor

A production-ready, real-time collaborative text editor built with modern web technologies. This project allows multiple users to edit the same document simultaneously, see each other's live cursors and avatars, and securely save their documents to the cloud.

## ✨ Features
* **Real-Time Collaboration**: Instant text synchronization across multiple clients using Yjs and WebSockets.
* **Live Presence**: See who is currently viewing/editing the document with Google profile picture avatars and multi-colored cursors.
* **Rich Text Formatting**: A glassmorphism toolbar supporting Bold, Italic, Strikethrough, Bullet Lists, and Ordered Lists (powered by Tiptap).
* **Document Management Dashboard**: A sleek dark-mode hub to view, create, and delete your personal documents.
* **Version History (Time Travel)**: Save document snapshots and restore previous versions with ease.
* **Export Options**: Export documents to PDF or plain TXT format.
* **Secure Authentication**: Google Sign-In integration via Firebase Authentication.
* **Public Link Sharing**: One-click shareable links allow anyone with the link to jump in and collaborate.
* **Persistent Storage**: All keystrokes and document titles are securely backed up in real-time to MongoDB.

## 🛠️ Tech Stack
* **Frontend**: React (Vite), TypeScript, Tiptap, Yjs, Firebase Auth, React Router, Lucide Icons.
* **Backend**: Node.js, Express, `y-websocket`, Mongoose (MongoDB), Firebase Admin SDK.

## 🚀 Getting Started (Local Development)

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd real-time
```

### 2. Setup Environment Variables
Both the frontend and backend require configuration files. We have provided `.env.example` files in both directories.

**Frontend:**
```bash
cd frontend
cp .env.example .env
```
Fill in your Firebase Project credentials in the `.env` file.

**Backend:**
```bash
cd ../backend
cp .env.example .env
```
Fill in your MongoDB connection string in the `.env` file. 
*Note: You also need to download your `serviceAccountKey.json` from the Firebase Console (Project Settings > Service Accounts) and place it in the `backend/` folder.*

### 3. Install Dependencies
```bash
# In the backend folder
npm install

# In the frontend folder
npm install
```

### 4. Run the Servers
Open two terminal windows:
```bash
# Terminal 1: Start the Backend (Runs on http://localhost:3001)
cd backend
npm start

# Terminal 2: Start the Frontend (Runs on http://localhost:5173)
cd frontend
npm run dev
```

---

## ☁️ Deployment Guide

This project is structured to be easily deployed to modern serverless platforms.

### Frontend ➡️ Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize hosting in the `frontend` directory: `firebase init hosting` (Choose your project, set public directory to `dist`).
4. Build the project: `npm run build`
5. Deploy: `firebase deploy --only hosting`

### Backend ➡️ Google Cloud Run
Since the backend uses WebSockets, Cloud Run is an excellent choice as it natively supports WebSocket traffic.
1. Create a `Dockerfile` in the `backend` directory.
2. Ensure your backend reads the `PORT` environment variable (already configured).
3. Use Google Cloud CLI to submit the build:
   `gcloud run deploy realtime-backend --source . --port 3001 --allow-unauthenticated`
4. Update the `ws://localhost:3001` URLs in your frontend code to point to your new Cloud Run URL (`wss://your-cloud-run-url.run.app`).

---

## 🔮 Next Steps & Future Scaling

If you plan to scale this application for thousands of concurrent users, consider implementing the following:

1. **Horizontal Scaling with Redis**: Currently, WebSockets are handled in-memory by a single Node.js instance. To run multiple backend instances on Cloud Run, integrate a Redis adapter (e.g., `y-redis`) to sync document states across multiple servers.
2. **Offline Support**: Integrate `y-indexeddb` on the frontend. This will cache edits locally if the user loses internet connection, and automatically sync them to the server when the connection is restored.
3. **Finer Access Control**: Update the sharing mechanism from "Public Links" to "Invite via Email", allowing the backend to strictly verify `ownerId` and `collaboratorIds` before granting WebSocket access.

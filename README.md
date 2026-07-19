# Real-Time Collaborative Editor

A production-ready, real-time collaborative text editor built with modern web technologies. This project allows multiple users to edit the same document simultaneously, see each other's live cursors and avatars, and securely save their documents to the cloud.

## ✨ Features
* **Real-Time Collaboration**: Instant text synchronization across multiple clients using Yjs and WebSockets.
* **Live Presence**: See who is currently viewing/editing the document with Google profile picture avatars and multi-colored cursors.
* **Rich Text Formatting**: A glassmorphism toolbar supporting Bold, Italic, Strikethrough, Bullet/Ordered Lists, Task Lists, Tables, Text Alignment, Highlighting, and Image Uploads via Firebase Storage.
* **Document Management Dashboard**: A sleek dark-mode hub to view, create, search (with content preview), and delete your personal documents.
* **Real-Time Comments**: Contextual sidebar comments to discuss changes with your collaborators in real-time.
* **Version History (Time Travel)**: Save document snapshots and restore previous versions with ease.
* **Export Options**: Export documents to PDF or plain TXT format.
* **Secure Authentication**: Google Sign-In integration via Firebase Authentication.
* **Public Link Sharing**: One-click shareable links allow anyone with the link to jump in and collaborate.
* **Persistent Storage & Security**: All keystrokes and document titles are securely backed up in real-time to Firestore. Rate limiting protects the API from abuse.

## 🛠️ Tech Stack
* **Frontend**: React (Vite), TypeScript, Tiptap, Yjs, Firebase Auth, React Router, Lucide Icons.
* **Backend**: Node.js, Express, `y-websocket`, Firebase Admin SDK (Firestore for Database).

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
*Note: You need to download your `serviceAccountKey.json` from the Firebase Console (Project Settings > Service Accounts) and place it in the `backend/` folder.*

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

This project is configured to be easily deployed to modern serverless platforms.

### Frontend ➡️ Firebase Hosting
1. Update `.env` with your backend URL (`VITE_API_URL` and `VITE_WS_URL`).
2. Build the project: `npm run build`
3. Deploy: `firebase deploy`

### Backend ➡️ Render.com
1. Connect your GitHub repository to [Render.com](https://render.com).
2. Create a new **Web Service**.
3. Set the Root Directory to `backend`.
4. Set Build Command to `npm install && npm run build` and Start Command to `npm start`.
5. Add your `FIREBASE_SERVICE_ACCOUNT` json string as an environment variable (Be careful with quotes and newlines to ensure it parses correctly).
6. Deploy!

---

## 🔮 Next Steps & Future Scaling

If you plan to scale this application for thousands of concurrent users, consider implementing the following:

1. **Horizontal Scaling with Redis**: Currently, WebSockets are handled in-memory by a single Node.js instance. To run multiple backend instances, integrate a Redis adapter (e.g., `y-redis`) to sync document states across multiple servers.
2. **Finer Access Control**: Update the sharing mechanism from "Public Links" to "Invite via Email", allowing the backend to strictly verify `ownerId` and `collaboratorIds` before granting WebSocket access.

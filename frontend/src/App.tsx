// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Editor } from './components/Editor';
import { Dashboard } from './components/Dashboard';
import { Toaster } from 'react-hot-toast';
import './App.css';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <div style={{ padding: '2rem' }}>Please login to continue.</div>;
  return <>{children}</>;
};

const MainApp = () => {
  const { currentUser, loginWithGoogle, logout } = useAuth();

  return (
    <BrowserRouter>
      <div className="App" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
        <header style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Real-time Collab</h1>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>{currentUser.displayName}</span>
              <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
            </div>
          ) : (
            <button onClick={loginWithGoogle} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Login with Google</button>
          )}
        </header>
        
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/document/:id" element={<ProtectedRoute>{currentUser && <Editor />}</ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

function App() {
  return (
    <AuthProvider>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          },
        }}
      />
      <MainApp />
    </AuthProvider>
  );
}

export default App;

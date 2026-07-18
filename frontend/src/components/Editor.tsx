import { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Strikethrough, List, ListOrdered, Share2, History, Download, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import html2pdf from 'html2pdf.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const colors = ['#958DF1', '#F98181', '#FBCE76', '#8AF366', '#8B94F7'];

const MenuBar = ({ editor, onSaveVersion, onShowHistory, onExportPDF, onExportTXT }: any) => {
  if (!editor) return null;

  const btnStyle = (isActive: boolean) => ({
    background: isActive ? 'var(--bg-surface-hover)' : 'transparent',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none',
    padding: 'var(--space-2)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s'
  });

  return (
    <div className="editor-toolbar-container" style={{ 
      display: 'flex', padding: 'var(--space-2)', 
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky', top: 0, zIndex: 10
    }}>
      <div className="editor-toolbar" style={{ display: 'flex', gap: 'var(--space-1)', margin: '0 auto', width: '100%', maxWidth: '65ch' }}>
        <button 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          style={btnStyle(editor.isActive('bold'))}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = editor.isActive('bold') ? 'var(--text-primary)' : 'var(--text-secondary)'}
        ><Bold size={16} /></button>
        <button 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          style={btnStyle(editor.isActive('italic'))}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = editor.isActive('italic') ? 'var(--text-primary)' : 'var(--text-secondary)'}
        ><Italic size={16} /></button>
        <button 
          onClick={() => editor.chain().focus().toggleStrike().run()} 
          style={btnStyle(editor.isActive('strike'))}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = editor.isActive('strike') ? 'var(--text-primary)' : 'var(--text-secondary)'}
        ><Strikethrough size={16} /></button>
        <div style={{ width: '1px', background: 'var(--border-subtle)', margin: '0 var(--space-2)' }}></div>
        <button 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          style={btnStyle(editor.isActive('bulletList'))}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = editor.isActive('bulletList') ? 'var(--text-primary)' : 'var(--text-secondary)'}
        ><List size={16} /></button>
        <button 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          style={btnStyle(editor.isActive('orderedList'))}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = editor.isActive('orderedList') ? 'var(--text-primary)' : 'var(--text-secondary)'}
        ><ListOrdered size={16} /></button>

        <div style={{ flex: 1 }}></div>
        <button onClick={onSaveVersion} style={btnStyle(false)} title="Save Version"><Save size={16} /></button>
        <button onClick={onShowHistory} style={btnStyle(false)} title="History"><History size={16} /></button>
        <div style={{ width: '1px', background: 'var(--border-subtle)', margin: '0 var(--space-2)' }}></div>
        <button onClick={onExportPDF} style={btnStyle(false)} title="Export PDF"><Download size={16} /> <span style={{fontSize:'12px', marginLeft:'4px'}}>PDF</span></button>
        <button onClick={onExportTXT} style={btnStyle(false)} title="Export TXT"><Download size={16} /> <span style={{fontSize:'12px', marginLeft:'4px'}}>TXT</span></button>
      </div>
    </div>
  );
};

export const Editor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [title, setTitle] = useState('Loading...');
  const [versions, setVersions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const titleTimeout = useRef<any>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${API_URL}/api/documents/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTitle(data.title);
        }
      } catch (e) {}
    };
    
    const fetchVersions = async () => {
      if (!id) return;
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/documents/${id}/versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setVersions(await res.json());
    };

    if (id) {
      fetchDoc();
      fetchVersions();
    }
  }, [id]);

  useEffect(() => {
    if (!id || !currentUser) return;
    const wsProvider = new WebsocketProvider(WS_URL, id, ydoc);
    const indexeddbProvider = new IndexeddbPersistence(`real-time-editor-${id}`, ydoc);
    
    wsProvider.awareness.on('change', () => {
      const states = Array.from(wsProvider.awareness.getStates().values());
      const users = states.map((state: any) => state.user).filter(Boolean);
      setActiveUsers(users);
    });

    setProvider(wsProvider);
    return () => {
      wsProvider.destroy();
      indexeddbProvider.destroy();
    };
  }, [id, ydoc, currentUser]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    if (titleTimeout.current) clearTimeout(titleTimeout.current);
    titleTimeout.current = setTimeout(async () => {
      const token = await auth.currentUser?.getIdToken();
      fetch(`${API_URL}/api/documents/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle })
      });
    }, 1000);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Public link copied to clipboard!');
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // @ts-ignore
        history: false,
      }),
      Collaboration.configure({ document: ydoc }),
      ...(provider && currentUser ? [
        CollaborationCaret.configure({
          provider,
          user: { 
            name: currentUser.displayName || 'Anonymous', 
            color: colors[Math.floor(Math.random() * colors.length)],
            photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || 'A'}`
          },
        })
      ] : []),
    ],
    autofocus: 'end',
  });

  useEffect(() => {
    if (!editor || !provider) return;
    const handleSync = (isSynced: boolean) => {
      if (isSynced) {
        setTimeout(() => editor.commands.focus('end'), 100);
      }
    };
    provider.on('sync', handleSync);
    if (provider.synced) {
      setTimeout(() => editor.commands.focus('end'), 100);
    }
    return () => {
      provider.off('sync', handleSync);
    };
  }, [editor, provider]);

  const saveVersion = async () => {
    if (!editor || !id) return;
    const html = editor.getHTML();
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`${API_URL}/api/documents/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ html })
    });
    if (res.ok) {
      const data = await res.json();
      setVersions(data.versions);
      toast.success('Version saved!');
    }
  };

  const restoreVersion = (html: string) => {
    if (!editor) return;
    if (!html.startsWith('<')) {
      toast.error('Cannot restore older binary versions. Please create a new version.');
      return;
    }
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontWeight: 600 }}>Restore this version?</span>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Current changes will be overwritten.</span>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button 
            onClick={() => {
              editor.commands.setContent(html);
              setShowHistory(false);
              toast.dismiss(t.id);
              toast.success('Version restored!');
            }} 
            style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
          >
            Confirm
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const exportPDF = () => {
    const element = document.querySelector('.ProseMirror');
    if (!element) return;
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.background = 'white';
    clone.style.color = 'black';
    clone.style.padding = '20px';
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);
    html2pdf().set({ margin: 10, filename: `${title || 'document'}.pdf` }).from(clone).save().then(() => document.body.removeChild(clone));
    toast.success('Exporting PDF...');
  };

  const exportTXT = () => {
    if (!editor) return;
    const blob = new Blob([editor.getText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || 'document'}.txt`;
    a.click();
    toast.success('Exporting TXT...');
  };

  if (!provider) return <div style={{ padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>Connecting to workspace...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-app)' }}>
      {/* Absolute Grid Header */}
      <div style={{ 
        display: 'flex', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', 
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' 
      }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)', 
            background: 'transparent', border: 'none', cursor: 'pointer', 
            color: 'var(--text-secondary)', fontSize: '0.875rem'
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        <input 
          value={title} 
          onChange={handleTitleChange}
          style={{ 
            marginLeft: 'var(--space-6)', background: 'transparent', 
            border: '1px solid transparent', color: 'var(--text-primary)', 
            fontSize: '0.875rem', fontWeight: 600, padding: 'var(--space-1) var(--space-2)', 
            borderRadius: 'var(--radius-sm)', outline: 'none', transition: 'border 0.2s'
          }}
          onFocus={(e) => e.target.style.border = '1px solid var(--border-subtle)'}
          onBlur={(e) => e.target.style.border = '1px solid transparent'}
        />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
            {activeUsers.map((u, i) => (
              <img 
                key={i} src={u.photoURL} title={u.name} alt={u.name}
                style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', 
                  border: `2px solid var(--bg-surface)`, marginLeft: '-8px', 
                  backgroundColor: 'var(--border-subtle)', outline: `1px solid ${u.color}`
                }} 
              />
            ))}
          </div>
          <button 
            onClick={copyShareLink} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)', 
              background: 'transparent', color: 'var(--text-secondary)', 
              border: '1px solid var(--border-subtle)', padding: 'var(--space-2) var(--space-4)', 
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.875rem'
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Share2 size={14} /> Share Link
          </button>
        </div>
      </div>

      {/* Editor Main */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <MenuBar editor={editor} onSaveVersion={saveVersion} onShowHistory={() => setShowHistory(true)} onExportPDF={exportPDF} onExportTXT={exportTXT} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-12) var(--space-4)' }}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '350px', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-5px 0 25px rgba(0,0,0,0.5)' }}>
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}><History size={20} /> Version History</h3>
            <button onClick={() => setShowHistory(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
            {versions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 'var(--space-8)' }}>No saved versions yet.</p>
            ) : (
              [...versions].reverse().map((v, i) => (
                <div key={i} style={{ padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', background: 'var(--bg-app)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    {new Date(v.timestamp).toLocaleString()}
                  </div>
                  <button onClick={() => restoreVersion(v.data)} style={{ width: '100%', padding: 'var(--space-2)', background: 'var(--bg-surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

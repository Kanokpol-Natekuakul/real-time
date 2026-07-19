import { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import Image from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Strikethrough, List, ListOrdered, Share2, History, Download, X, Save, MessageSquare, Image as ImageIcon, Link as LinkIcon, Table as TableIcon, CheckSquare, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Highlighter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth, storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import html2pdf from 'html2pdf.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const colors = ['#958DF1', '#F98181', '#FBCE76', '#8AF366', '#8B94F7'];

const MenuBar = ({ editor, onSaveVersion, onShowHistory, onExportPDF, onExportTXT, onShowComments, showComments }: any) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'url' | 'upload'>('url');

  if (!editor) return null;

  const tbClass = (isActive: boolean) => `toolbar-btn${isActive ? ' active' : ''}`;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  const handleImageSubmit = async () => {
    if (uploadMode === 'url' && imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setShowImageModal(false);
      setImageUrl('');
    } else if (uploadMode === 'upload' && imageFile) {
      setUploading(true);
      try {
        const storageRef = ref(storage, `images/${Date.now()}_${imageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);
        
        uploadTask.on('state_changed', 
          null, 
          (error) => {
            console.error(error);
            toast.error('Upload failed');
            setUploading(false);
          }, 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            editor.chain().focus().setImage({ src: downloadURL }).run();
            setShowImageModal(false);
            setImageFile(null);
            setUploading(false);
          }
        );
      } catch {
        toast.error('Upload failed');
        setUploading(false);
      }
    }
  };

  return (
    <div className="editor-toolbar-container" style={{ 
      display: 'flex', padding: 'var(--space-2)', 
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky', top: 0, zIndex: 10
    }}>
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={tbClass(editor.isActive('bold'))} title="Bold" aria-label="Bold"><Bold size={16} /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={tbClass(editor.isActive('italic'))} title="Italic" aria-label="Italic"><Italic size={16} /></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={tbClass(editor.isActive('underline'))} title="Underline" aria-label="Underline"><UnderlineIcon size={16} /></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={tbClass(editor.isActive('strike'))} title="Strikethrough" aria-label="Strikethrough"><Strikethrough size={16} /></button>
          <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={tbClass(editor.isActive('highlight'))} title="Highlight" aria-label="Highlight"><Highlighter size={16} /></button>

          <div className="toolbar-divider"></div>

          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={tbClass(editor.isActive({ textAlign: 'left' }))} title="Align left" aria-label="Align left"><AlignLeft size={16} /></button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={tbClass(editor.isActive({ textAlign: 'center' }))} title="Align center" aria-label="Align center"><AlignCenter size={16} /></button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={tbClass(editor.isActive({ textAlign: 'right' }))} title="Align right" aria-label="Align right"><AlignRight size={16} /></button>

          <div className="toolbar-divider"></div>

          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={tbClass(editor.isActive('bulletList'))} title="Bullet list" aria-label="Bullet list"><List size={16} /></button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={tbClass(editor.isActive('orderedList'))} title="Numbered list" aria-label="Numbered list"><ListOrdered size={16} /></button>
          <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={tbClass(editor.isActive('taskList'))} title="Task list" aria-label="Task list"><CheckSquare size={16} /></button>

          <div className="toolbar-divider"></div>

          <button onClick={setLink} className={tbClass(editor.isActive('link'))} title="Link" aria-label="Link"><LinkIcon size={16} /></button>
          <button onClick={() => setShowImageModal(true)} className={tbClass(false)} title="Insert image" aria-label="Insert image"><ImageIcon size={16} /></button>
          <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={tbClass(editor.isActive('table'))} title="Insert table" aria-label="Insert table"><TableIcon size={16} /></button>
        </div>

        <div className="toolbar-group">
          <button onClick={onSaveVersion} className={tbClass(false)} title="Save Version" aria-label="Save version"><Save size={16} /></button>
          <button onClick={onShowHistory} className={tbClass(false)} title="History" aria-label="History"><History size={16} /></button>
          <button onClick={onShowComments} className={tbClass(showComments)} title="Comments" aria-label="Comments"><MessageSquare size={16} /></button>

          <div className="toolbar-divider"></div>

          <button onClick={onExportPDF} className={tbClass(false)} title="Export PDF"><Download size={16} /> <span className="toolbar-btn-label">PDF</span></button>
          <button onClick={onExportTXT} className={tbClass(false)} title="Export TXT"><Download size={16} /> <span className="toolbar-btn-label">TXT</span></button>
        </div>
      </div>

      {showImageModal && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Insert Image</h3>
            <div className="modal-tabs">
              <button className={`modal-tab ${uploadMode === 'url' ? 'active' : ''}`} onClick={() => setUploadMode('url')}>From URL</button>
              <button className={`modal-tab ${uploadMode === 'upload' ? 'active' : ''}`} onClick={() => setUploadMode('upload')}>Upload File</button>
            </div>
            
            {uploadMode === 'url' ? (
              <input 
                type="text" 
                placeholder="https://example.com/image.png" 
                value={imageUrl} 
                onChange={e => setImageUrl(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
              />
            ) : (
              <input 
                type="file" 
                accept="image/*"
                onChange={e => setImageFile(e.target.files?.[0] || null)}
                style={{ color: 'var(--text-secondary)' }}
              />
            )}
            
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowImageModal(false)}>Cancel</button>
              <button className="modal-btn-submit" onClick={handleImageSubmit} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      } catch {}
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
    
    // Comments Socket
    const newSocket = io(API_URL);
    newSocket.emit('join-document', { documentId: id });
    
    newSocket.on('new-comment', (comment) => {
      setComments(prev => [...prev, comment]);
    });
    
    newSocket.on('delete-comment', (commentId) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
    });
    
    const fetchComments = async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/documents/${id}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setComments(await res.json());
      }
    };
    fetchComments();
    
    return () => {
      wsProvider.destroy();
      indexeddbProvider.destroy();
      newSocket.emit('leave-document', { documentId: id });
      newSocket.disconnect();
    };
  }, [id, ydoc, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

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

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id) return;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`${API_URL}/api/documents/${id}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newComment })
    });
    if (res.ok) {
      setNewComment('');
    }
  };

  const deleteComment = async (commentId: string) => {
    const token = await auth.currentUser?.getIdToken();
    await fetch(`${API_URL}/api/documents/${id}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Collaboration provides its own undo manager; the v2 name was
        // `history`, which v3 silently ignores
        undoRedo: false,
        // configured separately below with custom options
        link: false,
        underline: false,
      }),
      Collaboration.configure({ document: ydoc }),
      Image,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Placeholder.configure({ placeholder: 'Start typing here...' }),
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

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Editor Area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <MenuBar 
            editor={editor} 
            onSaveVersion={saveVersion} 
            onShowHistory={() => { setShowHistory(true); setShowComments(false); }} 
            onExportPDF={exportPDF} 
            onExportTXT={exportTXT}
            onShowComments={() => { setShowComments(!showComments); setShowHistory(false); }}
            showComments={showComments}
          />
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-12) var(--space-4)' }}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Comments Sidebar */}
        {showComments && (
          <div className="comments-sidebar">
            <div className="comments-header">
              <h3>Comments</h3>
              <button onClick={() => setShowComments(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="comments-list">
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>No comments yet.</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <img src={comment.userPhoto || `https://ui-avatars.com/api/?name=${comment.userName}`} alt="Avatar" className="comment-avatar" />
                    <div className="comment-content">
                      <div className="comment-header">
                        <span className="comment-name">{comment.userName}</span>
                        <span className="comment-time">{new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className="comment-text">{comment.text}</p>
                    </div>
                    {comment.userId === currentUser?.uid && (
                      <button className="comment-delete" onClick={() => deleteComment(comment.id)}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={addComment} className="comment-input-area">
              <input 
                type="text" 
                placeholder="Add a comment..." 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <button type="submit" disabled={!newComment.trim()}>Send</button>
            </form>
          </div>
        )}

        {/* History Sidebar */}
        {showHistory && (
          <div style={{ width: '350px', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
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
    </div>
  );
};

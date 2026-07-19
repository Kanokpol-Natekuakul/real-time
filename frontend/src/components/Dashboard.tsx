import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Plus, Clock, Trash2, AlertTriangle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Document {
  _id: string;
  title: string;
  updatedAt: string;
  contentPreview?: string;
}

export const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${API_URL}/api/documents?shared=true`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDocuments(data);
        }
      } catch (error) {
        console.error('Failed to fetch documents', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/documents/${docToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDocuments(docs => docs.filter(d => d._id !== docToDelete));
        toast.success('Document deleted');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete', error);
      toast.error('An error occurred');
    } finally {
      setDocToDelete(null);
    }
  };

  const createNewDocument = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const newDoc = await res.json();
        navigate(`/document/${newDoc._id}`);
      }
    } catch (error) {
      console.error('Failed to create document', error);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (doc.contentPreview && doc.contentPreview.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: '1024px', margin: '0 auto', padding: 'var(--space-8)' }}>
      {/* Header Grid */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        borderBottom: '1px solid var(--border-subtle)', 
        paddingBottom: 'var(--space-4)',
        marginBottom: 'var(--space-8)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 var(--space-1) 0' }}>Documents</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
            {currentUser?.email}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <button 
            onClick={createNewDocument}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)', 
              background: 'var(--accent-primary)', color: '#fff', 
              border: 'none', padding: 'var(--space-2) var(--space-4)', 
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.875rem',
              fontWeight: 500, transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--accent-primary)'}
          >
            <Plus size={16} /> New Document
          </button>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="search-bar-container">
        <Search size={18} color="var(--text-secondary)" />
        <input 
          type="text" 
          placeholder="Search all your documents (including shared)..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading documents...</div>
      ) : filteredDocs.length === 0 ? (
        <div style={{ 
          border: '1px solid var(--border-subtle)', 
          borderRadius: 'var(--radius-md)', 
          padding: 'var(--space-12) var(--space-8)',
          textAlign: 'center',
          backgroundColor: 'var(--bg-surface)'
        }}>
          <FileText size={32} style={{ color: 'var(--border-strong)', marginBottom: 'var(--space-4)' }} />
          <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: '1rem', fontWeight: 500 }}>No documents found</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>Create a new document to get started.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
          {/* List Header */}
          <div className="dashboard-list-header dashboard-list-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 200px 80px', 
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-hover)',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)'
          }}>
            <div>Name</div>
            <div className="date-column">Last Edited</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          
          {/* List Body */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredDocs.map((doc, index) => (
              <div 
                key={doc._id} 
                onClick={() => navigate(`/document/${doc._id}`)}
                className="dashboard-list-item dashboard-list-grid"
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 200px 80px',
                  alignItems: 'center',
                  padding: 'var(--space-3) var(--space-4)', 
                  borderBottom: index < filteredDocs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                  <FileText size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</span>
                    {doc.contentPreview && (
                      <div className="document-preview">{doc.contentPreview}</div>
                    )}
                  </div>
                </div>
                
                <div className="date-column" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <Clock size={14} /> 
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </div>
                
                <div className="action-column" style={{ textAlign: 'right' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDocToDelete(doc._id); }}
                    style={{ 
                      background: 'transparent', border: 'none', color: 'var(--text-secondary)', 
                      cursor: 'pointer', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseOver={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                    onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    title="Delete Document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Delete Modal */}
      {docToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: 'var(--space-4)' }}>
          <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Delete Document?</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-6) 0', fontSize: '0.875rem', lineHeight: 1.5 }}>
              This action cannot be undone. Are you sure you want to permanently delete this document?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button 
                onClick={() => setDocToDelete(null)}
                style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.875rem' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--danger)'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

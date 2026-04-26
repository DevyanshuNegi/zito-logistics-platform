import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import { canUseViewAs } from '../utils/roles';

export default function ViewAsSwitcher() {
  const { user, adminUser, startViewAs, endViewAs, isViewingAs } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Only super_admin can use View As
  if (!user || !canUseViewAs(user.role)) {
    return null;
  }

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/users', {
        params: { search: query, limit: 10 }
      });
      setSearchResults(response.data.data || []);
    } catch (err) {
      setError('Failed to search users');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAs = async (targetUser) => {
    try {
      startViewAs(targetUser);
      setShowModal(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      setError('Failed to start View As mode');
      console.error('View As error:', err);
    }
  };

  const handleEndViewAs = async () => {
    try {
      endViewAs();
    } catch (err) {
      console.error('Error ending View As:', err);
      endViewAs(); // End View As anyway even if something fails
    }
  };

  if (isViewingAs && adminUser) {
    return (
      <div style={{
        background: '#fff3cd',
        color: '#856404',
        padding: '12px 16px',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        border: '1px solid #ffc107'
      }}>
        <div>
          <strong>View As Mode:</strong> Viewing as {user.email} ({user.role})
        </div>
        <button
          onClick={handleEndViewAs}
          style={{
            background: '#ffc107',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#000'
          }}
        >
          Exit View As
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          background: '#007bff',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        View As User
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2>View As User</h2>
            <p style={{ color: '#666', fontSize: '14px' }}>
              Search for a user to preview their experience
            </p>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by email, name, or ID..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              autoFocus
            />

            {error && (
              <div style={{
                background: '#f8d7da',
                color: '#721c24',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                Searching...
              </div>
            )}

            {!loading && searchResults.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    style={{
                      border: '1px solid #ddd',
                      padding: '12px',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{result.full_name || result.email}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {result.email} · {result.role}
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewAs(result)}
                      style={{
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!loading && searchQuery && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                No users found
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                style={{
                  background: '#e9ecef',
                  color: '#333',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

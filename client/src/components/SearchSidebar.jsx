import React, { useState } from 'react';
import axios from 'axios';
import { Search, FileText, ChevronDown, ChevronRight, X, AlertCircle } from 'lucide-react';

export default function SearchSidebar({ roomId }) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/workspaces/${roomId}/search`, {
        params: { q: query.trim() },
      });

      if (res.data.success) {
        setSearchResults(res.data.data);
      }
    } catch (err) {
      console.error('Error searching files:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group search matches by file
  const groupedMatches = React.useMemo(() => {
    if (!searchResults || !searchResults.matches) return {};
    const groups = {};
    for (const match of searchResults.matches) {
      if (!groups[match.file]) {
        groups[match.file] = [];
      }
      groups[match.file].push(match);
    }
    return groups;
  }, [searchResults]);

  return (
    <div className="search-sidebar-container">
      {/* Header */}
      <div className="search-sidebar-header">
        <div className="search-header-title">
          <Search size={16} className="brand-icon" />
          <span>Search Files</span>
          {searchResults && (
            <span className="search-engine-badge">{searchResults.engine}</span>
          )}
        </div>
      </div>

      {/* Search Input Box */}
      <form className="search-input-container" onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search across project files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <X
              size={14}
              className="search-clear-icon"
              onClick={() => {
                setQuery('');
                setSearchResults(null);
              }}
            />
          )}
        </div>
        <button
          type="submit"
          className="btn btn-primary search-submit-btn"
          disabled={!query.trim() || loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div style={{ padding: '8px 12px', color: '#f44747', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Results Header Summary */}
      {searchResults && (
        <div className="search-results-summary">
          {searchResults.totalMatches > 0
            ? `${searchResults.totalMatches} match${searchResults.totalMatches === 1 ? '' : 'es'} in ${
                Object.keys(groupedMatches).length
              } file${Object.keys(groupedMatches).length === 1 ? '' : 's'}`
            : 'No matching results found'}
        </div>
      )}

      {/* Results List */}
      <div className="search-results-list">
        {Object.entries(groupedMatches).map(([filename, matches]) => (
          <div key={filename} className="search-file-group">
            <div className="search-file-header">
              <FileText size={14} color="#007acc" />
              <span className="search-filename">{filename}</span>
              <span className="search-count-badge">{matches.length}</span>
            </div>

            <div className="search-file-matches">
              {matches.map((m, idx) => (
                <div key={idx} className="search-match-row">
                  <span className="line-num">L{m.line}</span>
                  <span className="match-text">{m.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

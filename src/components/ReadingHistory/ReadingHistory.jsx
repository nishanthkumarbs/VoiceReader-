import React, { useMemo, useState } from 'react';
import {
  FiClock,
  FiStar,
  FiPlay,
  FiTrash2,
  FiDownload,
  FiSearch,
  FiFileText,
  FiBookOpen,
  FiType,
} from 'react-icons/fi';
import './ReadingHistory.css';

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Recently';
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getSourceIcon(sourceType) {
  if (sourceType === 'pdf') return FiFileText;
  if (sourceType === 'docx' || sourceType === 'txt' || sourceType === 'other') {
    return FiBookOpen;
  }
  return FiType;
}

export default function ReadingHistory({
  documents = [],
  onOpenDocument,
  onToggleFavorite,
  onDeleteDocument,
  onClearAll,
  onDownloadDocument,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'favorites'

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (filterMode === 'favorites' && !doc.isFavorite) return false;
      if (!q) return true;
      return (
        (doc.title || '').toLowerCase().includes(q) ||
        (doc.fileName || '').toLowerCase().includes(q) ||
        (doc.sourceType || '').toLowerCase().includes(q)
      );
    });
  }, [documents, searchQuery, filterMode]);

  return (
    <div className="vr-reading-history fade-in">
      <div className="history-header vr-card">
        <div className="history-title-wrap">
          <h2>
            <FiClock aria-hidden="true" />
            <span>Reading History & Favorites</span>
          </h2>
          <p>
            Resume any document right where you left off or manage your saved favorites.
          </p>
        </div>

        <div className="history-controls">
          <div className="history-search">
            <FiSearch aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              aria-label="Search reading history"
            />
          </div>

          <div className="history-filter-pills" role="group" aria-label="Filter history">
            <button
              type="button"
              className={`filter-pill ${filterMode === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All ({documents.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterMode === 'favorites' ? 'is-active' : ''}`}
              onClick={() => setFilterMode('favorites')}
            >
              Favorites ({documents.filter((d) => d.isFavorite).length})
            </button>
          </div>

          {documents.length > 0 && (
            <button
              type="button"
              className="vr-btn vr-btn-danger"
              onClick={onClearAll}
            >
              <FiTrash2 aria-hidden="true" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="history-empty vr-card">
          <FiClock className="empty-history-icon" aria-hidden="true" />
          <h3>
            {filterMode === 'favorites'
              ? 'No favorite documents yet'
              : 'Your reading history is empty'}
          </h3>
          <p>
            {filterMode === 'favorites'
              ? 'Star any document while reading to bookmark it here.'
              : 'Open a PDF, Word file, or paste text to automatically track your reading progress.'}
          </p>
        </div>
      ) : (
        <div className="history-grid">
          {filteredDocs.map((doc) => {
            const Icon = getSourceIcon(doc.sourceType);
            const totalS = doc.totalSentences || 1;
            const currentS = Math.min(doc.currentSentenceIndex || 0, totalS - 1);
            const progressPct = doc.totalSentences
              ? Math.round(((currentS + 1) / totalS) * 100)
              : 0;

            return (
              <article key={doc.id} className="history-card vr-card">
                <div className="history-card-top">
                  <div className="history-card-icon">
                    <Icon aria-hidden="true" />
                  </div>
                  <div className="history-card-meta">
                    <span className="vr-badge">
                      {(doc.sourceType || 'tts').toUpperCase()}
                    </span>
                    <span className="history-time">
                      {formatRelativeTime(doc.lastOpenedAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`fav-icon-btn ${doc.isFavorite ? 'is-active' : ''}`}
                    onClick={() => onToggleFavorite(doc.id)}
                    aria-label={
                      doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'
                    }
                    title={doc.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                  >
                    <FiStar />
                  </button>
                </div>

                <h3 className="history-card-title" title={doc.title}>
                  {doc.title || 'Untitled Document'}
                </h3>

                <p className="history-card-excerpt">
                  {(doc.text || '').slice(0, 120)}
                  {(doc.text || '').length > 120 ? '...' : ''}
                </p>

                <div className="history-card-stats">
                  <span>{(doc.wordCount || 0).toLocaleString()} words</span>
                  {doc.totalPages > 1 && (
                    <span>
                      Page {doc.currentPage || 1} of {doc.totalPages}
                    </span>
                  )}
                  <span>{progressPct}% read</span>
                </div>

                <div className="history-progress-bar">
                  <div
                    className="history-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="history-card-actions">
                  <button
                    type="button"
                    className="vr-btn vr-btn-primary"
                    onClick={() => onOpenDocument(doc)}
                  >
                    <FiPlay aria-hidden="true" />
                    <span>Resume</span>
                  </button>
                  <button
                    type="button"
                    className="vr-btn"
                    onClick={() => onDownloadDocument(doc)}
                    title="Download text"
                    aria-label={`Download ${doc.title}`}
                  >
                    <FiDownload aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="vr-btn vr-btn-danger"
                    onClick={() => onDeleteDocument(doc.id)}
                    title="Delete from history"
                    aria-label={`Delete ${doc.title}`}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}


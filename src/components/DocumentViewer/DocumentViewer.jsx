import React, { useEffect, useRef } from 'react';
import {
  FiPlay,
  FiStar,
  FiDownload,
  FiBookOpen,
  FiHeadphones,
} from 'react-icons/fi';
import './DocumentViewer.css';

function HighlightedSentenceText({ text, isActive, wordRange }) {
  if (!isActive || !wordRange || wordRange.charLength <= 0) {
    return <>{text}</>;
  }

  const start = Math.max(0, Math.min(text.length, wordRange.charIndex));
  const end = Math.max(start, Math.min(text.length, start + wordRange.charLength));

  if (start === end) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, start)}
      <mark className="vr-word-highlight">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export default function DocumentViewer({
  title,
  sourceType = 'tts',
  paragraphs = [],
  currentSentenceIndex = 0,
  isPlaying = false,
  wordHighlight = null,
  isFavorite = false,
  onToggleFavorite,
  onSelectSentence,
  onPlayParagraph,
  onDownloadText,
  emptyTitle = 'No document loaded yet',
  emptyDescription = 'Paste text or upload a PDF, Word (.docx), or Text file to read and listen.',
}) {
  const activeSentenceRef = useRef(null);

  useEffect(() => {
    if (isPlaying && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex, isPlaying]);

  return (
    <section className="vr-document-viewer vr-card" aria-label="Document Reader Content">
      <div className="doc-viewer-header">
        <div className="doc-viewer-title-group">
          <span className="doc-type-badge">
            <FiBookOpen aria-hidden="true" />
            {sourceType.toUpperCase()}
          </span>
          <h2 className="doc-viewer-title">{title || 'Untitled Document'}</h2>
        </div>

        <div className="doc-viewer-actions">
          {typeof onToggleFavorite === 'function' && (
            <button
              type="button"
              className={`vr-btn ${isFavorite ? 'is-favorited' : ''}`}
              onClick={onToggleFavorite}
              aria-pressed={isFavorite}
              title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
            >
              <FiStar aria-hidden="true" />
              <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
            </button>
          )}
          {typeof onDownloadText === 'function' && paragraphs.length > 0 && (
            <button
              type="button"
              className="vr-btn"
              onClick={onDownloadText}
              title="Download extracted text"
            >
              <FiDownload aria-hidden="true" />
              <span>Export TXT</span>
            </button>
          )}
        </div>
      </div>

      {paragraphs.length === 0 ? (
        <div className="doc-viewer-empty">
          <div className="empty-icon-wrap" aria-hidden="true">
            <FiHeadphones />
          </div>
          <h3>{emptyTitle}</h3>
          <p>{emptyDescription}</p>
        </div>
      ) : (
        <div className="doc-viewer-body">
          {paragraphs.map((para) => {
            const containsActive = para.sentences.some(
              (s) => s.globalIndex === currentSentenceIndex
            );
            return (
              <div
                key={para.id}
                className={`doc-paragraph-block ${
                  para.type === 'heading' ? 'is-heading' : ''
                } ${containsActive ? 'has-active-sentence' : ''}`}
              >
                <div className="paragraph-toolbar">
                  <span className="paragraph-num">
                    {para.type === 'heading' ? 'Heading' : `¶ ${para.index + 1}`}
                  </span>
                  {typeof onPlayParagraph === 'function' && (
                    <button
                      type="button"
                      className="para-play-btn"
                      onClick={() => onPlayParagraph(para.sentences[0].globalIndex, para.index)}
                      title="Listen to this paragraph only"
                    >
                      <FiPlay aria-hidden="true" />
                      <span>Listen Paragraph</span>
                    </button>
                  )}
                </div>

                <div className="paragraph-content">
                  {para.sentences.map((sentence) => {
                    const isActive = sentence.globalIndex === currentSentenceIndex;
                    return (
                      <span
                        key={sentence.id}
                        ref={isActive ? activeSentenceRef : null}
                        className={`doc-sentence ${isActive ? 'is-active' : ''} ${
                          isActive && isPlaying ? 'is-speaking' : ''
                        }`}
                        onClick={() => onSelectSentence?.(sentence.globalIndex)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectSentence?.(sentence.globalIndex);
                          }
                        }}
                        title="Click to read from this sentence"
                      >
                        <HighlightedSentenceText
                          text={sentence.text}
                          isActive={isActive && isPlaying}
                          wordRange={wordHighlight}
                        />{' '}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}


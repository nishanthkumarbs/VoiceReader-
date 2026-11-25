import React from 'react';
import { FiActivity, FiClock } from 'react-icons/fi';
import { formatDuration } from '../../services/textProcessor';
import './ReadingProgress.css';

export default function ReadingProgress({
  currentIndex,
  totalSentences,
  estimatedTotalSeconds,
  isPlaying,
  isPaused,
  onSeekSentence,
  currentParagraphIndex,
  totalParagraphs,
}) {
  const hasContent = totalSentences > 0;
  const safeCurrent = hasContent ? Math.min(Math.max(0, currentIndex), totalSentences - 1) : 0;
  const percent = hasContent ? Math.round(((safeCurrent + 1) / totalSentences) * 100) : 0;
  const remainingSeconds = hasContent
    ? estimatedTotalSeconds * (1 - safeCurrent / totalSentences)
    : 0;

  const handleBarClick = (e) => {
    if (!hasContent || typeof onSeekSentence !== 'function') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const targetIdx = Math.min(totalSentences - 1, Math.floor(ratio * totalSentences));
    onSeekSentence(targetIdx);
  };

  return (
    <div className="vr-reading-progress">
      <div className="progress-meta">
        <div className="progress-status">
          <span
            className={`status-dot ${
              isPlaying && !isPaused ? 'is-live' : isPaused ? 'is-paused' : ''
            }`}
          />
          <FiActivity aria-hidden="true" className="progress-icon" />
          <span>
            {hasContent
              ? `Sentence ${safeCurrent + 1} of ${totalSentences}${
                  totalParagraphs > 0
                    ? ` • Paragraph ${Math.min(currentParagraphIndex + 1, totalParagraphs)}/${totalParagraphs}`
                    : ''
                }`
              : 'Ready to read'}
          </span>
        </div>

        <div className="progress-right">
          {hasContent && (
            <span className="progress-eta">
              <FiClock aria-hidden="true" />
              {formatDuration(remainingSeconds)} left
            </span>
          )}
          <span className="progress-percent">{hasContent ? `${percent}%` : '0%'}</span>
        </div>
      </div>

      <div
        className="progress-track"
        onClick={handleBarClick}
        role="slider"
        tabIndex={hasContent ? 0 : -1}
        aria-label="Reading Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasContent ? percent : 0}
        onKeyDown={(e) => {
          if (!hasContent) return;
          if (e.key === 'ArrowRight') {
            onSeekSentence(Math.min(totalSentences - 1, safeCurrent + 1));
          } else if (e.key === 'ArrowLeft') {
            onSeekSentence(Math.max(0, safeCurrent - 1));
          }
        }}
      >
        <div
          className="progress-fill"
          style={{ width: `${hasContent ? percent : 0}%` }}
        />
      </div>
    </div>
  );
}


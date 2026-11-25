import React, { useState } from 'react';
import {
  FiTrash2,
  FiDownload,
  FiFileText,
  FiPlay,
  FiEdit3,
  FiEye,
} from 'react-icons/fi';
import { getTextStats, SAMPLE_TEXTS } from '../../services/textProcessor';
import './TextInput.css';

export default function TextInput({
  text,
  title,
  onTextChange,
  onTitleChange,
  onLoadSample,
  onClear,
  onDownloadText,
  onStartReading,
  rate = 1.0,
  isEditingMode = true,
  onToggleEditMode,
}) {
  const [selectedSampleId, setSelectedSampleId] = useState(SAMPLE_TEXTS[0].id);
  const stats = getTextStats(text, rate);

  const handleSampleClick = () => {
    const sample =
      SAMPLE_TEXTS.find((s) => s.id === selectedSampleId) || SAMPLE_TEXTS[0];
    onLoadSample(sample);
  };

  return (
    <section className="vr-text-input vr-card" aria-label="Text Input Editor">
      <div className="text-input-header">
        <div className="title-input-wrap">
          <input
            type="text"
            className="doc-title-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled Document"
            aria-label="Document title"
          />
        </div>

        <div className="text-input-actions">
          <div className="sample-picker">
            <select
              className="sample-select"
              value={selectedSampleId}
              onChange={(e) => setSelectedSampleId(e.target.value)}
              aria-label="Choose sample text"
            >
              {SAMPLE_TEXTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="vr-btn"
              onClick={handleSampleClick}
              title="Load sample text for testing"
            >
              <FiFileText aria-hidden="true" />
              <span>Sample Text</span>
            </button>
          </div>

          {typeof onToggleEditMode === 'function' && (
            <button
              type="button"
              className="vr-btn"
              onClick={onToggleEditMode}
              title={isEditingMode ? 'Switch to Highlighted Reader View' : 'Edit Text'}
            >
              {isEditingMode ? (
                <>
                  <FiEye aria-hidden="true" />
                  <span>Reader View</span>
                </>
              ) : (
                <>
                  <FiEdit3 aria-hidden="true" />
                  <span>Edit Text</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="vr-btn"
            onClick={onDownloadText}
            disabled={!text.trim()}
            title="Download text as .txt"
          >
            <FiDownload aria-hidden="true" />
            <span>Download</span>
          </button>

          <button
            type="button"
            className="vr-btn vr-btn-danger"
            onClick={onClear}
            disabled={!text.trim()}
            title="Clear text"
          >
            <FiTrash2 aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {isEditingMode && (
        <textarea
          className="vr-textarea"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Paste or type any article, book chapter, study notes, or script here to convert it into natural speech..."
          rows={11}
          aria-label="Text to convert to speech"
        />
      )}

      <div className="text-input-footer">
        <div className="text-counters">
          <span>
            <strong>{stats.words.toLocaleString()}</strong> words
          </span>
          <span className="counter-sep">•</span>
          <span>
            <strong>{stats.chars.toLocaleString()}</strong> characters
          </span>
          <span className="counter-sep">•</span>
          <span>
            ~<strong>{Math.max(1, Math.ceil(stats.estimatedMinutes))}</strong> min listen
          </span>
        </div>

        {typeof onStartReading === 'function' && (
          <button
            type="button"
            className="vr-btn vr-btn-primary"
            onClick={onStartReading}
            disabled={!text.trim()}
          >
            <FiPlay aria-hidden="true" />
            <span>Listen Now</span>
          </button>
        )}
      </div>
    </section>
  );
}


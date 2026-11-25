import React, { useRef, useState } from 'react';
import { FiUploadCloud, FiFile, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { SUPPORTED_EXTENSIONS } from '../../services/documentParser';
import './FileUploader.css';

export default function FileUploader({
  onFileSelected,
  accept = '.pdf,.docx,.txt,.md,.csv,.json,.html,.htm',
  title = 'Upload a Document',
  subtitle = 'Drag and drop your PDF, Word (.docx), or Text file here, or click to browse',
  isLoading = false,
  loadingMessage = 'Processing document...',
  compact = false,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleFiles = (files) => {
    setLocalError('');
    if (!files || files.length === 0) return;
    const file = files[0];
    const extIdx = file.name.lastIndexOf('.');
    const ext = extIdx >= 0 ? file.name.slice(extIdx).toLowerCase() : '';

    const allowedList = accept
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!allowedList.includes(ext) && !SUPPORTED_EXTENSIONS.includes(ext)) {
      setLocalError(
        `Unsupported file "${file.name}". Please upload ${allowedList.join(', ')}.`
      );
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className={`vr-file-uploader ${compact ? 'is-compact' : ''}`}>
      <div
        className={`upload-dropzone ${isDragging ? 'is-dragging' : ''} ${
          isLoading ? 'is-loading' : ''
        }`}
        onClick={() => !isLoading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label={title}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="upload-hidden-input"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="upload-icon-badge" aria-hidden="true">
          {isLoading ? <div className="upload-spinner" /> : <FiUploadCloud />}
        </div>

        <div className="upload-copy">
          <h3>{isLoading ? loadingMessage : title}</h3>
          <p>{subtitle}</p>
        </div>

        <div className="upload-formats">
          {accept.split(',').slice(0, 5).map((ext) => (
            <span key={ext} className="format-chip">
              <FiFile aria-hidden="true" />
              {ext.replace('.', '').toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {localError && (
        <div className="upload-feedback is-error" role="alert">
          <FiAlertCircle aria-hidden="true" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  );
}


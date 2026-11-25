import React, { useEffect, useRef, useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiZoomIn,
  FiZoomOut,
  FiCpu,
  FiColumns,
  FiFileText,
  FiPlay,
  FiAlertTriangle,
} from 'react-icons/fi';
import {
  renderPdfPageToCanvas,
  OCR_LANGUAGE_OPTIONS,
} from '../../services/pdfService';
import FileUploader from '../FileUploader/FileUploader';
import DocumentViewer from '../DocumentViewer/DocumentViewer';
import './PDFViewer.css';

export default function PDFViewer({
  pdfState,
  currentPageText,
  paragraphs,
  currentSentenceIndex,
  isPlaying,
  wordHighlight,
  isFavorite,
  isExtracting,
  ocrProgress,
  ocrLanguage = 'auto',
  autoContinuePages,
  onUploadPdf,
  onPageChange,
  onPageRangeChange,
  onOcrLanguageChange,
  onRunOcrCurrentPage,
  onToggleAutoContinue,
  onToggleFavorite,
  onSelectSentence,
  onPlayParagraph,
  onDownloadText,
  onStartReadingPage,
}) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1.25);
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'text' | 'canvas'
  const [jumpInput, setJumpInput] = useState('1');

  useEffect(() => {
    if (pdfState?.currentPage) {
      setJumpInput(String(pdfState.currentPage));
    }
  }, [pdfState?.currentPage]);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      if (!pdfState?.pdfDoc || !canvasRef.current || viewMode === 'text') return;
      try {
        await renderPdfPageToCanvas(
          pdfState.pdfDoc,
          pdfState.currentPage,
          canvasRef.current,
          zoom
        );
      } catch (err) {
        if (!cancelled) {
          console.warn('PDF canvas render skipped:', err?.message);
        }
      }
    }
    draw();
    return () => {
      cancelled = true;
    };
  }, [pdfState?.pdfDoc, pdfState?.currentPage, zoom, viewMode]);

  if (!pdfState || !pdfState.numPages) {
    return (
      <div className="vr-pdf-empty-wrap fade-in">
        <FileUploader
          accept=".pdf"
          title="Upload a PDF Book, Paper, or Scanned Document"
          subtitle="Multi-page PDF extraction, visual page preview, page-range reading, and automatic OCR for scanned PDFs."
          onFileSelected={onUploadPdf}
          isLoading={isExtracting}
          loadingMessage="Extracting PDF pages..."
        />
      </div>
    );
  }

  const {
    title,
    numPages,
    currentPage,
    rangeStart,
    rangeEnd,
    needsOcr,
    ocrApplied,
  } = pdfState;

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const parsed = parseInt(jumpInput, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(numPages, Math.max(1, parsed));
      onPageChange(clamped);
    }
  };

  return (
    <div className="vr-pdf-viewer fade-in">
      <div className="pdf-toolbar vr-card">
        <div className="pdf-toolbar-left">
          <div className="pdf-nav-group">
            <button
              type="button"
              className="vr-btn"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isExtracting}
              aria-label="Previous Page"
            >
              <FiChevronLeft aria-hidden="true" />
              <span>Prev</span>
            </button>

            <form className="page-jump-form" onSubmit={handleJumpSubmit}>
              <label htmlFor="pdf-page-jump" className="sr-only">
                Page number
              </label>
              <input
                id="pdf-page-jump"
                type="number"
                min={1}
                max={numPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                className="page-jump-input"
              />
              <span className="page-total">/ {numPages}</span>
            </form>

            <button
              type="button"
              className="vr-btn"
              onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages || isExtracting}
              aria-label="Next Page"
            >
              <span>Next</span>
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className="pdf-range-group">
            <span className="range-label">Read Range:</span>
            <input
              type="number"
              min={1}
              max={rangeEnd}
              value={rangeStart}
              onChange={(e) => {
                const v = Math.min(rangeEnd, Math.max(1, parseInt(e.target.value, 10) || 1));
                onPageRangeChange(v, rangeEnd);
              }}
              className="range-input"
              aria-label="Start page of range"
            />
            <span>to</span>
            <input
              type="number"
              min={rangeStart}
              max={numPages}
              value={rangeEnd}
              onChange={(e) => {
                const v = Math.max(
                  rangeStart,
                  Math.min(numPages, parseInt(e.target.value, 10) || numPages)
                );
                onPageRangeChange(rangeStart, v);
              }}
              className="range-input"
              aria-label="End page of range"
            />
          </div>
        </div>

        <div className="pdf-toolbar-right">
          <label className="auto-continue-toggle">
            <input
              type="checkbox"
              checked={autoContinuePages}
              onChange={(e) => onToggleAutoContinue(e.target.checked)}
            />
            <span>Auto-next page</span>
          </label>

          <div className="view-mode-pills" role="group" aria-label="PDF view layout">
            <button
              type="button"
              className={`view-pill ${viewMode === 'split' ? 'is-active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Side-by-side PDF & Text"
            >
              <FiColumns aria-hidden="true" />
              <span>Split</span>
            </button>
            <button
              type="button"
              className={`view-pill ${viewMode === 'text' ? 'is-active' : ''}`}
              onClick={() => setViewMode('text')}
              title="Extracted Text Only"
            >
              <FiFileText aria-hidden="true" />
              <span>Text</span>
            </button>
          </div>

          <div className="ocr-control-group">
            <select
              className="ocr-lang-select"
              value={ocrLanguage}
              onChange={(e) => onOcrLanguageChange?.(e.target.value)}
              aria-label="OCR Language"
              title="Select language for scanned PDF OCR"
            >
              {OCR_LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="vr-btn"
              onClick={onRunOcrCurrentPage}
              disabled={ocrProgress !== null || isExtracting}
              title="Run Tesseract OCR on this page (for scanned PDFs)"
            >
              <FiCpu aria-hidden="true" />
              <span>
                {ocrProgress !== null ? `OCR ${ocrProgress}%` : 'Run OCR'}
              </span>
            </button>
          </div>

          <button
            type="button"
            className="vr-btn vr-btn-primary"
            onClick={onStartReadingPage}
            disabled={!currentPageText?.trim()}
          >
            <FiPlay aria-hidden="true" />
            <span>Read Page</span>
          </button>
        </div>
      </div>

      {needsOcr && !ocrApplied && (
        <div className="pdf-ocr-banner" role="status">
          <FiAlertTriangle aria-hidden="true" />
          <span>
            This page appears to be scanned or image-based with little embedded text.
          </span>
          <button
            type="button"
            className="vr-btn vr-btn-primary"
            onClick={onRunOcrCurrentPage}
            disabled={ocrProgress !== null}
          >
            <FiCpu aria-hidden="true" />
            <span>
              {ocrProgress !== null ? `Scanning (${ocrProgress}%)...` : 'Extract Text with OCR'}
            </span>
          </button>
        </div>
      )}

      <div className={`pdf-workspace layout-${viewMode}`}>
        {viewMode !== 'text' && (
          <div className="pdf-canvas-pane vr-card">
            <div className="canvas-pane-header">
              <span>Page {currentPage} Preview</span>
              <div className="zoom-controls">
                <button
                  type="button"
                  className="zoom-btn"
                  onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.2).toFixed(2)))}
                  aria-label="Zoom out"
                >
                  <FiZoomOut />
                </button>
                <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className="zoom-btn"
                  onClick={() => setZoom((z) => Math.min(2.25, +(z + 0.2).toFixed(2)))}
                  aria-label="Zoom in"
                >
                  <FiZoomIn />
                </button>
              </div>
            </div>
            <div className="canvas-scroll-area">
              {pdfState.pdfDoc ? (
                <canvas ref={canvasRef} className="pdf-canvas" />
              ) : (
                <div className="canvas-reupload-note">
                  <p>Visual preview is available for freshly uploaded PDFs. Extracted text is loaded below.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pdf-text-pane">
          <DocumentViewer
            title={`${title} — Page ${currentPage}`}
            sourceType={ocrApplied ? 'pdf (ocr)' : 'pdf'}
            paragraphs={paragraphs}
            currentSentenceIndex={currentSentenceIndex}
            isPlaying={isPlaying}
            wordHighlight={wordHighlight}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            onSelectSentence={onSelectSentence}
            onPlayParagraph={onPlayParagraph}
            onDownloadText={onDownloadText}
            emptyTitle={
              isExtracting
                ? 'Extracting text from page...'
                : 'No selectable text on this page'
            }
            emptyDescription="Click 'Run OCR' above to scan text from an image-based PDF page."
          />
        </div>
      </div>

      <FileUploader
        accept=".pdf"
        compact
        title="Load Another PDF File"
        subtitle="Drop a new PDF here to switch documents"
        onFileSelected={onUploadPdf}
        isLoading={isExtracting}
        loadingMessage="Loading PDF..."
      />
    </div>
  );
}


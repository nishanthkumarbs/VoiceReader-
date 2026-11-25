import React from 'react';
import {
  FiVolume2,
  FiFileText,
  FiBookOpen,
  FiPlay,
  FiClock,
  FiStar,
  FiArrowRight,
  FiUploadCloud,
} from 'react-icons/fi';
import VoiceSelector from '../VoiceSelector/VoiceSelector';
import FileUploader from '../FileUploader/FileUploader';
import SpeechControls from '../SpeechControls/SpeechControls';
import ReadingProgress from '../ReadingProgress/ReadingProgress';
import { getTextStats, SAMPLE_TEXTS } from '../../services/textProcessor';
import './Dashboard.css';

export default function Dashboard({
  text,
  title,
  onTextChange,
  onStartReading,
  onUploadDocument,
  isUploading,
  voices,
  preferences,
  onUpdatePreference,
  playbackState,
  playbackActions,
  recentDocuments = [],
  onOpenRecentDocument,
  onNavigate,
}) {
  const stats = getTextStats(text, preferences.rate);

  return (
    <div className="vr-dashboard fade-in">
      <section className="dash-hero vr-card">
        <div className="dash-hero-content">
          <span className="vr-badge">
            <FiVolume2 aria-hidden="true" />
            Smart AI-Ready Text-to-Speech
          </span>
          <h1>Turn Your Documents Into Voice</h1>
          <p>
            Paste text, upload PDFs, Word documents, or scanned pages, and listen
            with natural voices, live sentence highlighting, and smart reading controls.
          </p>
          <div className="dash-hero-actions">
            <button
              type="button"
              className="vr-btn vr-btn-primary"
              onClick={() => onNavigate('tts')}
            >
              <FiPlay aria-hidden="true" />
              <span>Open Text Studio</span>
            </button>
            <button
              type="button"
              className="vr-btn"
              onClick={() => onNavigate('pdf')}
            >
              <FiFileText aria-hidden="true" />
              <span>Open PDF Reader</span>
            </button>
            <button
              type="button"
              className="vr-btn"
              onClick={() => onNavigate('document')}
            >
              <FiBookOpen aria-hidden="true" />
              <span>Document Reader</span>
            </button>
          </div>
        </div>

        <div className="dash-hero-stats">
          <div className="stat-tile">
            <span className="stat-num">{voices.length || 'System'}</span>
            <span className="stat-label">Voices Available</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">{recentDocuments.length}</span>
            <span className="stat-label">Saved Documents</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">
              {recentDocuments.filter((d) => d.isFavorite).length}
            </span>
            <span className="stat-label">Favorites</span>
          </div>
        </div>
      </section>

      <div className="dash-main-grid">
        <section className="dash-quick-tts vr-card">
          <div className="section-head">
            <div>
              <h2>Quick Text to Speech</h2>
              <p>Type or paste text below and start listening immediately</p>
            </div>
            <button
              type="button"
              className="vr-btn vr-btn-ghost"
              onClick={() => {
                const sample = SAMPLE_TEXTS[0];
                onTextChange(sample.text, sample.title);
              }}
            >
              Load Sample
            </button>
          </div>

          <textarea
            className="dash-textarea"
            rows={6}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Paste notes, articles, or paragraphs here..."
            aria-label="Quick text input"
          />

          <div className="dash-quick-footer">
            <span className="quick-word-count">
              {stats.words} words • {stats.chars} chars
            </span>
            <div className="quick-btns">
              <button
                type="button"
                className="vr-btn"
                onClick={() => onNavigate('tts')}
              >
                Full Reader <FiArrowRight aria-hidden="true" />
              </button>
              <button
                type="button"
                className="vr-btn vr-btn-primary"
                onClick={onStartReading}
                disabled={!text.trim()}
              >
                <FiPlay aria-hidden="true" />
                <span>Speak Text</span>
              </button>
            </div>
          </div>
        </section>

        <section className="dash-upload-card vr-card">
          <div className="section-head">
            <div>
              <h2>
                <FiUploadCloud aria-hidden="true" /> Upload Document
              </h2>
              <p>Supports PDF (including OCR), Word (.docx), TXT, MD, HTML</p>
            </div>
          </div>
          <FileUploader
            compact
            title="Choose or Drop Document"
            subtitle="Automatically extracts text and opens the smart reader"
            onFileSelected={onUploadDocument}
            isLoading={isUploading}
            loadingMessage="Extracting text..."
          />
        </section>
      </div>

      <section className="dash-voice-panel vr-card">
        <div className="section-head">
          <div>
            <h2>Voice & Language Selection</h2>
            <p>
              Currently reading: <strong>{title || 'Untitled Document'}</strong>
            </p>
          </div>
        </div>
        <VoiceSelector
          compact
          voices={voices}
          selectedLanguage={preferences.language}
          selectedVoiceURI={preferences.voiceURI}
          genderFilter={preferences.genderFilter}
          pitch={preferences.pitch}
          onLanguageChange={(lang) => onUpdatePreference('language', lang)}
          onVoiceChange={(uri) => onUpdatePreference('voiceURI', uri)}
          onGenderFilterChange={(g) => onUpdatePreference('genderFilter', g)}
        />
      </section>

      <div className="dash-player-stack">
        <SpeechControls
          isPlaying={playbackState.isPlaying}
          isPaused={playbackState.isPaused}
          hasContent={playbackState.totalSentences > 0}
          currentIndex={playbackState.currentSentenceIndex}
          totalSentences={playbackState.totalSentences}
          rate={preferences.rate}
          volume={preferences.volume}
          readingMode={preferences.readingMode}
          onPlay={playbackActions.play}
          onPause={playbackActions.pause}
          onResume={playbackActions.resume}
          onStop={playbackActions.stop}
          onPrevSentence={playbackActions.prevSentence}
          onNextSentence={playbackActions.nextSentence}
          onRepeatSentence={playbackActions.repeatSentence}
          onRateChange={(r) => onUpdatePreference('rate', r)}
          onVolumeChange={(v) => onUpdatePreference('volume', v)}
          onReadingModeChange={(m) => onUpdatePreference('readingMode', m)}
        />

        <div className="vr-card dash-progress-wrap">
          <ReadingProgress
            currentIndex={playbackState.currentSentenceIndex}
            totalSentences={playbackState.totalSentences}
            estimatedTotalSeconds={stats.estimatedMinutes * 60}
            isPlaying={playbackState.isPlaying}
            isPaused={playbackState.isPaused}
            onSeekSentence={playbackActions.seekSentence}
            currentParagraphIndex={playbackState.currentParagraphIndex}
            totalParagraphs={playbackState.totalParagraphs}
          />
        </div>
      </div>

      <section className="dash-recent vr-card">
        <div className="section-head">
          <div>
            <h2>
              <FiClock aria-hidden="true" /> Recently Opened Documents
            </h2>
            <p>Pick up right where you stopped</p>
          </div>
          {recentDocuments.length > 0 && (
            <button
              type="button"
              className="vr-btn vr-btn-ghost"
              onClick={() => onNavigate('history')}
            >
              View All <FiArrowRight aria-hidden="true" />
            </button>
          )}
        </div>

        {recentDocuments.length === 0 ? (
          <div className="recent-empty">
            No recently opened documents yet. Paste text or upload a file to get started!
          </div>
        ) : (
          <div className="recent-list">
            {recentDocuments.slice(0, 4).map((doc) => {
              const total = doc.totalSentences || 1;
              const pct = doc.totalSentences
                ? Math.round(((Math.min(doc.currentSentenceIndex || 0, total - 1) + 1) / total) * 100)
                : 0;
              return (
                <button
                  key={doc.id}
                  type="button"
                  className="recent-item"
                  onClick={() => onOpenRecentDocument(doc)}
                >
                  <div className="recent-item-top">
                    <span className="vr-badge">
                      {(doc.sourceType || 'tts').toUpperCase()}
                    </span>
                    {doc.isFavorite && <FiStar className="recent-star" aria-label="Favorite" />}
                  </div>
                  <strong className="recent-item-title">{doc.title}</strong>
                  <span className="recent-item-meta">
                    {(doc.wordCount || 0).toLocaleString()} words • {pct}% complete
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


import React from 'react';
import {
  FiSettings,
  FiSun,
  FiMoon,
  FiCloud,
  FiCpu,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi';
import VoiceSelector from '../VoiceSelector/VoiceSelector';
import './Settings.css';

export default function Settings({
  preferences,
  voices,
  onUpdatePreference,
  onResetPreferences,
  onClearAllHistory,
}) {
  return (
    <div className="vr-settings fade-in">
      <div className="settings-header vr-card">
        <h2>
          <FiSettings aria-hidden="true" />
          <span>VoiceReader Settings</span>
        </h2>
        <p>
          Customize your speech voice, reading behavior, OCR automation, and appearance.
        </p>
      </div>

      <div className="settings-grid">
        <section className="settings-section vr-card">
          <h3>Appearance & Reading Mode</h3>
          <div className="setting-row">
            <div className="setting-info">
              <strong>Color Theme</strong>
              <span>Switch between clean Light mode and eye-friendly Dark mode</span>
            </div>
            <div className="theme-choice-group">
              <button
                type="button"
                className={`vr-btn ${preferences.theme === 'light' ? 'vr-btn-primary' : ''}`}
                onClick={() => onUpdatePreference('theme', 'light')}
              >
                <FiSun aria-hidden="true" />
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`vr-btn ${preferences.theme === 'dark' ? 'vr-btn-primary' : ''}`}
                onClick={() => onUpdatePreference('theme', 'dark')}
              >
                <FiMoon aria-hidden="true" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <strong>Default Reading Mode</strong>
              <span>
                Continuous reads straight through; Paragraph stops at the end of the selected paragraph
              </span>
            </div>
            <select
              className="setting-select"
              value={preferences.readingMode}
              onChange={(e) => onUpdatePreference('readingMode', e.target.value)}
              aria-label="Default Reading Mode"
            >
              <option value="continuous">Continuous Reading</option>
              <option value="paragraph">Paragraph by Paragraph</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <strong>Word-by-Word Highlighting</strong>
              <span>Highlight individual words as they are spoken (where browser voice supports it)</span>
            </div>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={preferences.highlightWord}
                onChange={(e) => onUpdatePreference('highlightWord', e.target.checked)}
              />
              <span>{preferences.highlightWord ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
        </section>

        <section className="settings-section vr-card">
          <h3>Default Voice & Speech Parameters</h3>
          <VoiceSelector
            voices={voices}
            selectedLanguage={preferences.language}
            selectedVoiceURI={preferences.voiceURI}
            genderFilter={preferences.genderFilter}
            pitch={preferences.pitch}
            onLanguageChange={(lang) => onUpdatePreference('language', lang)}
            onVoiceChange={(uri) => onUpdatePreference('voiceURI', uri)}
            onGenderFilterChange={(g) => onUpdatePreference('genderFilter', g)}
            onPitchChange={(p) => onUpdatePreference('pitch', p)}
          />

          <div className="setting-sliders-row">
            <div className="setting-slider-box">
              <label htmlFor="settings-rate">
                Default Speed: <strong>{preferences.rate.toFixed(2)}x</strong>
              </label>
              <input
                id="settings-rate"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={preferences.rate}
                onChange={(e) => onUpdatePreference('rate', parseFloat(e.target.value))}
              />
            </div>

            <div className="setting-slider-box">
              <label htmlFor="settings-volume">
                Default Volume: <strong>{Math.round(preferences.volume * 100)}%</strong>
              </label>
              <input
                id="settings-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={preferences.volume}
                onChange={(e) => onUpdatePreference('volume', parseFloat(e.target.value))}
              />
            </div>
          </div>
        </section>

        <section className="settings-section vr-card">
          <h3>
            <FiCpu aria-hidden="true" /> PDF OCR & TTS Architecture
          </h3>

          <div className="setting-row">
            <div className="setting-info">
              <strong>Automatic OCR Prompt for Scanned PDFs</strong>
              <span>Detect image-only PDF pages and run Tesseract.js OCR extraction</span>
            </div>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={preferences.autoOcr}
                onChange={(e) => onUpdatePreference('autoOcr', e.target.checked)}
              />
              <span>{preferences.autoOcr ? 'On' : 'Off'}</span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <strong>Auto-Detect Document Language</strong>
              <span>
                Automatically switch voice to match uploaded PDFs, documents, or pasted text (e.g. Kannada, Hindi, Tamil, Telugu)
              </span>
            </div>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={preferences.autoDetectLanguage !== false}
                onChange={(e) => onUpdatePreference('autoDetectLanguage', e.target.checked)}
              />
              <span>{preferences.autoDetectLanguage !== false ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <strong>
                <FiCloud aria-hidden="true" /> Speech Engine Adapter
              </strong>
              <span>
                Active: Hybrid Engine (Browser Voices + Built-in 140+ Language Offline Engine • {voices.length} total voices available). Extensible for Google Cloud TTS, Azure Neural, or ElevenLabs.
              </span>
            </div>
            <select
              className="setting-select"
              value={preferences.ttsProvider}
              onChange={(e) => onUpdatePreference('ttsProvider', e.target.value)}
              aria-label="Speech Engine Adapter"
            >
              <option value="webspeech">Hybrid Browser + Built-in All-Language Engine</option>
              <option value="cloud-placeholder" disabled>
                Cloud Neural TTS (Configure Backend)
              </option>
            </select>
          </div>
        </section>

        <section className="settings-section vr-card">
          <h3>Storage & Reset</h3>
          <div className="settings-danger-actions">
            <button
              type="button"
              className="vr-btn"
              onClick={onResetPreferences}
            >
              <FiRefreshCw aria-hidden="true" />
              <span>Reset Preferences to Defaults</span>
            </button>
            <button
              type="button"
              className="vr-btn vr-btn-danger"
              onClick={onClearAllHistory}
            >
              <FiTrash2 aria-hidden="true" />
              <span>Clear Saved Reading History</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}


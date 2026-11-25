import React, { useMemo } from 'react';
import { FiGlobe, FiMic, FiSliders, FiUser } from 'react-icons/fi';
import { PRIORITY_LANGUAGES, formatLanguageLabel } from '../../services/ttsEngine';
import './VoiceSelector.css';

export default function VoiceSelector({
  voices,
  selectedLanguage,
  selectedVoiceURI,
  genderFilter,
  pitch,
  onLanguageChange,
  onVoiceChange,
  onGenderFilterChange,
  onPitchChange,
  compact = false,
}) {
  // Combine all built-in multilingual languages with every language detected in the browser
  const languageOptions = useMemo(() => {
    const map = new Map();
    PRIORITY_LANGUAGES.forEach((l) => {
      map.set(l.code.toLowerCase(), { code: l.code, label: l.label });
    });
    voices.forEach((v) => {
      const normalized = v.lang || 'en-US';
      const key = normalized.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { code: normalized, label: formatLanguageLabel(normalized) });
      }
    });
    return Array.from(map.values());
  }, [voices]);

  const filteredVoices = useMemo(() => {
    const targetLang = (selectedLanguage || '').toLowerCase();
    const baseLang = targetLang.split('-')[0];

    let matched = voices.filter((v) => {
      const vLang = (v.lang || '').toLowerCase();
      if (!targetLang) return true;
      return vLang === targetLang || vLang.startsWith(`${baseLang}-`) || vLang === baseLang;
    });

    if (matched.length === 0) {
      matched = voices;
    }

    if (genderFilter && genderFilter !== 'all') {
      const genderMatched = matched.filter((v) => v.gender === genderFilter);
      if (genderMatched.length > 0) {
        matched = genderMatched;
      }
    }

    // Prioritize native/natural browser voices first, then built-in offline voices
    return [...matched].sort((a, b) => {
      if (Boolean(a.isBuiltin) !== Boolean(b.isBuiltin)) {
        return a.isBuiltin ? 1 : -1;
      }
      const aExact = a.lang.toLowerCase() === targetLang ? 1 : 0;
      const bExact = b.lang.toLowerCase() === targetLang ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      if (a.isNatural !== b.isNatural) return a.isNatural ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [voices, selectedLanguage, genderFilter]);

  const activeVoice = useMemo(() => {
    return (
      filteredVoices.find((v) => v.voiceURI === selectedVoiceURI) ||
      filteredVoices[0] ||
      null
    );
  }, [filteredVoices, selectedVoiceURI]);

  return (
    <div className={`vr-voice-selector ${compact ? 'is-compact' : ''}`}>
      <div className="voice-field">
        <label htmlFor="vr-language-select" className="voice-label">
          <FiGlobe aria-hidden="true" />
          <span>Language</span>
        </label>
        <select
          id="vr-language-select"
          className="voice-select"
          value={selectedLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {languageOptions.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div className="voice-field">
        <label htmlFor="vr-voice-select" className="voice-label">
          <FiMic aria-hidden="true" />
          <span>Voice</span>
          {activeVoice?.isNatural && <span className="voice-tag">Natural</span>}
          {activeVoice?.isBuiltin && (
            <span className="voice-tag is-builtin">Built-in</span>
          )}
        </label>
        <select
          id="vr-voice-select"
          className="voice-select"
          value={activeVoice?.voiceURI || ''}
          onChange={(e) => onVoiceChange(e.target.value)}
          disabled={filteredVoices.length === 0}
        >
          {filteredVoices.length === 0 ? (
            <option value="">Default System Voice</option>
          ) : (
            filteredVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
                {voice.gender !== 'neutral' ? ` • ${voice.gender}` : ''}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="voice-field">
        <span className="voice-label">
          <FiUser aria-hidden="true" />
          <span>Voice Gender</span>
        </span>
        <div className="gender-pills" role="group" aria-label="Filter voice gender">
          {['all', 'female', 'male'].map((g) => (
            <button
              key={g}
              type="button"
              className={`gender-pill ${genderFilter === g ? 'is-active' : ''}`}
              onClick={() => onGenderFilterChange(g)}
            >
              {g === 'all' ? 'All' : g === 'female' ? 'Female' : 'Male'}
            </button>
          ))}
        </div>
      </div>

      {!compact && typeof onPitchChange === 'function' && (
        <div className="voice-field">
          <label htmlFor="vr-pitch-slider" className="voice-label">
            <FiSliders aria-hidden="true" />
            <span>Pitch ({Number(pitch).toFixed(2)})</span>
          </label>
          <input
            id="vr-pitch-slider"
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={pitch}
            onChange={(e) => onPitchChange(parseFloat(e.target.value))}
            className="voice-range"
          />
        </div>
      )}
    </div>
  );
}

import React from 'react';
import {
  FiPlay,
  FiPause,
  FiSquare,
  FiSkipBack,
  FiSkipForward,
  FiRepeat,
  FiVolume2,
  FiVolumeX,
  FiLayers,
} from 'react-icons/fi';
import './SpeechControls.css';

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function SpeechControls({
  isPlaying,
  isPaused,
  hasContent,
  currentIndex,
  totalSentences,
  rate,
  volume,
  readingMode,
  onPlay,
  onPause,
  onResume,
  onStop,
  onPrevSentence,
  onNextSentence,
  onRepeatSentence,
  onRateChange,
  onVolumeChange,
  onReadingModeChange,
}) {
  const handleMainPlayToggle = () => {
    if (isPlaying && !isPaused) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else {
      onPlay();
    }
  };

  return (
    <div className="vr-speech-controls vr-card" role="region" aria-label="Voice Playback Controls">
      <div className="controls-transport">
        <button
          type="button"
          className="ctrl-icon-btn"
          onClick={onPrevSentence}
          disabled={!hasContent || currentIndex <= 0}
          title="Previous Sentence (Left Arrow)"
          aria-label="Previous Sentence"
        >
          <FiSkipBack />
        </button>

        <button
          type="button"
          className="ctrl-play-btn"
          onClick={handleMainPlayToggle}
          disabled={!hasContent}
          title={isPlaying && !isPaused ? 'Pause (Space)' : isPaused ? 'Resume (Space)' : 'Play (Space)'}
          aria-label={isPlaying && !isPaused ? 'Pause' : isPaused ? 'Resume' : 'Play'}
        >
          {isPlaying && !isPaused ? <FiPause /> : <FiPlay className="play-offset" />}
        </button>

        <button
          type="button"
          className="ctrl-icon-btn"
          onClick={onNextSentence}
          disabled={!hasContent || currentIndex >= totalSentences - 1}
          title="Next Sentence (Right Arrow)"
          aria-label="Next Sentence"
        >
          <FiSkipForward />
        </button>

        <button
          type="button"
          className="ctrl-icon-btn"
          onClick={onRepeatSentence}
          disabled={!hasContent}
          title="Repeat Current Sentence (R)"
          aria-label="Repeat Sentence"
        >
          <FiRepeat />
        </button>

        <button
          type="button"
          className="ctrl-icon-btn ctrl-stop-btn"
          onClick={onStop}
          disabled={!isPlaying && !isPaused}
          title="Stop Playback (S)"
          aria-label="Stop"
        >
          <FiSquare />
        </button>
      </div>

      <div className="controls-tuning">
        <div className="tuning-group">
          <span className="tuning-label">Speed</span>
          <div className="speed-control-wrap">
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={rate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              aria-label="Playback Speed"
              className="tuning-slider"
            />
            <select
              className="speed-badge-select"
              value={SPEED_PRESETS.includes(rate) ? rate : 'custom'}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) onRateChange(v);
              }}
              aria-label="Speed Presets"
            >
              {SPEED_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p.toFixed(p % 1 === 0 ? 1 : 2)}x
                </option>
              ))}
              {!SPEED_PRESETS.includes(rate) && (
                <option value="custom">{rate.toFixed(2)}x</option>
              )}
            </select>
          </div>
        </div>

        <div className="tuning-group">
          <button
            type="button"
            className="mute-btn"
            onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <FiVolumeX /> : <FiVolume2 />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label="Volume"
            className="tuning-slider volume-slider"
          />
          <span className="tuning-value">{Math.round(volume * 100)}%</span>
        </div>

        <div className="tuning-group">
          <span className="tuning-label">
            <FiLayers aria-hidden="true" /> Mode
          </span>
          <div className="mode-switch" role="group" aria-label="Reading mode">
            <button
              type="button"
              className={`mode-btn ${readingMode === 'continuous' ? 'is-active' : ''}`}
              onClick={() => onReadingModeChange('continuous')}
              title="Read continuously through all paragraphs"
            >
              Continuous
            </button>
            <button
              type="button"
              className={`mode-btn ${readingMode === 'paragraph' ? 'is-active' : ''}`}
              onClick={() => onReadingModeChange('paragraph')}
              title="Stop after finishing the selected paragraph"
            >
              Paragraph
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


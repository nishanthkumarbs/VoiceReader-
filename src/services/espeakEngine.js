/**
 * Built-in Offline Multilingual TTS Engine powered by eSpeak-NG WebAssembly.
 * Provides instant speech synthesis for 100+ languages (including Kannada, Hindi,
 * Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi, English, etc.)
 * with female/male voice variants and synchronized word-boundary highlighting.
 */

const ESPEAK_DATA_PATH = `${import.meta.env.BASE_URL}espeak-ng/espeak-ng.data`;

export const BUILTIN_ESPEAK_LANGUAGES = [
  { lang: 'en-US', espeakId: 'en-US', label: 'English (US)' },
  { lang: 'en-IN', espeakId: 'en', label: 'English (India)' },
  { lang: 'en-GB', espeakId: 'en-GB-x-rp', label: 'English (UK)' },
  { lang: 'kn-IN', espeakId: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { lang: 'hi-IN', espeakId: 'hi', label: 'Hindi (हिन्दी)' },
  { lang: 'ta-IN', espeakId: 'ta', label: 'Tamil (தமிழ்)' },
  { lang: 'te-IN', espeakId: 'te', label: 'Telugu (తెలుగు)' },
  { lang: 'ml-IN', espeakId: 'ml', label: 'Malayalam (മലയാളം)' },
  { lang: 'mr-IN', espeakId: 'mr', label: 'Marathi (मराठी)' },
  { lang: 'bn-IN', espeakId: 'bn', label: 'Bengali (বাংলা)' },
  { lang: 'gu-IN', espeakId: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { lang: 'pa-IN', espeakId: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { lang: 'or-IN', espeakId: 'or', label: 'Odia (ଓଡ଼ିଆ)' },
  { lang: 'ur-IN', espeakId: 'ur', label: 'Urdu (اردو)' },
  { lang: 'es-ES', espeakId: 'es', label: 'Spanish' },
  { lang: 'fr-FR', espeakId: 'fr', label: 'French' },
  { lang: 'de-DE', espeakId: 'de', label: 'German' },
  { lang: 'it-IT', espeakId: 'it', label: 'Italian' },
  { lang: 'pt-BR', espeakId: 'pt-BR', label: 'Portuguese (Brazil)' },
  { lang: 'nl-NL', espeakId: 'nl', label: 'Dutch' },
  { lang: 'ru-RU', espeakId: 'ru', label: 'Russian' },
  { lang: 'ja-JP', espeakId: 'ja', label: 'Japanese' },
  { lang: 'ko-KR', espeakId: 'ko', label: 'Korean' },
  { lang: 'zh-CN', espeakId: 'cmn', label: 'Chinese (Mandarin)' },
  { lang: 'ar-SA', espeakId: 'ar', label: 'Arabic' },
  { lang: 'th-TH', espeakId: 'th', label: 'Thai' },
  { lang: 'tr-TR', espeakId: 'tr', label: 'Turkish' },
  { lang: 'vi-VN', espeakId: 'vi', label: 'Vietnamese' },
  { lang: 'id-ID', espeakId: 'id', label: 'Indonesian' },
  { lang: 'pl-PL', espeakId: 'pl', label: 'Polish' },
  { lang: 'el-GR', espeakId: 'el', label: 'Greek' },
  { lang: 'he-IL', espeakId: 'he', label: 'Hebrew' },
  { lang: 'sv-SE', espeakId: 'sv', label: 'Swedish' },
  { lang: 'uk-UA', espeakId: 'uk', label: 'Ukrainian' },
  { lang: 'ne-NP', espeakId: 'ne', label: 'Nepali' },
  { lang: 'si-LK', espeakId: 'si', label: 'Sinhala' },
];

export function getEspeakBuiltinVoices() {
  const list = [];
  for (const entry of BUILTIN_ESPEAK_LANGUAGES) {
    list.push({
      voiceURI: `espeak:${entry.espeakId}+f3`,
      name: `${entry.label} — Female (Built-in)`,
      lang: entry.lang,
      espeakVoice: `${entry.espeakId}+f3`,
      gender: 'female',
      isNatural: false,
      isBuiltin: true,
      engine: 'espeak',
    });
    list.push({
      voiceURI: `espeak:${entry.espeakId}+m1`,
      name: `${entry.label} — Male (Built-in)`,
      lang: entry.lang,
      espeakVoice: `${entry.espeakId}+m1`,
      gender: 'male',
      isNatural: false,
      isBuiltin: true,
      engine: 'espeak',
    });
  }
  return list;
}

class EspeakWasmEngine {
  constructor() {
    this.modulePromise = null;
    this.worker = null;
    this.audioCtx = null;
    this.activeSource = null;
    this.gainNode = null;
    this.boundaryTimers = [];
    this.playbackSessionId = 0;

    // Pause / resume tracking
    this.activeAudioBuffer = null;
    this.activeCallbacks = null;
    this.activeVolume = 1.0;
    this.activeWordEvents = [];
    this.startedAtCtxTime = 0;
    this.pausedOffsetSeconds = 0;
    this.isPausedState = false;
  }

  async ensureInitialized() {
    if (this.worker) return this.worker;
    if (!this.modulePromise) {
      this.modulePromise = (async () => {
        const [mod, dataResp] = await Promise.all([
          import('@echogarden/espeak-ng-emscripten'),
          fetch(ESPEAK_DATA_PATH),
        ]);
        if (!dataResp.ok) {
          throw new Error(`Failed to load speech language data (${dataResp.status}).`);
        }
        const dataBuffer = await dataResp.arrayBuffer();
        const createEspeak = mod.default;
        const instance = await createEspeak({
          getPreloadedPackage: () => dataBuffer,
        });
        this.worker = new instance.eSpeakNGWorker();
        return this.worker;
      })();
    }
    return this.modulePromise;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  clearTimers() {
    for (const t of this.boundaryTimers) {
      clearTimeout(t);
    }
    this.boundaryTimers = [];
  }

  resolveEspeakVoiceId(voiceURI, lang, gender = 'female') {
    if (voiceURI && voiceURI.startsWith('espeak:')) {
      return voiceURI.slice('espeak:'.length);
    }
    const target = (lang || 'en-US').toLowerCase();
    const base = target.split('-')[0];
    const match =
      BUILTIN_ESPEAK_LANGUAGES.find((l) => l.lang.toLowerCase() === target) ||
      BUILTIN_ESPEAK_LANGUAGES.find((l) => l.lang.toLowerCase().startsWith(base));

    const espeakBase = match ? match.espeakId : 'en';
    const variant = gender === 'male' ? '+m1' : '+f3';
    return `${espeakBase}${variant}`;
  }

  scheduleWordHighlights(wordEvents, offsetSeconds, onBoundary, sessionId) {
    this.clearTimers();
    if (!onBoundary || !wordEvents || wordEvents.length === 0) return;

    for (const ev of wordEvents) {
      const eventSec = (ev.audio_position || 0) / 1000;
      const delayMs = (eventSec - offsetSeconds) * 1000;
      if (delayMs >= -50) {
        const timer = setTimeout(() => {
          if (this.playbackSessionId !== sessionId) return;
          onBoundary({
            charIndex: Math.max(0, (ev.text_position || 1) - 1),
            charLength: Math.max(0, ev.word_length || 0),
          });
        }, Math.max(0, delayMs));
        this.boundaryTimers.push(timer);
      }
    }
  }

  playBufferFromOffset(offsetSeconds, sessionId) {
    const ctx = this.getAudioContext();
    const buffer = this.activeAudioBuffer;
    if (!buffer) return;

    if (this.activeSource) {
      try {
        this.activeSource.onended = null;
        this.activeSource.stop();
      } catch {
        // Ignore already stopped source
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = Math.min(1, Math.max(0, this.activeVolume));

    source.connect(gain);
    gain.connect(ctx.destination);

    this.activeSource = source;
    this.gainNode = gain;
    this.startedAtCtxTime = ctx.currentTime - offsetSeconds;
    this.isPausedState = false;

    this.scheduleWordHighlights(
      this.activeWordEvents,
      offsetSeconds,
      this.activeCallbacks?.onBoundary,
      sessionId
    );

    source.onended = () => {
      if (this.playbackSessionId !== sessionId || this.isPausedState) return;
      this.clearTimers();
      this.activeSource = null;
      this.activeAudioBuffer = null;
      this.activeCallbacks?.onEnd?.();
    };

    source.start(0, Math.max(0, offsetSeconds));
  }

  async speak({
    text,
    voiceURI,
    lang,
    gender = 'female',
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    onStart,
    onBoundary,
    onEnd,
    onError,
  }) {
    this.stop();
    const sessionId = ++this.playbackSessionId;

    try {
      const worker = await this.ensureInitialized();
      if (this.playbackSessionId !== sessionId) return;

      const espeakVoice = this.resolveEspeakVoiceId(voiceURI, lang, gender);
      worker.set_voice(espeakVoice);

      // eSpeak default rate is 175 WPM
      const wpm = Math.round(Math.min(400, Math.max(80, 175 * (Number(rate) || 1.0))));
      // eSpeak default pitch is 50 (0..99)
      const pitchVal = Math.round(Math.min(99, Math.max(10, 50 * (Number(pitch) || 1.0))));
      worker.set_rate(wpm);
      worker.set_pitch(pitchVal);
      worker.set_volume(100);

      const sampleRate = worker.get_samplerate() || 22050;
      const pcmChunks = [];
      let totalSamples = 0;
      const wordEvents = [];

      worker.synthesize(text, (samples, events) => {
        if (samples && samples.length > 0) {
          const copy = new Int16Array(samples);
          pcmChunks.push(copy);
          totalSamples += copy.length;
        }
        if (Array.isArray(events)) {
          for (const ev of events) {
            if (ev.type === 'word') {
              wordEvents.push(ev);
            }
          }
        }
      });

      if (this.playbackSessionId !== sessionId) return;

      if (totalSamples === 0) {
        onEnd?.();
        return;
      }

      const ctx = this.getAudioContext();
      const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      let writeOffset = 0;
      for (const chunk of pcmChunks) {
        for (let i = 0; i < chunk.length; i += 1) {
          channelData[writeOffset + i] = chunk[i] / 32768;
        }
        writeOffset += chunk.length;
      }

      this.activeAudioBuffer = audioBuffer;
      this.activeWordEvents = wordEvents;
      this.activeVolume = volume;
      this.activeCallbacks = { onStart, onBoundary, onEnd, onError };
      this.pausedOffsetSeconds = 0;

      onStart?.();
      this.playBufferFromOffset(0, sessionId);
    } catch (err) {
      if (this.playbackSessionId === sessionId) {
        onError?.(err instanceof Error ? err : new Error('Built-in voice synthesis failed.'));
      }
    }
  }

  pause() {
    if (!this.activeSource || this.isPausedState || !this.audioCtx) return;
    this.isPausedState = true;
    this.pausedOffsetSeconds = Math.max(
      0,
      this.audioCtx.currentTime - this.startedAtCtxTime
    );
    this.clearTimers();
    try {
      this.activeSource.onended = null;
      this.activeSource.stop();
    } catch {
      // Ignore
    }
    this.activeSource = null;
  }

  resume() {
    if (!this.isPausedState || !this.activeAudioBuffer) return;
    const sessionId = this.playbackSessionId;
    this.playBufferFromOffset(this.pausedOffsetSeconds, sessionId);
  }

  stop() {
    this.playbackSessionId += 1;
    this.clearTimers();
    this.isPausedState = false;
    this.pausedOffsetSeconds = 0;
    if (this.activeSource) {
      try {
        this.activeSource.onended = null;
        this.activeSource.stop();
      } catch {
        // Ignore
      }
      this.activeSource = null;
    }
    this.activeAudioBuffer = null;
    this.activeCallbacks = null;
  }
}

export const espeakEngine = new EspeakWasmEngine();


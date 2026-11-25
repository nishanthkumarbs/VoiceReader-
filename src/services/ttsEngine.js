import { BUILTIN_ESPEAK_LANGUAGES, espeakEngine, getEspeakBuiltinVoices } from './espeakEngine';

/**
 * Abstract base interface for TTS engines so cloud TTS providers
 * (Google Cloud TTS, ElevenLabs, Azure Neural TTS, etc.) can be plugged in
 * seamlessly without changing UI or playback orchestration.
 */
export class BaseTTSEngine {
  constructor(id, displayName) {
    this.id = id;
    this.displayName = displayName;
  }

  isSupported() {
    return false;
  }

  getVoices() {
    return [];
  }

  subscribeVoicesChanged() {
    return () => {};
  }

  speak() {
    throw new Error('speak() must be implemented by TTS engine subclass.');
  }

  pause() {}

  resume() {}

  stop() {}
}

const FEMALE_KEYWORDS = [
  'female',
  'woman',
  'girl',
  'zira',
  'heera',
  'kalpana',
  'swara',
  'neerja',
  'sapna',
  'samantha',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'veena',
  'hazel',
  'susan',
  'libby',
  'sonia',
  'aria',
  'jenny',
  'michelle',
  'emma',
  'olivia',
  'ava',
  'natasha',
  'lekha',
  'aditi',
  'raveena',
  'kanya',
  'alice',
  'amelie',
  'anna',
  'shruti',
  'pallavi',
  'sobhana',
  'tanishaa',
  'dhwani',
  'aashi',
];

const MALE_KEYWORDS = [
  'male',
  'man',
  'boy',
  'david',
  'mark',
  'george',
  'daniel',
  'ravi',
  'rishi',
  'prabhat',
  'hemant',
  'madhur',
  'gagan',
  'ryan',
  'guy',
  'eric',
  'andrew',
  'brian',
  'christopher',
  'alex',
  'fred',
  'oliver',
  'thomas',
  'arthur',
  'liam',
  'matthew',
  'joey',
  'justin',
  'mohan',
  'valluvar',
  'midhun',
  'aarav',
  'bashkar',
  'niranjan',
];

export function inferVoiceGender(voice) {
  const name = (voice?.name || '').toLowerCase();
  if (FEMALE_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(name) || name.includes(kw))) {
    return 'female';
  }
  if (MALE_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(name) || name.includes(kw))) {
    return 'male';
  }
  return 'neutral';
}

export const PRIORITY_LANGUAGES = BUILTIN_ESPEAK_LANGUAGES.map((l) => ({
  code: l.lang,
  label: l.label,
}));

export function formatLanguageLabel(langCode) {
  if (!langCode) return 'Unknown Language';
  const normalized = langCode.replace('_', '-');
  const known = PRIORITY_LANGUAGES.find(
    (l) => l.code.toLowerCase() === normalized.toLowerCase()
  );
  if (known) return known.label;

  try {
    const [lang, region] = normalized.split('-');
    const langDisplay = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang);
    if (region) {
      const regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' }).of(region.toUpperCase());
      return `${langDisplay || lang} (${regionDisplay || region})`;
    }
    return langDisplay || normalized;
  } catch {
    return normalized;
  }
}

export class HybridTTSEngine extends BaseTTSEngine {
  constructor() {
    super('hybrid', 'Browser Web Speech + Built-in All-Language Engine');
    this.activeUtterance = null;
    this.activeBackend = null; // 'webspeech' | 'espeak'
    this.cancelledIds = new Set();
    this.utteranceCounter = 0;
    this.builtinVoices = getEspeakBuiltinVoices();
  }

  isBrowserSpeechSupported() {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    );
  }

  isSupported() {
    return true; // Built-in eSpeak WASM works even if browser speechSynthesis is absent
  }

  getBrowserVoices() {
    if (!this.isBrowserSpeechSupported()) return [];
    const rawVoices = window.speechSynthesis.getVoices() || [];
    return rawVoices.map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: (v.lang || 'en-US').replace('_', '-'),
      localService: v.localService,
      default: v.default,
      gender: inferVoiceGender(v),
      isNatural: /natural|neural|online|google|enhanced|premium/i.test(v.name),
      isBuiltin: false,
      engine: 'webspeech',
      raw: v,
    }));
  }

  getVoices() {
    return [...this.getBrowserVoices(), ...this.builtinVoices];
  }

  /**
   * Pick the best matching voice for a language:
   * 1) If user explicitly picked a voiceURI matching that language, keep it.
   * 2) Otherwise prefer native/natural browser voice for that language.
   * 3) If the browser has NO voice for that language (common for Kannada/regional
   *    languages on Windows Chrome), seamlessly fall back to the built-in eSpeak-NG voice!
   */
  resolveVoice({ voiceURI, lang, genderFilter = 'all' }) {
    const allVoices = this.getVoices();
    const targetLang = (lang || 'en-US').toLowerCase();
    const baseLang = targetLang.split('-')[0];

    const matchesLang = (v) => {
      const vLang = (v.lang || '').toLowerCase();
      return vLang === targetLang || vLang.startsWith(`${baseLang}-`) || vLang === baseLang;
    };

    const matchesGender = (v) => {
      if (!genderFilter || genderFilter === 'all') return true;
      return v.gender === genderFilter;
    };

    // 1. Honor explicit selection if it matches the active language
    if (voiceURI) {
      const explicit = allVoices.find((v) => v.voiceURI === voiceURI);
      if (explicit && matchesLang(explicit)) {
        return explicit;
      }
    }

    // 2. Look for native/natural browser voices matching language
    const browserMatches = this.getBrowserVoices().filter(matchesLang);
    if (browserMatches.length > 0) {
      const genderBrowser = browserMatches.filter(matchesGender);
      const pool = genderBrowser.length > 0 ? genderBrowser : browserMatches;
      pool.sort((a, b) => {
        const aExact = a.lang.toLowerCase() === targetLang ? 1 : 0;
        const bExact = b.lang.toLowerCase() === targetLang ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        if (a.isNatural !== b.isNatural) return a.isNatural ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return pool[0];
    }

    // 3. Built-in eSpeak-NG offline fallback for ALL languages (Kannada, Hindi, Tamil, etc.)
    const builtinMatches = this.builtinVoices.filter(matchesLang);
    if (builtinMatches.length > 0) {
      const genderBuiltin = builtinMatches.filter(matchesGender);
      return genderBuiltin[0] || builtinMatches[0];
    }

    // 4. Final fallback to default built-in English or first available
    return this.builtinVoices[0] || allVoices[0] || null;
  }

  subscribeVoicesChanged(callback) {
    if (!this.isBrowserSpeechSupported()) {
      callback(this.getVoices());
      return () => {};
    }
    const synth = window.speechSynthesis;
    const handler = () => callback(this.getVoices());
    synth.addEventListener?.('voiceschanged', handler);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      const browserList = this.getBrowserVoices();
      callback(this.getVoices());
      if (browserList.length > 0 || attempts >= 10) {
        clearInterval(interval);
      }
    }, 300);

    return () => {
      synth.removeEventListener?.('voiceschanged', handler);
      clearInterval(interval);
    };
  }

  speak({
    text,
    voiceURI,
    lang,
    genderFilter = 'all',
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    onStart,
    onBoundary,
    onEnd,
    onError,
  }) {
    this.stop();

    const selectedVoice = this.resolveVoice({ voiceURI, lang, genderFilter });

    // Route to built-in eSpeak-NG WASM engine when selected or when browser lacks the language voice
    if (!selectedVoice || selectedVoice.engine === 'espeak' || !this.isBrowserSpeechSupported()) {
      this.activeBackend = 'espeak';
      espeakEngine.speak({
        text,
        voiceURI: selectedVoice?.voiceURI,
        lang: selectedVoice?.lang || lang,
        gender: genderFilter === 'male' ? 'male' : 'female',
        rate,
        pitch,
        volume,
        onStart,
        onBoundary,
        onEnd,
        onError,
      });
      return selectedVoice;
    }

    // Otherwise use Browser Web Speech API with the matched native/natural voice
    this.activeBackend = 'webspeech';
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    this.utteranceCounter += 1;
    const uid = this.utteranceCounter;
    this.activeUtterance = { uid, utterance };

    if (selectedVoice.raw) {
      utterance.voice = selectedVoice.raw;
      utterance.lang = selectedVoice.lang;
    } else if (lang) {
      utterance.lang = lang;
    }

    utterance.rate = Math.min(2.0, Math.max(0.5, Number(rate) || 1.0));
    utterance.pitch = Math.min(2.0, Math.max(0.5, Number(pitch) || 1.0));
    utterance.volume = Math.min(1.0, Math.max(0.0, Number(volume) ?? 1.0));

    utterance.onstart = () => {
      if (this.cancelledIds.has(uid)) return;
      onStart?.();
    };

    utterance.onboundary = (event) => {
      if (this.cancelledIds.has(uid)) return;
      if (event.name === 'word' || typeof event.charIndex === 'number') {
        onBoundary?.({
          charIndex: event.charIndex ?? 0,
          charLength: event.charLength ?? 0,
        });
      }
    };

    utterance.onend = () => {
      if (this.cancelledIds.has(uid)) {
        this.cancelledIds.delete(uid);
        return;
      }
      if (this.activeUtterance?.uid === uid) {
        this.activeUtterance = null;
      }
      onEnd?.();
    };

    utterance.onerror = (event) => {
      const errType = event?.error || '';
      if (
        this.cancelledIds.has(uid) ||
        errType === 'canceled' ||
        errType === 'interrupted'
      ) {
        this.cancelledIds.delete(uid);
        return;
      }
      if (this.activeUtterance?.uid === uid) {
        this.activeUtterance = null;
      }
      onError?.(new Error(`Speech synthesis error: ${errType || 'unknown'}`));
    };

    synth.speak(utterance);
    return selectedVoice;
  }

  pause() {
    if (this.activeBackend === 'espeak') {
      espeakEngine.pause();
    } else if (this.isBrowserSpeechSupported()) {
      window.speechSynthesis.pause();
    }
  }

  resume() {
    if (this.activeBackend === 'espeak') {
      espeakEngine.resume();
    } else if (this.isBrowserSpeechSupported()) {
      window.speechSynthesis.resume();
    }
  }

  stop() {
    espeakEngine.stop();
    if (this.activeUtterance) {
      this.cancelledIds.add(this.activeUtterance.uid);
      this.activeUtterance = null;
    }
    if (this.isBrowserSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
    this.activeBackend = null;
  }
}

/**
 * Extensible cloud TTS adapter stub demonstrating how external neural TTS
 * providers (e.g., Google Cloud TTS, ElevenLabs, Azure Speech) plug into VoiceReader.
 */
export class CloudTTSEngineAdapter extends BaseTTSEngine {
  constructor(config = {}) {
    super('cloud-tts', 'Cloud Neural TTS (Extensible)');
    this.endpoint = config.endpoint || '';
    this.apiKey = config.apiKey || '';
  }

  isSupported() {
    return Boolean(this.endpoint && this.apiKey);
  }

  getVoices() {
    return [];
  }

  speak({ onError }) {
    onError?.(
      new Error(
        'Cloud Neural TTS requires a configured backend endpoint or API key.'
      )
    );
  }
}

export const webSpeechEngine = new HybridTTSEngine();

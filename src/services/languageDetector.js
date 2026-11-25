/**
 * Unicode script + stopword language detector so uploaded PDFs, Word docs,
 * and pasted text automatically switch VoiceReader to the document's language.
 */

const SCRIPT_RULES = [
  { name: 'Kannada', langCode: 'kn-IN', regex: /[\u0C80-\u0CFF]/g },
  { name: 'Tamil', langCode: 'ta-IN', regex: /[\u0B80-\u0BFF]/g },
  { name: 'Telugu', langCode: 'te-IN', regex: /[\u0C00-\u0C7F]/g },
  { name: 'Malayalam', langCode: 'ml-IN', regex: /[\u0D00-\u0D7F]/g },
  { name: 'Bengali', langCode: 'bn-IN', regex: /[\u0980-\u09FF]/g },
  { name: 'Gujarati', langCode: 'gu-IN', regex: /[\u0A80-\u0AFF]/g },
  { name: 'Punjabi', langCode: 'pa-IN', regex: /[\u0A00-\u0A7F]/g },
  { name: 'Odia', langCode: 'or-IN', regex: /[\u0B00-\u0B7F]/g },
  { name: 'Devanagari', langCode: 'hi-IN', regex: /[\u0900-\u097F]/g },
  { name: 'Arabic/Urdu', langCode: 'ar-SA', regex: /[\u0600-\u06FF]/g },
  { name: 'Japanese', langCode: 'ja-JP', regex: /[\u3040-\u30FF]/g },
  { name: 'Korean', langCode: 'ko-KR', regex: /[\uAC00-\uD7AF\u1100-\u11FF]/g },
  { name: 'Chinese', langCode: 'zh-CN', regex: /[\u4E00-\u9FFF]/g },
  { name: 'Cyrillic', langCode: 'ru-RU', regex: /[\u0400-\u04FF]/g },
  { name: 'Thai', langCode: 'th-TH', regex: /[\u0E00-\u0E7F]/g },
  { name: 'Greek', langCode: 'el-GR', regex: /[\u0370-\u03FF]/g },
  { name: 'Hebrew', langCode: 'he-IL', regex: /[\u0590-\u05FF]/g },
];

const MARATHI_MARKERS = ['आहे', 'आहेत', 'नाही', 'आणि', 'तुम्ही', 'मी', 'च्या', 'साठी', 'मध्ये', 'ळ'];
const URDU_CHARS_REGEX = /[ٹڈڑھےہںگچپژ]/g;

const LATIN_STOPWORDS = {
  'es-ES': ['el', 'la', 'los', 'las', 'de', 'del', 'que', 'en', 'un', 'una', 'para', 'con', 'por', 'como', 'más', 'pero', 'también'],
  'fr-FR': ['le', 'la', 'les', 'des', 'une', 'dans', 'pour', 'que', 'qui', 'avec', 'est', 'sont', 'sur', 'pas', 'nous', 'vous', 'être'],
  'de-DE': ['der', 'die', 'das', 'und', 'ist', 'sind', 'ein', 'eine', 'mit', 'für', 'auf', 'nicht', 'auch', 'von', 'zu', 'dem', 'sich'],
  'pt-BR': ['não', 'que', 'para', 'com', 'uma', 'por', 'mais', 'como', 'mas', 'dos', 'das', 'são', 'está', 'também', 'você'],
  'it-IT': ['che', 'per', 'con', 'una', 'del', 'della', 'sono', 'nel', 'nella', 'non', 'più', 'anche', 'questo', 'questa', 'come'],
  'nl-NL': ['het', 'een', 'van', 'dat', 'voor', 'met', 'zijn', 'niet', 'maar', 'ook', 'aan', 'door', 'worden', 'deze'],
  'id-ID': ['yang', 'dan', 'untuk', 'dengan', 'dari', 'tidak', 'ini', 'itu', 'pada', 'dalam', 'akan', 'juga', 'atau'],
  'tr-TR': ['ve', 'bir', 'bu', 'için', 'ile', 'olan', 'olarak', 'gibi', 'daha', 'çok', 'ama', 'var'],
};

/**
 * Detect dominant language of a block of text.
 * Returns { langCode, scriptName, confidence } or null if Latin/English default should be kept.
 */
export function detectTextLanguage(text) {
  if (!text || !text.trim()) return null;
  const sample = text.slice(0, 6000);

  let bestScript = null;
  let bestCount = 0;

  for (const rule of SCRIPT_RULES) {
    const matches = sample.match(rule.regex);
    const count = matches ? matches.length : 0;
    if (count > bestCount) {
      bestCount = count;
      bestScript = rule;
    }
  }

  // If non-Latin script characters appear meaningfully (>= 4 chars)
  if (bestScript && bestCount >= 4) {
    let langCode = bestScript.langCode;
    let scriptName = bestScript.name;

    // Disambiguate Hindi vs Marathi (Devanagari)
    if (bestScript.name === 'Devanagari') {
      const marathiHits = MARATHI_MARKERS.filter((w) => sample.includes(w)).length;
      if (marathiHits >= 2 || sample.includes('ळ')) {
        langCode = 'mr-IN';
        scriptName = 'Marathi';
      } else {
        langCode = 'hi-IN';
        scriptName = 'Hindi';
      }
    }

    // Disambiguate Arabic vs Urdu
    if (bestScript.name === 'Arabic/Urdu') {
      const urduMatches = sample.match(URDU_CHARS_REGEX);
      if (urduMatches && urduMatches.length >= 2) {
        langCode = 'ur-IN';
        scriptName = 'Urdu';
      } else {
        langCode = 'ar-SA';
        scriptName = 'Arabic';
      }
    }

    return {
      langCode,
      scriptName,
      confidence: 'high',
    };
  }

  // Latin script stopword check for major European/Asian Latin languages
  const words = sample
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (words.length >= 8) {
    const wordSet = new Set(words);
    let bestLatinLang = null;
    let bestHits = 0;

    for (const [code, stops] of Object.entries(LATIN_STOPWORDS)) {
      let hits = 0;
      for (const sw of stops) {
        if (wordSet.has(sw)) hits += 1;
      }
      if (hits > bestHits) {
        bestHits = hits;
        bestLatinLang = code;
      }
    }

    if (bestLatinLang && bestHits >= 3) {
      return {
        langCode: bestLatinLang,
        scriptName: bestLatinLang,
        confidence: 'medium',
      };
    }
  }

  // Predominantly Latin text without foreign stopwords -> English
  if (/[A-Za-z]{3,}/.test(sample)) {
    return {
      langCode: 'en-US',
      scriptName: 'English',
      confidence: 'medium',
    };
  }

  return null;
}

/**
 * Detect per-sentence language when a document mixes multiple scripts
 * (e.g., an English header followed by Kannada paragraphs).
 */
export function detectSentenceLanguage(sentenceText, activeLang) {
  if (!sentenceText) return activeLang;
  const detected = detectTextLanguage(sentenceText);
  if (detected && detected.confidence === 'high') {
    return detected.langCode;
  }
  // If sentence is purely Latin letters & active language is non-Latin (e.g. English heading in a Kannada PDF)
  const hasNonLatin = SCRIPT_RULES.some((r) => r.regex.test(sentenceText));
  const activeBase = (activeLang || 'en-US').split('-')[0].toLowerCase();
  const nonLatinActive = [
    'kn', 'hi', 'mr', 'ta', 'te', 'ml', 'bn', 'gu', 'pa', 'or', 'ur', 'ar', 'ja', 'ko', 'zh', 'ru', 'th', 'el', 'he',
  ].includes(activeBase);

  if (!hasNonLatin && nonLatinActive && /[A-Za-z]{3,}/.test(sentenceText)) {
    return 'en-IN';
  }
  return activeLang;
}


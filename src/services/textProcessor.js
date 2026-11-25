const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'fig',
  'no',
  'vol',
  'inc',
  'ltd',
  'co',
]);

const MAX_CHUNK_LENGTH = 230;

/**
 * Split a long sentence without punctuation breaks into smaller chunks
 * so browser Web Speech synthesis never stalls or drops utterances.
 */
function splitOversizedSentence(sentence) {
  const trimmed = sentence.trim();
  if (trimmed.length <= MAX_CHUNK_LENGTH) {
    return [trimmed];
  }

  const chunks = [];
  let remaining = trimmed;

  while (remaining.length > MAX_CHUNK_LENGTH) {
    const slice = remaining.slice(0, MAX_CHUNK_LENGTH);
    let splitIdx = Math.max(
      slice.lastIndexOf('; '),
      slice.lastIndexOf(', '),
      slice.lastIndexOf(' — '),
      slice.lastIndexOf(' - ')
    );

    if (splitIdx < MAX_CHUNK_LENGTH * 0.4) {
      splitIdx = slice.lastIndexOf(' ');
    }
    if (splitIdx <= 0) {
      splitIdx = MAX_CHUNK_LENGTH;
    } else {
      splitIdx += 1;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

/**
 * Split a paragraph into natural sentences, respecting common abbreviations,
 * decimals, and Devanagari/Kannada sentence terminators (।, ॥).
 */
export function splitIntoSentences(paragraph) {
  if (!paragraph || !paragraph.trim()) return [];

  const text = paragraph.replace(/\s+/g, ' ').trim();
  const rawSentences = [];
  let current = '';

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    current += ch;

    const isTerminator = ch === '.' || ch === '!' || ch === '?' || ch === '।' || ch === '॥';
    if (!isTerminator) continue;

    const nextChar = text[i + 1] || '';
    const prevChar = text[i - 1] || '';

    // Avoid splitting decimals like 3.14
    if (ch === '.' && /\d/.test(prevChar) && /\d/.test(nextChar)) {
      continue;
    }

    // Avoid splitting ellipsis ...
    if (ch === '.' && nextChar === '.') {
      continue;
    }

    // Check abbreviation or dotted acronym (e.g. Dr., e.g., U.S., Ph.D.) before period
    if (ch === '.') {
      const tokenMatch = current.match(/([A-Za-z.]+)\.$/);
      if (tokenMatch) {
        const word = tokenMatch[1].toLowerCase();
        const isDottedAcronym = /^([a-z]\.)+[a-z]?$/i.test(word);
        if (
          ABBREVIATIONS.has(word) ||
          isDottedAcronym ||
          (word.length === 1 && nextChar === ' ')
        ) {
          continue;
        }
      }
    }

    // Consume trailing closing quotes/brackets
    while (
      i + 1 < text.length &&
      /["')\]\u201d\u2019]/.test(text[i + 1])
    ) {
      i += 1;
      current += text[i];
    }

    if (!text[i + 1] || /\s/.test(text[i + 1])) {
      if (current.trim()) {
        rawSentences.push(current.trim());
        current = '';
      }
    }
  }

  if (current.trim()) {
    rawSentences.push(current.trim());
  }

  const finalSentences = [];
  for (const s of rawSentences) {
    const parts = splitOversizedSentence(s);
    for (const part of parts) {
      if (part) finalSentences.push(part);
    }
  }

  return finalSentences;
}

/**
 * Determine whether a line/block looks like a heading.
 */
function isLikelyHeading(blockText) {
  const trimmed = blockText.trim();
  if (!trimmed) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (
    trimmed.length <= 75 &&
    !/[.!?,;।]$/.test(trimmed) &&
    trimmed.split(/\s+/).length <= 10 &&
    (/^[A-Z0-9\s:–—-]+$/.test(trimmed) || /^[A-Z]/.test(trimmed))
  ) {
    return true;
  }
  return false;
}

/**
 * Parse raw text into structured paragraphs and indexed sentences.
 * Returns { paragraphs, sentences }.
 */
export function parseDocumentText(rawText) {
  if (!rawText || !rawText.trim()) {
    return { paragraphs: [], sentences: [] };
  }

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawBlocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // If the text only used single newlines between lines, split intelligently
  const blocks = [];
  for (const block of rawBlocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      // Check if lines look like headings + paragraphs or separate items
      let buffer = [];
      for (const line of lines) {
        if (isLikelyHeading(line)) {
          if (buffer.length > 0) {
            blocks.push(buffer.join(' '));
            buffer = [];
          }
          blocks.push(line);
        } else {
          buffer.push(line);
        }
      }
      if (buffer.length > 0) {
        blocks.push(buffer.join(' '));
      }
    } else if (lines.length === 1) {
      blocks.push(lines[0]);
    }
  }

  const paragraphs = [];
  const sentences = [];
  let globalIndex = 0;

  blocks.forEach((blockText, pIdx) => {
    const heading = isLikelyHeading(blockText);
    const cleanText = blockText.replace(/^#{1,6}\s+/, '');
    const sentenceTexts = splitIntoSentences(cleanText);

    const paragraphSentences = sentenceTexts.map((sText, sIdx) => {
      const sentenceObj = {
        id: `p${pIdx}-s${sIdx}`,
        globalIndex,
        paragraphIndex: pIdx,
        text: sText,
      };
      sentences.push(sentenceObj);
      globalIndex += 1;
      return sentenceObj;
    });

    if (paragraphSentences.length > 0) {
      paragraphs.push({
        id: `p-${pIdx}`,
        index: pIdx,
        type: heading ? 'heading' : 'paragraph',
        text: cleanText,
        sentences: paragraphSentences,
      });
    }
  });

  return { paragraphs, sentences };
}

/**
 * Calculate word count, character count, and estimated speaking duration.
 */
export function getTextStats(text, rate = 1.0) {
  const safeText = text || '';
  const chars = safeText.length;
  const trimmed = safeText.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  // Average natural speaking pace ~155 words per minute at 1.0x
  const effectiveWpm = 155 * Math.max(0.5, rate);
  const minutes = words / effectiveWpm;
  return {
    words,
    chars,
    estimatedMinutes: minutes,
  };
}

export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const secs = Math.round(totalSeconds);
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export const SAMPLE_TEXTS = [
  {
    id: 'en-product',
    label: 'English – AI & Learning',
    lang: 'en-US',
    title: 'The Future of Auditory Learning',
    text: `The Future of Auditory Learning

Listening to written material transforms dead commute time into productive study sessions. Modern text-to-speech engines turn dense research papers, lecture notes, and ebooks into natural spoken audio.

Why Audio Comprehension Works

When you listen while following highlighted sentences, both visual and auditory pathways activate together. This dual-coding approach improves retention and reduces eye strain during long reading marathons.

Tips for Smarter Listening

Start at a comfortable pace around 1.0x speed. Gradually increase playback to 1.25x or 1.5x as your ear adapts, and switch to paragraph mode whenever you want to focus deeply on a single concept.`,
  },
  {
    id: 'en-in',
    label: 'Indian English – Study Notes',
    lang: 'en-IN',
    title: 'Renewable Energy Grid Overview',
    text: `Renewable Energy Grid Overview

India has rapidly expanded its solar and wind power capacity over the past decade. Integrating clean energy into the national grid requires smart forecasting, battery storage, and resilient transmission lines.

Key Benefits

Decentralised rooftop solar systems empower households and small businesses to generate electricity locally, lowering peak demand and reducing transmission losses across rural and urban regions.`,
  },
  {
    id: 'hi-sample',
    label: 'Hindi – हिन्दी',
    lang: 'hi-IN',
    title: 'डिजिटल शिक्षा का महत्व',
    text: `डिजिटल शिक्षा का महत्व

आज के आधुनिक युग में तकनीक ने सीखने के तरीकों को पूरी तरह बदल दिया है। वॉइस रीडर जैसे स्मार्ट उपकरण छात्रों को किताबें और नोट्स सुनकर समझने में मदद करते हैं।

जब हम किसी पाठ को ध्यान से सुनते हैं, तो कठिन विषय भी सरल लगने लगते हैं और आंखों पर पड़ने वाला तनाव कम हो जाता है।`,
  },
  {
    id: 'kn-sample',
    label: 'Kannada – ಕನ್ನಡ',
    lang: 'kn-IN',
    title: 'ತಂತ್ರಜ್ಞಾನ ಮತ್ತು ಕಲಿಕೆ',
    text: `ತಂತ್ರಜ್ಞಾನ ಮತ್ತು ಕಲಿಕೆ

ಆಧುನಿಕ ತಂತ್ರಜ್ಞಾನವು ಓದುವ ಮತ್ತು ಕಲಿಯುವ ವಿಧಾನವನ್ನು ಸುಲಭಗೊಳಿಸಿದೆ. ಪಠ್ಯದಿಂದ ಧ್ವನಿಗೆ ಪರಿವರ್ತಿಸುವ ಸಾಧನಗಳು ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಹಾಗೂ ವೃತ್ತಿಪರರಿಗೆ ತುಂಬಾ ಉಪಯುಕ್ತವಾಗಿವೆ.

ದೀರ್ಘವಾದ ಲೇಖನಗಳು ಮತ್ತು ಪಿಡಿಎಫ್ ದಾಖಲೆಗಳನ್ನು ಕೇಳುವ ಮೂಲಕ ಸಮಯವನ್ನು ಉಳಿಸಬಹುದು ಮತ್ತು ಮಾಹಿತಿಯನ್ನು ಸುಲಭವಾಗಿ ನೆನಪಿಟ್ಟುಕೊಳ್ಳಬಹುದು.`,
  },
];


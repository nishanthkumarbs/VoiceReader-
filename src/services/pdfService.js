import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const OCR_LANGUAGE_OPTIONS = [
  { code: 'auto', label: 'OCR: Auto (Active Lang)' },
  { code: 'eng', label: 'OCR: English' },
  { code: 'kan+eng', label: 'OCR: Kannada + English' },
  { code: 'kan', label: 'OCR: Kannada (ಕನ್ನಡ)' },
  { code: 'hin+eng', label: 'OCR: Hindi + English' },
  { code: 'hin', label: 'OCR: Hindi (हिन्दी)' },
  { code: 'tam+eng', label: 'OCR: Tamil + English' },
  { code: 'tel+eng', label: 'OCR: Telugu + English' },
  { code: 'mal+eng', label: 'OCR: Malayalam + English' },
  { code: 'mar+eng', label: 'OCR: Marathi + English' },
  { code: 'ben+eng', label: 'OCR: Bengali + English' },
  { code: 'guj+eng', label: 'OCR: Gujarati + English' },
  { code: 'pan+eng', label: 'OCR: Punjabi + English' },
  { code: 'urd', label: 'OCR: Urdu' },
  { code: 'ara', label: 'OCR: Arabic' },
  { code: 'spa', label: 'OCR: Spanish' },
  { code: 'fra', label: 'OCR: French' },
  { code: 'deu', label: 'OCR: German' },
  { code: 'jpn', label: 'OCR: Japanese' },
  { code: 'kor', label: 'OCR: Korean' },
  { code: 'chi_sim', label: 'OCR: Chinese (Simplified)' },
];

/**
 * Map VoiceReader language code or explicit OCR code to Tesseract OCR language code.
 */
export function mapToTesseractLang(langCode) {
  const normalized = (langCode || 'en-US').toLowerCase();
  // Pass through explicit tesseract codes (e.g. 'kan+eng', 'hin', 'eng')
  if (
    normalized.includes('+') ||
    ['eng', 'kan', 'hin', 'tam', 'tel', 'mal', 'mar', 'ben', 'guj', 'pan', 'urd', 'ara', 'spa', 'fra', 'deu', 'jpn', 'kor', 'chi_sim', 'rus'].includes(normalized)
  ) {
    return normalized;
  }
  if (normalized.startsWith('hi')) return 'hin+eng';
  if (normalized.startsWith('kn')) return 'kan+eng';
  if (normalized.startsWith('ta')) return 'tam+eng';
  if (normalized.startsWith('te')) return 'tel+eng';
  if (normalized.startsWith('ml')) return 'mal+eng';
  if (normalized.startsWith('mr')) return 'mar+eng';
  if (normalized.startsWith('bn')) return 'ben+eng';
  if (normalized.startsWith('gu')) return 'guj+eng';
  if (normalized.startsWith('pa')) return 'pan+eng';
  if (normalized.startsWith('ur')) return 'urd';
  if (normalized.startsWith('ar')) return 'ara';
  if (normalized.startsWith('fr')) return 'fra';
  if (normalized.startsWith('de')) return 'deu';
  if (normalized.startsWith('es')) return 'spa';
  if (normalized.startsWith('ja')) return 'jpn';
  if (normalized.startsWith('ko')) return 'kor';
  if (normalized.startsWith('zh')) return 'chi_sim';
  if (normalized.startsWith('ru')) return 'rus';
  return 'eng';
}

/**
 * Load a PDF File object and return the pdfjs document proxy.
 */
export async function loadPdfFromFile(file) {
  if (!file) throw new Error('No PDF file provided.');
  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Selected file is not a valid PDF document.');
  }
  if (file.size === 0) {
    throw new Error('The uploaded PDF file is empty.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  return {
    pdfDoc,
    numPages: pdfDoc.numPages,
    title: file.name.replace(/\.pdf$/i, ''),
    fileName: file.name,
  };
}

/**
 * Reconstruct clean paragraphs and headings from PDF.js text content items
 * by inspecting baseline Y positions and font height differences.
 */
export async function extractPdfPageText(pdfDoc, pageNumber) {
  const page = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const items = textContent.items || [];

  if (items.length === 0) {
    return {
      pageNumber,
      text: '',
      needsOcr: true,
      ocrApplied: false,
    };
  }

  // Group items into visual lines by Y coordinate
  const lines = [];
  let currentLine = null;

  for (const item of items) {
    const str = item.str;
    if (!str) continue;
    const tx = item.transform || [1, 0, 0, 1, 0, 0];
    const fontSize = Math.hypot(tx[0], tx[1]) || item.height || 12;
    const x = tx[4];
    const y = tx[5];

    if (!currentLine || Math.abs(currentLine.y - y) > Math.max(3, fontSize * 0.45)) {
      if (currentLine) lines.push(currentLine);
      currentLine = { y, fontSize, parts: [{ x, str }] };
    } else {
      currentLine.parts.push({ x, str });
      currentLine.fontSize = Math.max(currentLine.fontSize, fontSize);
    }
  }
  if (currentLine) lines.push(currentLine);

  // Determine median body font size to detect headings
  const sizes = lines.map((l) => l.fontSize).sort((a, b) => a - b);
  const medianFontSize = sizes[Math.floor(sizes.length / 2)] || 12;

  const formattedLines = lines.map((line) => {
    const sorted = line.parts.sort((a, b) => a.x - b.x);
    const text = sorted
      .map((p) => p.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      y: line.y,
      fontSize: line.fontSize,
      text,
    };
  }).filter((l) => l.text.length > 0);

  if (formattedLines.length === 0) {
    return {
      pageNumber,
      text: '',
      needsOcr: true,
      ocrApplied: false,
    };
  }

  const blocks = [];
  let paragraphBuffer = [];

  for (let i = 0; i < formattedLines.length; i += 1) {
    const line = formattedLines[i];
    const prev = formattedLines[i - 1];
    const isHeading =
      line.fontSize >= medianFontSize * 1.22 && line.text.length <= 95;
    const largeGap =
      prev && Math.abs(prev.y - line.y) > medianFontSize * 1.65;

    if (isHeading) {
      if (paragraphBuffer.length > 0) {
        blocks.push(paragraphBuffer.join(' '));
        paragraphBuffer = [];
      }
      blocks.push(`# ${line.text}`);
    } else {
      if (largeGap && paragraphBuffer.length > 0) {
        blocks.push(paragraphBuffer.join(' '));
        paragraphBuffer = [];
      }
      // Handle hyphenated word wrap at end of PDF line
      if (
        paragraphBuffer.length > 0 &&
        paragraphBuffer[paragraphBuffer.length - 1].endsWith('-')
      ) {
        const last = paragraphBuffer.pop();
        paragraphBuffer.push(last.slice(0, -1) + line.text);
      } else {
        paragraphBuffer.push(line.text);
      }
    }
  }

  if (paragraphBuffer.length > 0) {
    blocks.push(paragraphBuffer.join(' '));
  }

  const fullText = blocks.join('\n\n').trim();
  return {
    pageNumber,
    text: fullText,
    needsOcr: fullText.length < 15,
    ocrApplied: false,
  };
}

/**
 * Render a PDF page onto a target HTMLCanvasElement.
 */
export async function renderPdfPageToCanvas(pdfDoc, pageNumber, canvas, scale = 1.35) {
  if (!pdfDoc || !canvas) return null;
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const renderTask = page.render({ canvasContext: context, viewport });
  await renderTask.promise;
  return renderTask;
}

/**
 * Run Tesseract.js OCR on a scanned PDF page by rendering it to an offscreen canvas.
 */
export async function runOcrOnPdfPage(pdfDoc, pageNumber, langCode = 'en-US', onProgress) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.0 });
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.floor(viewport.width);
  offscreen.height = Math.floor(viewport.height);
  const ctx = offscreen.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;

  const tessLang = mapToTesseractLang(langCode);
  const result = await Tesseract.recognize(offscreen, tessLang, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });

  const extracted = (result?.data?.text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    pageNumber,
    text: extracted,
    needsOcr: false,
    ocrApplied: true,
  };
}


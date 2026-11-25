import mammoth from 'mammoth';

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv', '.json', '.html', '.htm'];

export function getFileExtension(fileName) {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

export function isSupportedFile(file) {
  if (!file || !file.name) return false;
  const ext = getFileExtension(file.name);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Strip HTML tags safely while keeping block structure (paragraphs and headings)
 * so mammoth HTML or uploaded HTML reads naturally.
 */
function htmlToStructuredText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks = [];

  const blockTags = new Set([
    'P',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'LI',
    'BLOCKQUOTE',
    'PRE',
    'TR',
  ]);

  function walk(node) {
    if (!node) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
      if (blockTags.has(tag)) {
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (text) {
          if (/^H[1-6]$/.test(tag)) {
            blocks.push(`# ${text}`);
          } else {
            blocks.push(text);
          }
        }
        return;
      }
    }
    if (node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach(walk);
    }
  }

  walk(doc.body);
  if (blocks.length > 0) {
    return blocks.join('\n\n');
  }
  return (doc.body?.textContent || '').trim();
}

/**
 * Extract text from non-PDF document formats (.docx, .txt, .md, .csv, .json, .html).
 */
export async function extractDocumentText(file) {
  if (!file) {
    throw new Error('No file was provided.');
  }

  const ext = getFileExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file format "${ext || 'unknown'}". Supported formats: PDF (.pdf), Word (.docx), Text (.txt), Markdown (.md), CSV (.csv), JSON (.json), HTML (.html).`
    );
  }

  if (file.size === 0) {
    throw new Error('The uploaded file is empty (0 bytes).');
  }

  if (ext === '.docx') {
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    let text = htmlToStructuredText(htmlResult.value || '');
    if (!text.trim()) {
      const rawResult = await mammoth.extractRawText({ arrayBuffer });
      text = (rawResult.value || '').trim();
    }
    if (!text.trim()) {
      throw new Error('No readable text could be extracted from this Word document.');
    }
    return {
      title: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      sourceType: 'docx',
      text,
      warnings: (htmlResult.messages || []).map((m) => m.message),
    };
  }

  const rawText = await file.text();

  if (ext === '.html' || ext === '.htm') {
    const extracted = htmlToStructuredText(rawText);
    if (!extracted.trim()) {
      throw new Error('No readable text found inside the HTML file.');
    }
    return {
      title: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      sourceType: 'other',
      text: extracted,
    };
  }

  if (ext === '.json') {
    let formatted = rawText;
    try {
      const parsed = JSON.parse(rawText);
      formatted = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    } catch {
      // Fall back to raw text
    }
    if (!formatted.trim()) {
      throw new Error('The JSON file contains no readable text.');
    }
    return {
      title: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      sourceType: 'other',
      text: formatted,
    };
  }

  // .txt, .md, .csv
  if (!rawText.trim()) {
    throw new Error('This document contains no readable text.');
  }

  return {
    title: file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    sourceType: ext === '.txt' ? 'txt' : 'other',
    text: rawText.trim(),
  };
}


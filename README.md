# VoiceReader – Smart Text-to-Speech & Document Reader

VoiceReader is a modern, responsive web application built with React and Vite that converts text, PDFs (including scanned PDFs via OCR), Word documents (`.docx`), and plain-text files into natural-sounding speech across multiple languages.

## Features

- **Text-to-Speech Reader**: Paste or type text with live sentence & word highlighting, word/character counters, sample texts, and `.txt` export.
- **All-Language Voice Support**: Hybrid engine combining browser Web Speech API voices with a built-in WebAssembly multilingual engine (`@echogarden/espeak-ng-emscripten`) supporting English (US/India/UK), Kannada, Hindi, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Spanish, French, German, Japanese, Korean, Chinese, Arabic, and more.
- **Automatic Language Detection**: Automatically detects document and sentence script/language (e.g., Kannada PDFs automatically read in Kannada).
- **PDF Reader with OCR**: Multi-page PDF viewer (`pdfjs-dist`), page jump, start–end page range, auto-next-page reading, and multi-language OCR (`tesseract.js`) for scanned PDFs.
- **Document Reader**: Extracts structured headings and paragraphs from `.docx` (`mammoth`), `.txt`, `.md`, `.csv`, `.json`, and `.html` files.
- **Smart Playback Controls**: Play, Pause, Resume, Stop, Previous/Next/Repeat sentence, playback speed (`0.5x`–`2.0x`), pitch, volume/mute, Continuous vs. Paragraph mode, and keyboard shortcuts (`Space`, `←`, `→`, `R`, `S`).
- **History, Favorites & Themes**: Saves reading progress and favorites locally via IndexedDB + LocalStorage, with Light and Dark modes.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

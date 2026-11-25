import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiMenu,
  FiAlertCircle,
  FiCheckCircle,
  FiX,
  FiVolume2,
  FiSun,
  FiMoon,
} from 'react-icons/fi';
import Sidebar from './components/Sidebar/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import TextInput from './components/TextInput/TextInput';
import FileUploader from './components/FileUploader/FileUploader';
import PDFViewer from './components/PDFViewer/PDFViewer';
import DocumentViewer from './components/DocumentViewer/DocumentViewer';
import VoiceSelector from './components/VoiceSelector/VoiceSelector';
import SpeechControls from './components/SpeechControls/SpeechControls';
import ReadingProgress from './components/ReadingProgress/ReadingProgress';
import ReadingHistory from './components/ReadingHistory/ReadingHistory';
import Settings from './components/Settings/Settings';
import { webSpeechEngine, formatLanguageLabel } from './services/ttsEngine';
import {
  detectTextLanguage,
  detectSentenceLanguage,
} from './services/languageDetector';
import {
  parseDocumentText,
  getTextStats,
  SAMPLE_TEXTS,
} from './services/textProcessor';
import { extractDocumentText } from './services/documentParser';
import {
  loadPdfFromFile,
  extractPdfPageText,
  runOcrOnPdfPage,
} from './services/pdfService';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  getAllDocuments,
  saveDocumentRecord,
  updateDocumentProgress,
  deleteDocumentRecord,
  clearAllDocuments,
} from './services/storageService';
import './App.css';

const TAB_TITLES = {
  home: { title: 'Dashboard', subtitle: 'Overview, quick audio & recent documents' },
  tts: { title: 'Text to Speech', subtitle: 'Paste or type text with live word highlighting' },
  pdf: { title: 'PDF Reader', subtitle: 'Multi-page PDF viewer, page range & OCR' },
  document: { title: 'Document Reader', subtitle: 'Word (.docx), TXT, Markdown & HTML reader' },
  history: { title: 'Reading History', subtitle: 'Saved documents, favorites & resume progress' },
  settings: { title: 'Settings', subtitle: 'Voices, reading mode, OCR & appearance' },
};

function createDocId(prefix = 'doc') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [voices, setVoices] = useState(() => webSpeechEngine.getVoices());
  const ttsSupported = webSpeechEngine.isSupported();

  // Active document state
  const [activeDocId, setActiveDocId] = useState(null);
  const [docTitle, setDocTitle] = useState(SAMPLE_TEXTS[0].title);
  const [docSourceType, setDocSourceType] = useState('tts');
  const [docText, setDocText] = useState(SAMPLE_TEXTS[0].text);
  const [isFavorite, setIsFavorite] = useState(false);
  const [ttsEditMode, setTtsEditMode] = useState(true);

  // PDF specific state
  const [pdfState, setPdfState] = useState(null);
  const [autoContinuePages, setAutoContinuePages] = useState(true);
  const [ocrProgress, setOcrProgress] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Playback state
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [wordHighlight, setWordHighlight] = useState(null);

  // History & Notifications
  const [historyDocs, setHistoryDocs] = useState([]);
  const [notification, setNotification] = useState(null);

  // Parse active document text into paragraphs & sentences
  const parsedDoc = useMemo(() => parseDocumentText(docText), [docText]);
  const sentences = parsedDoc.sentences;
  const paragraphs = parsedDoc.paragraphs;
  const textStats = useMemo(
    () => getTextStats(docText, preferences.rate),
    [docText, preferences.rate]
  );

  // Keep refs updated for async Web Speech callbacks
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;
  const paragraphsRef = useRef(paragraphs);
  paragraphsRef.current = paragraphs;
  const currentIdxRef = useRef(currentSentenceIndex);
  currentIdxRef.current = currentSentenceIndex;
  const pdfStateRef = useRef(pdfState);
  pdfStateRef.current = pdfState;
  const autoContinueRef = useRef(autoContinuePages);
  autoContinueRef.current = autoContinuePages;
  const paragraphLockRef = useRef(null);
  const activeDocIdRef = useRef(activeDocId);
  activeDocIdRef.current = activeDocId;

  const showNotice = useCallback((type, message) => {
    setNotification({ type, message, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!notification) return undefined;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 5500);
    return () => clearTimeout(timer);
  }, [notification]);

  // Apply theme attribute to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preferences.theme);
    savePreferences(preferences);
  }, [preferences]);

  // Subscribe to browser speech voices
  useEffect(() => {
    const unsubscribe = webSpeechEngine.subscribeVoicesChanged((list) => {
      setVoices(list);
    });
    return () => {
      unsubscribe();
      webSpeechEngine.stop();
    };
  }, []);

  // Load saved reading history on mount
  const refreshHistory = useCallback(async () => {
    const docs = await getAllDocuments();
    setHistoryDocs(docs);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const updatePreference = useCallback((key, value) => {
    setPreferences((prev) => {
      if (key === 'language') {
        const bestVoice = webSpeechEngine.resolveVoice({
          lang: value,
          genderFilter: prev.genderFilter,
        });
        return {
          ...prev,
          language: value,
          voiceURI: bestVoice?.voiceURI || '',
        };
      }
      if (key === 'genderFilter') {
        const bestVoice = webSpeechEngine.resolveVoice({
          lang: prev.language,
          genderFilter: value,
        });
        return {
          ...prev,
          genderFilter: value,
          voiceURI: bestVoice?.voiceURI || '',
        };
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const applyDetectedLanguage = useCallback((text, announce = true) => {
    if (prefsRef.current.autoDetectLanguage === false) return null;
    const detected = detectTextLanguage(text);
    if (!detected) return null;

    const currentLang = (prefsRef.current.language || '').toLowerCase();
    const detectedLower = detected.langCode.toLowerCase();
    const currentBase = currentLang.split('-')[0];
    const detectedBase = detectedLower.split('-')[0];

    // If text is English and user already selected an English variant (en-US/en-IN/en-GB), keep their accent
    if (detectedBase === 'en' && currentBase === 'en') {
      return detected;
    }

    if (currentBase !== detectedBase) {
      const targetLang = detectedBase === 'en' ? 'en-US' : detected.langCode;
      const matchedVoice = webSpeechEngine.resolveVoice({
        lang: targetLang,
        genderFilter: prefsRef.current.genderFilter,
      });
      setPreferences((prev) => ({
        ...prev,
        language: targetLang,
        voiceURI: matchedVoice?.voiceURI || '',
      }));
      if (announce) {
        showNotice(
          'success',
          `Detected ${formatLanguageLabel(targetLang)} — voice switched automatically.`
        );
      }
    }
    return detected;
  }, [showNotice]);

  const persistCurrentDocument = useCallback(
    async ({
      id,
      title,
      sourceType,
      text,
      fileName,
      sentenceIndex = 0,
      page = 1,
      totalPages = 1,
      favorite = false,
    }) => {
      if (!text || !text.trim()) return null;
      const docId = id || createDocId(sourceType || 'doc');
      const { sentences: sList } = parseDocumentText(text);
      const stats = getTextStats(text, prefsRef.current.rate);

      const saved = await saveDocumentRecord({
        id: docId,
        title: title || 'Untitled Document',
        sourceType: sourceType || 'tts',
        fileName: fileName || '',
        text,
        wordCount: stats.words,
        charCount: stats.chars,
        totalSentences: sList.length,
        currentSentenceIndex: sentenceIndex,
        currentPage: page,
        totalPages,
        isFavorite: favorite,
      });

      setActiveDocId(saved.id);
      await refreshHistory();
      return saved.id;
    },
    [refreshHistory]
  );

  // Stop speech cleanly
  const stopPlayback = useCallback(() => {
    webSpeechEngine.stop();
    paragraphLockRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    setWordHighlight(null);
  }, []);

  // Load a specific PDF page (optionally auto-starting speech)
  const loadPdfPage = useCallback(
    async (targetPdfState, pageNum, shouldAutoPlay = false) => {
      if (!targetPdfState?.pdfDoc) return;
      const clampedPage = Math.min(targetPdfState.numPages, Math.max(1, pageNum));
      setIsProcessingFile(true);
      try {
        let extracted = targetPdfState.pagesCache?.[clampedPage];
        if (!extracted) {
          extracted = await extractPdfPageText(targetPdfState.pdfDoc, clampedPage);
          if (extracted.needsOcr && prefsRef.current.autoOcr) {
            showNotice(
              'warning',
              `Page ${clampedPage} has little embedded text. Running OCR automatically...`
            );
            const activeOcrLang =
              prefsRef.current.ocrLanguage && prefsRef.current.ocrLanguage !== 'auto'
                ? prefsRef.current.ocrLanguage
                : prefsRef.current.language;
            extracted = await runOcrOnPdfPage(
              targetPdfState.pdfDoc,
              clampedPage,
              activeOcrLang,
              (pct) => setOcrProgress(pct)
            );
            setOcrProgress(null);
          }
        }

        const updatedCache = {
          ...(targetPdfState.pagesCache || {}),
          [clampedPage]: extracted,
        };

        const nextPdf = {
          ...targetPdfState,
          currentPage: clampedPage,
          needsOcr: extracted.needsOcr,
          ocrApplied: extracted.ocrApplied,
          pagesCache: updatedCache,
        };

        setPdfState(nextPdf);
        setDocText(extracted.text || '');
        setCurrentSentenceIndex(0);
        if (extracted.text) {
          applyDetectedLanguage(extracted.text, false);
        }

        if (activeDocIdRef.current) {
          updateDocumentProgress(activeDocIdRef.current, {
            currentPage: clampedPage,
            currentSentenceIndex: 0,
            text: extracted.text || '',
          });
        }

        if (shouldAutoPlay && extracted.text?.trim()) {
          setTimeout(() => {
            speakSentenceRef.current(0);
          }, 80);
        }
      } catch (err) {
        showNotice('error', err.message || 'Failed to extract PDF page.');
      } finally {
        setIsProcessingFile(false);
        setOcrProgress(null);
      }
    },
    [showNotice]
  );

  // Core sentence-by-sentence TTS playback engine
  const speakSentenceRef = useRef(() => {});

  const speakSentenceAt = useCallback(
    (index) => {
      const list = sentencesRef.current;
      if (!list || list.length === 0) {
        showNotice('error', 'Please enter or load some text before playing.');
        stopPlayback();
        return;
      }

      if (!webSpeechEngine.isSupported()) {
        showNotice(
          'error',
          'Web Speech API is not supported in this browser. Please try Chrome, Edge, or Safari.'
        );
        return;
      }

      const safeIdx = Math.max(0, Math.min(index, list.length - 1));
      const targetSentence = list[safeIdx];
      const prefs = prefsRef.current;

      setCurrentSentenceIndex(safeIdx);
      setIsPlaying(true);
      setIsPaused(false);
      setWordHighlight(null);

      if (activeDocIdRef.current) {
        updateDocumentProgress(activeDocIdRef.current, {
          currentSentenceIndex: safeIdx,
        });
      }

      const sentenceLang =
        prefs.autoDetectLanguage !== false
          ? detectSentenceLanguage(targetSentence.text, prefs.language)
          : prefs.language;

      const sameBaseLang =
        sentenceLang.split('-')[0].toLowerCase() ===
        (prefs.language || '').split('-')[0].toLowerCase();

      webSpeechEngine.speak({
        text: targetSentence.text,
        voiceURI: sameBaseLang ? prefs.voiceURI : '',
        lang: sentenceLang,
        genderFilter: prefs.genderFilter,
        rate: prefs.rate,
        pitch: prefs.pitch,
        volume: prefs.volume,
        onBoundary: ({ charIndex, charLength }) => {
          if (prefsRef.current.highlightWord) {
            setWordHighlight({ charIndex, charLength });
          }
        },
        onEnd: () => {
          setWordHighlight(null);
          const currentList = sentencesRef.current;
          const nextIdx = safeIdx + 1;

          // Check paragraph-only stop condition
          const activeLock = paragraphLockRef.current;
          const isParagraphOnly =
            prefsRef.current.readingMode === 'paragraph' || activeLock !== null;

          if (isParagraphOnly) {
            const currentParaIdx = targetSentence.paragraphIndex;
            const nextSentence = currentList[nextIdx];
            if (!nextSentence || nextSentence.paragraphIndex !== currentParaIdx) {
              paragraphLockRef.current = null;
              setIsPlaying(false);
              setIsPaused(false);
              return;
            }
          }

          if (nextIdx < currentList.length) {
            speakSentenceRef.current(nextIdx);
            return;
          }

          // Reached end of current text; check if PDF should auto-advance
          const currentPdf = pdfStateRef.current;
          if (
            currentPdf &&
            currentPdf.pdfDoc &&
            autoContinueRef.current &&
            currentPdf.currentPage < currentPdf.rangeEnd
          ) {
            loadPdfPage(currentPdf, currentPdf.currentPage + 1, true);
            return;
          }

          paragraphLockRef.current = null;
          setIsPlaying(false);
          setIsPaused(false);
        },
        onError: (err) => {
          setIsPlaying(false);
          setIsPaused(false);
          setWordHighlight(null);
          showNotice('error', err.message || 'Speech playback failed.');
        },
      });
    },
    [loadPdfPage, showNotice, stopPlayback]
  );

  speakSentenceRef.current = speakSentenceAt;

  const handlePlay = useCallback(async () => {
    if (!docText.trim()) {
      showNotice('error', 'There is no text to read. Paste text or upload a document first.');
      return;
    }

    if (!activeDocIdRef.current) {
      await persistCurrentDocument({
        title: docTitle,
        sourceType: docSourceType,
        text: docText,
        sentenceIndex: currentIdxRef.current,
        page: pdfStateRef.current?.currentPage || 1,
        totalPages: pdfStateRef.current?.numPages || 1,
        favorite: isFavorite,
      });
    }

    paragraphLockRef.current = null;
    speakSentenceAt(currentIdxRef.current);
  }, [docSourceType, docText, docTitle, isFavorite, persistCurrentDocument, showNotice, speakSentenceAt]);

  const handlePause = useCallback(() => {
    webSpeechEngine.pause();
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    webSpeechEngine.resume();
    setIsPaused(false);
  }, []);

  const handlePrevSentence = useCallback(() => {
    const prev = Math.max(0, currentIdxRef.current - 1);
    if (isPlaying && !isPaused) {
      speakSentenceAt(prev);
    } else {
      setCurrentSentenceIndex(prev);
    }
  }, [isPaused, isPlaying, speakSentenceAt]);

  const handleNextSentence = useCallback(() => {
    const maxIdx = Math.max(0, sentencesRef.current.length - 1);
    const next = Math.min(maxIdx, currentIdxRef.current + 1);
    if (isPlaying && !isPaused) {
      speakSentenceAt(next);
    } else {
      setCurrentSentenceIndex(next);
    }
  }, [isPaused, isPlaying, speakSentenceAt]);

  const handleRepeatSentence = useCallback(() => {
    speakSentenceAt(currentIdxRef.current);
  }, [speakSentenceAt]);

  const handleSeekSentence = useCallback(
    (idx) => {
      if (isPlaying) {
        speakSentenceAt(idx);
      } else {
        setCurrentSentenceIndex(idx);
      }
    },
    [isPlaying, speakSentenceAt]
  );

  const handlePlayParagraph = useCallback(
    (startSentenceIdx, paragraphIdx) => {
      paragraphLockRef.current = paragraphIdx;
      speakSentenceAt(startSentenceIdx);
    },
    [speakSentenceAt]
  );

  // Re-apply speech rate/pitch/voice immediately if adjusted during playback
  const prevTuningRef = useRef({
    rate: preferences.rate,
    pitch: preferences.pitch,
    volume: preferences.volume,
    voiceURI: preferences.voiceURI,
    language: preferences.language,
  });

  useEffect(() => {
    const prev = prevTuningRef.current;
    const changed =
      prev.rate !== preferences.rate ||
      prev.pitch !== preferences.pitch ||
      prev.volume !== preferences.volume ||
      prev.voiceURI !== preferences.voiceURI ||
      prev.language !== preferences.language;

    prevTuningRef.current = {
      rate: preferences.rate,
      pitch: preferences.pitch,
      volume: preferences.volume,
      voiceURI: preferences.voiceURI,
      language: preferences.language,
    };

    if (changed && isPlaying && !isPaused) {
      speakSentenceAt(currentIdxRef.current);
    }
  }, [
    preferences.rate,
    preferences.pitch,
    preferences.volume,
    preferences.voiceURI,
    preferences.language,
    isPlaying,
    isPaused,
    speakSentenceAt,
  ]);

  // Upload any document (PDF, Word, Text, etc.)
  const handleFileUpload = useCallback(
    async (file) => {
      stopPlayback();
      setIsProcessingFile(true);
      try {
        const isPdf =
          file.name.toLowerCase().endsWith('.pdf') ||
          file.type === 'application/pdf';

        if (isPdf) {
          const loaded = await loadPdfFromFile(file);
          const firstPage = await extractPdfPageText(loaded.pdfDoc, 1);

          let finalFirstPage = firstPage;
          if (firstPage.needsOcr && prefsRef.current.autoOcr) {
            showNotice(
              'warning',
              'Scanned PDF detected on page 1. Running Tesseract OCR...'
            );
            const activeOcrLang =
              prefsRef.current.ocrLanguage && prefsRef.current.ocrLanguage !== 'auto'
                ? prefsRef.current.ocrLanguage
                : prefsRef.current.language;
            finalFirstPage = await runOcrOnPdfPage(
              loaded.pdfDoc,
              1,
              activeOcrLang,
              (pct) => setOcrProgress(pct)
            );
            setOcrProgress(null);
          }

          const newPdfState = {
            pdfDoc: loaded.pdfDoc,
            numPages: loaded.numPages,
            title: loaded.title,
            fileName: loaded.fileName,
            currentPage: 1,
            rangeStart: 1,
            rangeEnd: loaded.numPages,
            needsOcr: finalFirstPage.needsOcr,
            ocrApplied: finalFirstPage.ocrApplied,
            pagesCache: { 1: finalFirstPage },
          };

          setPdfState(newPdfState);
          setDocTitle(loaded.title);
          setDocSourceType('pdf');
          setDocText(finalFirstPage.text || '');
          setCurrentSentenceIndex(0);
          setIsFavorite(false);
          setActiveTab('pdf');

          const detected = finalFirstPage.text
            ? applyDetectedLanguage(finalFirstPage.text, false)
            : null;

          await persistCurrentDocument({
            id: createDocId('pdf'),
            title: loaded.title,
            sourceType: 'pdf',
            fileName: loaded.fileName,
            text: finalFirstPage.text || `[PDF Loaded: ${loaded.fileName}]`,
            page: 1,
            totalPages: loaded.numPages,
          });

          showNotice(
            'success',
            `Loaded "${loaded.fileName}" (${loaded.numPages} page${loaded.numPages > 1 ? 's' : ''})${
              detected ? ` • Language: ${formatLanguageLabel(detected.langCode)}` : ''
            }.`
          );
        } else {
          const extracted = await extractDocumentText(file);
          setPdfState(null);
          setDocTitle(extracted.title);
          setDocSourceType(extracted.sourceType);
          setDocText(extracted.text);
          setCurrentSentenceIndex(0);
          setIsFavorite(false);
          setActiveTab('document');

          const detected = applyDetectedLanguage(extracted.text, false);

          await persistCurrentDocument({
            id: createDocId(extracted.sourceType),
            title: extracted.title,
            sourceType: extracted.sourceType,
            fileName: extracted.fileName,
            text: extracted.text,
          });

          showNotice(
            'success',
            `Extracted text from "${extracted.fileName}"${
              detected ? ` • Language: ${formatLanguageLabel(detected.langCode)}` : ''
            }.`
          );
        }
      } catch (err) {
        showNotice('error', err.message || 'Could not process the uploaded file.');
      } finally {
        setIsProcessingFile(false);
        setOcrProgress(null);
      }
    },
    [persistCurrentDocument, showNotice, stopPlayback]
  );

  // Manual OCR trigger on current PDF page
  const handleRunOcrCurrentPage = useCallback(async () => {
    if (!pdfState?.pdfDoc) {
      showNotice('error', 'Upload the PDF again to run OCR on its visual pages.');
      return;
    }
    stopPlayback();
    setOcrProgress(0);
    try {
      const activeOcrLang =
        preferences.ocrLanguage && preferences.ocrLanguage !== 'auto'
          ? preferences.ocrLanguage
          : preferences.language;
      const result = await runOcrOnPdfPage(
        pdfState.pdfDoc,
        pdfState.currentPage,
        activeOcrLang,
        (pct) => setOcrProgress(pct)
      );

      setPdfState((prev) =>
        prev
          ? {
              ...prev,
              needsOcr: false,
              ocrApplied: true,
              pagesCache: {
                ...(prev.pagesCache || {}),
                [prev.currentPage]: result,
              },
            }
          : prev
      );
      setDocText(result.text);
      setCurrentSentenceIndex(0);

      if (!result.text.trim()) {
        showNotice('warning', 'OCR completed, but no readable text was detected on this page.');
      } else {
        const detected = applyDetectedLanguage(result.text, false);
        showNotice(
          'success',
          `OCR extracted text from page ${pdfState.currentPage}${
            detected ? ` • Language: ${formatLanguageLabel(detected.langCode)}` : ''
          }.`
        );
      }
    } catch (err) {
      showNotice('error', err.message || 'OCR failed.');
    } finally {
      setOcrProgress(null);
    }
  }, [applyDetectedLanguage, pdfState, preferences.language, preferences.ocrLanguage, showNotice, stopPlayback]);

  // Handle text editing in TTS mode
  const handleTextUpdate = useCallback(
    (newText, optionalTitle) => {
      if (isPlaying) stopPlayback();
      setDocText(newText);
      if (optionalTitle !== undefined) {
        setDocTitle(optionalTitle);
      }
      setDocSourceType('tts');
      setPdfState(null);
      setActiveDocId(null);
      setCurrentSentenceIndex(0);
      if (newText && newText.trim().length >= 8) {
        applyDetectedLanguage(newText, true);
      }
    },
    [applyDetectedLanguage, isPlaying, stopPlayback]
  );

  const handleLoadSample = useCallback(
    (sample) => {
      stopPlayback();
      setDocTitle(sample.title);
      setDocText(sample.text);
      setDocSourceType('tts');
      setPdfState(null);
      setActiveDocId(null);
      setCurrentSentenceIndex(0);
      setIsFavorite(false);
      if (sample.lang) {
        updatePreference('language', sample.lang);
      }
      showNotice('success', `Loaded sample: "${sample.title}".`);
    },
    [showNotice, stopPlayback, updatePreference]
  );

  const handleClearText = useCallback(() => {
    stopPlayback();
    setDocText('');
    setDocTitle('Untitled Document');
    setActiveDocId(null);
    setPdfState(null);
    setCurrentSentenceIndex(0);
    setTtsEditMode(true);
  }, [stopPlayback]);

  const handleDownloadText = useCallback(
    (customDoc) => {
      const content = customDoc ? customDoc.text : docText;
      const name = (customDoc ? customDoc.title : docTitle) || 'voicereader-text';
      if (!content || !content.trim()) {
        showNotice('error', 'No text available to download.');
        return;
      }
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9-_]+/gi, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [docText, docTitle, showNotice]
  );

  const handleToggleFavorite = useCallback(
    async (targetId) => {
      const idToUpdate = targetId || activeDocId;
      if (!idToUpdate) {
        const createdId = await persistCurrentDocument({
          title: docTitle,
          sourceType: docSourceType,
          text: docText,
          sentenceIndex: currentSentenceIndex,
          favorite: true,
        });
        if (createdId) {
          setIsFavorite(true);
          showNotice('success', 'Saved to favorites.');
        }
        return;
      }

      const existing = historyDocs.find((d) => d.id === idToUpdate);
      const nextFav = existing ? !existing.isFavorite : !isFavorite;
      await updateDocumentProgress(idToUpdate, { isFavorite: nextFav });
      if (idToUpdate === activeDocId) {
        setIsFavorite(nextFav);
      }
      await refreshHistory();
    },
    [
      activeDocId,
      currentSentenceIndex,
      docSourceType,
      docText,
      docTitle,
      historyDocs,
      isFavorite,
      persistCurrentDocument,
      refreshHistory,
      showNotice,
    ]
  );

  const handleOpenHistoryDoc = useCallback(
    (doc) => {
      stopPlayback();
      setActiveDocId(doc.id);
      setDocTitle(doc.title || 'Untitled Document');
      setDocSourceType(doc.sourceType || 'tts');
      setDocText(doc.text || '');
      setIsFavorite(Boolean(doc.isFavorite));
      setCurrentSentenceIndex(doc.currentSentenceIndex || 0);
      setPdfState(null);

      if (doc.sourceType === 'tts') {
        setTtsEditMode(false);
        setActiveTab('tts');
      } else {
        setActiveTab('document');
      }
      if (doc.text) {
        applyDetectedLanguage(doc.text, false);
      }
      showNotice('success', `Resumed "${doc.title}" at sentence ${(doc.currentSentenceIndex || 0) + 1}.`);
    },
    [applyDetectedLanguage, showNotice, stopPlayback]
  );

  const handleDeleteHistoryDoc = useCallback(
    async (id) => {
      await deleteDocumentRecord(id);
      if (id === activeDocId) {
        setActiveDocId(null);
      }
      await refreshHistory();
    },
    [activeDocId, refreshHistory]
  );

  const handleClearAllHistory = useCallback(async () => {
    await clearAllDocuments();
    setActiveDocId(null);
    await refreshHistory();
    showNotice('success', 'Cleared saved reading history.');
  }, [refreshHistory, showNotice]);

  // Global keyboard shortcuts (disabled when typing inside inputs)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        e.target?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying && !isPaused) {
          handlePause();
        } else if (isPaused) {
          handleResume();
        } else {
          handlePlay();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSentence();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSentence();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRepeatSentence();
      } else if (e.key === 's' || e.key === 'S' || e.key === 'Escape') {
        if (isPlaying || isPaused) {
          e.preventDefault();
          stopPlayback();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNextSentence,
    handlePause,
    handlePlay,
    handlePrevSentence,
    handleRepeatSentence,
    handleResume,
    isPaused,
    isPlaying,
    stopPlayback,
  ]);

  const currentParagraphIndex = useMemo(() => {
    const s = sentences[currentSentenceIndex];
    return s ? s.paragraphIndex : 0;
  }, [sentences, currentSentenceIndex]);

  const playbackState = {
    isPlaying,
    isPaused,
    currentSentenceIndex,
    totalSentences: sentences.length,
    currentParagraphIndex,
    totalParagraphs: paragraphs.length,
  };

  const playbackActions = {
    play: handlePlay,
    pause: handlePause,
    resume: handleResume,
    stop: stopPlayback,
    prevSentence: handlePrevSentence,
    nextSentence: handleNextSentence,
    repeatSentence: handleRepeatSentence,
    seekSentence: handleSeekSentence,
  };

  const renderSharedPlayerPanel = () => (
    <div className="reader-control-card vr-card">
      <VoiceSelector
        voices={voices}
        selectedLanguage={preferences.language}
        selectedVoiceURI={preferences.voiceURI}
        genderFilter={preferences.genderFilter}
        pitch={preferences.pitch}
        onLanguageChange={(lang) => updatePreference('language', lang)}
        onVoiceChange={(uri) => updatePreference('voiceURI', uri)}
        onGenderFilterChange={(g) => updatePreference('genderFilter', g)}
        onPitchChange={(p) => updatePreference('pitch', p)}
      />
      <SpeechControls
        isPlaying={isPlaying}
        isPaused={isPaused}
        hasContent={sentences.length > 0}
        currentIndex={currentSentenceIndex}
        totalSentences={sentences.length}
        rate={preferences.rate}
        volume={preferences.volume}
        readingMode={preferences.readingMode}
        onPlay={handlePlay}
        onPause={handlePause}
        onResume={handleResume}
        onStop={stopPlayback}
        onPrevSentence={handlePrevSentence}
        onNextSentence={handleNextSentence}
        onRepeatSentence={handleRepeatSentence}
        onRateChange={(r) => updatePreference('rate', r)}
        onVolumeChange={(v) => updatePreference('volume', v)}
        onReadingModeChange={(m) => updatePreference('readingMode', m)}
      />
      <ReadingProgress
        currentIndex={currentSentenceIndex}
        totalSentences={sentences.length}
        estimatedTotalSeconds={textStats.estimatedMinutes * 60}
        isPlaying={isPlaying}
        isPaused={isPaused}
        onSeekSentence={handleSeekSentence}
        currentParagraphIndex={currentParagraphIndex}
        totalParagraphs={paragraphs.length}
      />
    </div>
  );

  const tabInfo = TAB_TITLES[activeTab] || TAB_TITLES.home;

  return (
    <div className="vr-app-shell">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={preferences.theme}
        onToggleTheme={() =>
          updatePreference('theme', preferences.theme === 'dark' ? 'light' : 'dark')
        }
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        historyCount={historyDocs.length}
      />

      <div className="vr-main-area">
        <header className="vr-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <FiMenu />
            </button>
            <div className="topbar-title-block">
              <h2 className="topbar-title">{tabInfo.title}</h2>
              <span className="topbar-subtitle">{tabInfo.subtitle}</span>
            </div>
          </div>

          <div className="topbar-right">
            {isPlaying && (
              <span className="topbar-live-pill">
                <span className="live-pulse" />
                <FiVolume2 aria-hidden="true" />
                <span>{isPaused ? 'Paused' : 'Speaking'}</span>
              </span>
            )}
            <button
              type="button"
              className="vr-btn"
              onClick={() =>
                updatePreference('theme', preferences.theme === 'dark' ? 'light' : 'dark')
              }
              aria-label="Toggle color theme"
            >
              {preferences.theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
          </div>
        </header>

        <main className="vr-content">
          {!ttsSupported && (
            <div className="vr-alert is-warning" role="alert">
              <div className="vr-alert-content">
                <FiAlertCircle aria-hidden="true" />
                <span>
                  Your browser does not support the Web Speech API. Document text extraction still works, and you can export extracted text.
                </span>
              </div>
            </div>
          )}

          {notification && (
            <div className={`vr-alert is-${notification.type}`} role="status">
              <div className="vr-alert-content">
                {notification.type === 'success' ? (
                  <FiCheckCircle aria-hidden="true" />
                ) : (
                  <FiAlertCircle aria-hidden="true" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                className="vr-alert-close"
                onClick={() => setNotification(null)}
                aria-label="Dismiss notification"
              >
                <FiX />
              </button>
            </div>
          )}

          {activeTab === 'home' && (
            <Dashboard
              text={docText}
              title={docTitle}
              onTextChange={handleTextUpdate}
              onStartReading={() => {
                setTtsEditMode(false);
                handlePlay();
              }}
              onUploadDocument={handleFileUpload}
              isUploading={isProcessingFile}
              voices={voices}
              preferences={preferences}
              onUpdatePreference={updatePreference}
              playbackState={playbackState}
              playbackActions={playbackActions}
              recentDocuments={historyDocs}
              onOpenRecentDocument={handleOpenHistoryDoc}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'tts' && (
            <div className="reader-workspace fade-in">
              {renderSharedPlayerPanel()}
              <div className="tts-dual-grid">
                <TextInput
                  text={docText}
                  title={docTitle}
                  onTextChange={(t) => handleTextUpdate(t)}
                  onTitleChange={setDocTitle}
                  onLoadSample={handleLoadSample}
                  onClear={handleClearText}
                  onDownloadText={() => handleDownloadText()}
                  onStartReading={() => {
                    setTtsEditMode(false);
                    handlePlay();
                  }}
                  rate={preferences.rate}
                  isEditingMode={ttsEditMode}
                  onToggleEditMode={() => setTtsEditMode((m) => !m)}
                />
                <DocumentViewer
                  title={docTitle}
                  sourceType="tts"
                  paragraphs={paragraphs}
                  currentSentenceIndex={currentSentenceIndex}
                  isPlaying={isPlaying && !isPaused}
                  wordHighlight={wordHighlight}
                  isFavorite={isFavorite}
                  onToggleFavorite={() => handleToggleFavorite()}
                  onSelectSentence={(idx) => speakSentenceAt(idx)}
                  onPlayParagraph={handlePlayParagraph}
                  onDownloadText={() => handleDownloadText()}
                />
              </div>
            </div>
          )}

          {activeTab === 'pdf' && (
            <div className="reader-workspace fade-in">
              {renderSharedPlayerPanel()}
              <PDFViewer
                pdfState={pdfState}
                currentPageText={docText}
                paragraphs={paragraphs}
                currentSentenceIndex={currentSentenceIndex}
                isPlaying={isPlaying && !isPaused}
                wordHighlight={wordHighlight}
                isFavorite={isFavorite}
                isExtracting={isProcessingFile}
                ocrProgress={ocrProgress}
                ocrLanguage={preferences.ocrLanguage || 'auto'}
                autoContinuePages={autoContinuePages}
                onUploadPdf={handleFileUpload}
                onPageChange={(page) => {
                  stopPlayback();
                  loadPdfPage(pdfState, page, false);
                }}
                onPageRangeChange={(start, end) =>
                  setPdfState((prev) =>
                    prev ? { ...prev, rangeStart: start, rangeEnd: end } : prev
                  )
                }
                onOcrLanguageChange={(lang) => updatePreference('ocrLanguage', lang)}
                onRunOcrCurrentPage={handleRunOcrCurrentPage}
                onToggleAutoContinue={setAutoContinuePages}
                onToggleFavorite={() => handleToggleFavorite()}
                onSelectSentence={(idx) => speakSentenceAt(idx)}
                onPlayParagraph={handlePlayParagraph}
                onDownloadText={() => handleDownloadText()}
                onStartReadingPage={() => {
                  paragraphLockRef.current = null;
                  speakSentenceAt(0);
                }}
              />
            </div>
          )}

          {activeTab === 'document' && (
            <div className="reader-workspace fade-in">
              {renderSharedPlayerPanel()}
              <FileUploader
                accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm"
                title="Upload Word (.docx), Text (.txt), PDF, or Markdown Document"
                subtitle="Extract structured headings and paragraphs cleanly for distraction-free listening."
                onFileSelected={handleFileUpload}
                isLoading={isProcessingFile}
                loadingMessage="Extracting document content..."
              />
              <DocumentViewer
                title={docTitle}
                sourceType={docSourceType}
                paragraphs={paragraphs}
                currentSentenceIndex={currentSentenceIndex}
                isPlaying={isPlaying && !isPaused}
                wordHighlight={wordHighlight}
                isFavorite={isFavorite}
                onToggleFavorite={() => handleToggleFavorite()}
                onSelectSentence={(idx) => speakSentenceAt(idx)}
                onPlayParagraph={handlePlayParagraph}
                onDownloadText={() => handleDownloadText()}
              />
            </div>
          )}

          {activeTab === 'history' && (
            <ReadingHistory
              documents={historyDocs}
              onOpenDocument={handleOpenHistoryDoc}
              onToggleFavorite={handleToggleFavorite}
              onDeleteDocument={handleDeleteHistoryDoc}
              onClearAll={handleClearAllHistory}
              onDownloadDocument={handleDownloadText}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              preferences={preferences}
              voices={voices}
              onUpdatePreference={updatePreference}
              onResetPreferences={() => {
                setPreferences({ ...DEFAULT_PREFERENCES });
                showNotice('success', 'Preferences reset to defaults.');
              }}
              onClearAllHistory={handleClearAllHistory}
            />
          )}
        </main>
      </div>
    </div>
  );
}


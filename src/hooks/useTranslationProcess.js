/* --- src/hooks/useTranslationProcess.js --- */
import { useState, useRef, useEffect } from 'react';
import { getBulkPronunciations } from '../transliterator';

const formatAdlibPronunciation = (adlibText, displayPron) => {
  if (!displayPron) return null;
  return JSON.stringify({
    full: displayPron,
    chunks: [{ type: 'foreign', text: adlibText, trans: displayPron }]
  });
};

const normalizeForComparison = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, '')
    .trim();

const fetchGoogleWithLang = async (text, sl = 'auto') => {
  if (!text) return { translation: '', transliteration: null, srcLang: 'auto' };
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=en&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();

    let translation = '';
    let transliteration = '';
    let srcLang = data?.[2] || 'auto';

    if (data && data[0]) {
      for (let i = 0; i < data[0].length; i++) {
        if (data[0][i][0] && data[0][i][1]) {
          translation += data[0][i][0];
        }
      }
      const last = data[0][data[0].length - 1];
      if (last && (last[2] || last[3]) && !last[1]) {
        transliteration = last[2] || last[3] || '';
      } else if (data[0].length > 1) {
        const possibleRom = data[0].find(item => item[2] || item[3]);
        if (possibleRom) transliteration = possibleRom[2] || possibleRom[3];
      }
    }

    return {
      translation: translation.trim(),
      transliteration: transliteration ? transliteration.trim() : null,
      srcLang
    };
  } catch (error) {
    console.warn("Google Translate API error:", error);
    return { translation: '', transliteration: null, srcLang: sl || 'auto' };
  }
};

export const useTranslationProcess = ({
  workspaceData,
  setWorkspaceData,
  listContainerRef,
  setNotification,
  setConfirmModalState,
  setIsTranslationManagerOpen,
  hasUnsavedChanges
}) => {
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [activeTranslatingId, setActiveTranslatingId] = useState(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0 });

  const activeRowRef = useRef(null);
  const cancelTranslationRef = useRef(false);

  useEffect(() => {
    if (activeTranslatingId !== null && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeTranslatingId]);

  useEffect(() => {
    return () => {
      cancelTranslationRef.current = true;
    };
  }, []);

  const fetchSingleLine = async (line) => {
    let textToTranslate = line.displayText;
    if (!line._meta.isAdlib && line.isSplit && line.adlibs) {
      line.adlibs.forEach(a => {
        textToTranslate = textToTranslate.replace(a.text, '');
      });
    }
    
    // Leaving hyphens and brackets perfectly intact
    textToTranslate = textToTranslate.replace(/\s+/g, ' ').trim();

    if (!textToTranslate) return null;

    try {
      const sourceLang = line.lang || 'auto';
      const rawData = await fetchGoogleWithLang(textToTranslate, sourceLang);
      const resArr = await getBulkPronunciations([textToTranslate], null);
      const res = resArr?.[0] || {};

      return {
        ...res,
        translation: rawData.translation || res.translation || '',
        srcLang: rawData.srcLang || sourceLang
      };
    } catch (e) {
      console.error("Single line fetch error:", e);
      return null;
    }
  };

  const stopTranslationProcess = () => {
    cancelTranslationRef.current = true;
    setIsTranslatingAll(false);
    setActiveTranslatingId(null);
    setNotification({ show: true, message: 'Translation stopped.', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 1500);
  };

  const handleRefreshWorkspace = () => {
    setConfirmModalState({
      isOpen: true,
      title: "Wipe All Translations",
      message: "Are you sure you want to refresh lyrics? This will wipe out all translation, transliteration, and reset language tags to auto.",
      confirmText: "Wipe Fields",
      cancelText: "Cancel",
      onConfirm: () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        cancelTranslationRef.current = true;
        setIsTranslatingAll(false);
        setActiveTranslatingId(null);

        const wipedData = workspaceData.map(line => ({
          ...line,
          translation: '',
          displayPron: '',
          pronunciation: '',
          lang: 'auto'
        }));

        setWorkspaceData(wipedData);
        if (listContainerRef.current) listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        
        setNotification({ show: true, message: 'Wiped all translation and transliteration fields!', progress: 100 });
        setTimeout(() => setNotification({ show: false }), 2000);
      }
    });
  };

  const handleTranslateAll = async () => {
    if (isTranslatingAll) {
      stopTranslationProcess();
      return;
    }
    if (workspaceData.length === 0) return;

    cancelTranslationRef.current = false;
    setIsTranslatingAll(true);
    setShowSuccessBanner(false);
    setTranslateProgress({ current: 0, total: workspaceData.length });
    setNotification({ show: true, message: 'Starting Translation...', progress: 0 });

    const lineTranslationCache = new Map();
    let currentData = [...workspaceData];

    for (let i = 0; i < currentData.length; i++) {
      if (cancelTranslationRef.current) break;
      const line = currentData[i];

      // RULE: Skip already tagged 'en' lines
      if (line.lang === 'en') {
        currentData[i] = {
          ...currentData[i],
          translation: '',
          displayPron: '',
          pronunciation: ''
        };
        setWorkspaceData([...currentData]);
        continue;
      }

      setActiveTranslatingId(line.rowId);
      setTranslateProgress({ current: i + 1, total: currentData.length });
      const progressPct = Math.round(((i + 1) / currentData.length) * 100);
      setNotification({
        show: true,
        message: `Translating line ${i + 1} of ${currentData.length}...`,
        progress: progressPct
      });

      let textKey = line.displayText;
      if (!line._meta.isAdlib && line.isSplit && line.adlibs) {
        line.adlibs.forEach(a => {
          textKey = textKey.replace(a.text, '');
        });
      }
      
      const cacheKey = textKey.trim().toLowerCase();

      let res = null;
      if (cacheKey && lineTranslationCache.has(cacheKey)) {
        res = lineTranslationCache.get(cacheKey);
      } else {
        res = await fetchSingleLine(line);
        if (res && cacheKey) {
          lineTranslationCache.set(cacheKey, res);
        }
      }

      if (cancelTranslationRef.current) break;

      if (res) {
        let rawTransText = res.translation !== undefined ? String(res.translation).trim() : '';
        const normOriginal = normalizeForComparison(line.displayText);
        const normTranslated = normalizeForComparison(rawTransText);
        
        // RULE: If translation yields same as main lyrics, set lang to "en" and leave fields blank
        const isEnglishMatch = normOriginal.length > 0 && normOriginal === normTranslated;
        const finalLang = isEnglishMatch ? 'en' : (res.srcLang || line.lang || 'auto');

        let displayPron = line.displayPron;
        let finalPron = res.pronunciation || line.pronunciation;

        if (isEnglishMatch || finalLang === 'en') {
          rawTransText = '';
          displayPron = '';
          finalPron = '';
        } else {
          if (res.pronunciation) {
            try {
              const p = JSON.parse(res.pronunciation);
              displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
            } catch (e) {}
          } else if (rawTransText && !/[^\x00-\x7F]/.test(line.displayText)) {
            displayPron = '';
            finalPron = '';
          }

          if (line._meta.isAdlib) {
            finalPron = formatAdlibPronunciation(line.displayText, displayPron);
          }
        }

        currentData[i] = {
          ...currentData[i],
          translation: rawTransText,
          pronunciation: finalPron,
          displayPron: displayPron,
          lang: finalLang
        };
        setWorkspaceData([...currentData]);
      }

      if (!lineTranslationCache.has(cacheKey)) {
        await new Promise(r => setTimeout(r, 120));
      }
    }

    const completedAll = !cancelTranslationRef.current;
    setIsTranslatingAll(false);
    setActiveTranslatingId(null);

    if (completedAll) {
      setShowSuccessBanner(true);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setNotification({ show: true, message: 'All lines translated! Ready to Save.', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
      setTimeout(() => setShowSuccessBanner(false), 4000);
    }
  };

  const handleTranslateWithContext = async () => {
    if (isTranslatingAll) {
      stopTranslationProcess();
      return;
    }
    if (workspaceData.length === 0) return;

    cancelTranslationRef.current = false;
    setIsTranslatingAll(true);
    setShowSuccessBanner(false);
    setTranslateProgress({ current: 0, total: workspaceData.length });
    setNotification({ show: true, message: 'Grouping lines by language...', progress: 0 });

    let currentData = [...workspaceData];

    // 1. Clear existing 'en' lines directly
    for (let i = 0; i < currentData.length; i++) {
      if (currentData[i].lang === 'en') {
        currentData[i] = {
          ...currentData[i],
          translation: '',
          displayPron: '',
          pronunciation: ''
        };
      }
    }
    setWorkspaceData([...currentData]);

    // 2. Group all non-'en' lines strictly by their language tag
    const groups = {};
    currentData.forEach((line, index) => {
      if (line.lang === 'en') return;
      const lang = line.lang || 'auto';
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push({ line, index });
    });

    // 3. Process each language group in one shot
    const langs = Object.keys(groups);
    for (let gIdx = 0; gIdx < langs.length; gIdx++) {
      if (cancelTranslationRef.current) break;
      const lang = langs[gIdx];
      const items = groups[lang];

      setNotification({ show: true, message: `Translating [${lang}] batch (${items.length} lines)...`, progress: 10 });

      // Highlight the first item of the batch while waiting for translation response
      if (items.length > 0) {
        setActiveTranslatingId(currentData[items[0].index].rowId);
      }

      // Prepare lyrics 
      const cleanTexts = items.map(({ line }) => {
        let text = line.displayText;
        if (!line._meta.isAdlib && line.isSplit && line.adlibs) {
          line.adlibs.forEach(a => { text = text.replace(a.text, ''); });
        }
        
        // Remove any existing instances of our ♫ delimiter from the source text just in case
        const clean = text.replace(/♫/g, '').replace(/\s+/g, ' ').trim();
        return clean.length > 0 ? clean : ' '; 
      });

      // Build the continuous contextual string using the musical note delimiter between lines
      const combinedText = cleanTexts.join(' ♫ ');

      try {
        // Use POST request to Google Translate to bypass URL length limits on massive lyric payloads
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(lang)}&tl=en&dt=t`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({ q: combinedText })
        });
        const data = await response.json();

        let combinedTranslation = '';
        let detectedLang = data?.[2] || lang;
        if (data && data[0]) {
          data[0].forEach(item => {
            if (item[0]) combinedTranslation += item[0];
          });
        }

        // Split incoming string based on the musical delimiter (allowing for spaces around it)
        const translatedLines = combinedTranslation.split(/\s*♫\s*/).map(l => l.trim());
        
        // ULTIMATE FALLBACK FIX: Verify that Google didn't swallow a delimiter by grammatical merging
        const isAligned = translatedLines.length === items.length;
        if (!isAligned) {
          console.warn(`Context translation mismatch for [${lang}]: Expected ${items.length} lines, got ${translatedLines.length}. Falling back to 1:1 independent translations to prevent layout offset.`);
        }

        // Fetch pronunciations sequentially for this group, moving the highlight as it progresses
        const batchPronunciations = await getBulkPronunciations(cleanTexts, (current, total) => {
           const currentIdx = current - 1;
           if (items[currentIdx]) {
             setActiveTranslatingId(currentData[items[currentIdx].index].rowId);
           }
           
           setNotification({
             show: true,
             message: `Transliterating [${lang}] (${current}/${total})...`,
             progress: Math.round((current / total) * 100)
           });
        });

        if (cancelTranslationRef.current) break;

        // Map results back to their correct absolute indices in the workspace
        items.forEach((item, i) => {
          const targetIdx = item.index;
          const line = currentData[targetIdx];

          // If arrays don't align perfectly, discard the context batch and use the 1:1 transliterator translation
          let rawTransText = (isAligned && translatedLines[i] !== undefined) 
            ? translatedLines[i] 
            : (batchPronunciations[i]?.translation || line.translation);
          
          if (rawTransText) rawTransText = String(rawTransText).trim();

          const normOrig = normalizeForComparison(cleanTexts[i]);
          const normTrans = normalizeForComparison(rawTransText);
          const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans;
          const finalLang = isEnglishMatch ? 'en' : (detectedLang || line.lang || 'auto');

          let displayPron = line.displayPron;
          let finalPron = batchPronunciations[i]?.pronunciation || line.pronunciation;

          if (isEnglishMatch || finalLang === 'en') {
            rawTransText = '';
            displayPron = '';
            finalPron = '';
          } else {
            if (batchPronunciations[i]?.pronunciation) {
              try {
                const p = JSON.parse(batchPronunciations[i].pronunciation);
                displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
              } catch (e) {}
            } else if (rawTransText && !/[^\x00-\x7F]/.test(line.displayText)) {
              displayPron = '';
              finalPron = '';
            }
          }

          if (!isEnglishMatch && line._meta.isAdlib) {
            finalPron = formatAdlibPronunciation(line.displayText, displayPron);
          }

          currentData[targetIdx] = {
            ...line,
            translation: isEnglishMatch ? '' : rawTransText,
            pronunciation: isEnglishMatch ? '' : finalPron,
            displayPron: isEnglishMatch ? '' : displayPron,
            lang: finalLang
          };
        });

        setWorkspaceData([...currentData]);
      } catch (err) {
        console.error("Context batch translation error:", err);
      }
    }

    const completedAll = !cancelTranslationRef.current;
    setIsTranslatingAll(false);
    setActiveTranslatingId(null);

    if (completedAll) {
      setShowSuccessBanner(true);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setNotification({ show: true, message: 'Context Translation complete! Ready to Save.', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
      setTimeout(() => setShowSuccessBanner(false), 4000);
    }
  };

  const handleRefetch = async (index) => {
    const line = workspaceData[index];
    setActiveTranslatingId(line.rowId);
    setNotification({ show: true, message: `Translating line ${index + 1}...`, progress: null });

    const res = await fetchSingleLine(line);

    if (res) {
      const newData = [...workspaceData];
      
      let rawTransText = res.translation !== undefined ? res.translation : newData[index].translation;
      if (rawTransText) rawTransText = String(rawTransText).trim();

      const normOrig = normalizeForComparison(line.displayText);
      const normTrans = normalizeForComparison(rawTransText);
      const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans;
      const finalLang = isEnglishMatch ? 'en' : (res.srcLang || line.lang || 'auto');

      let displayPron = '';
      if (!isEnglishMatch && res.pronunciation) {
        try {
          const p = JSON.parse(res.pronunciation);
          displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
        } catch (e) {}
      }

      newData[index].lang = finalLang;
      newData[index].translation = isEnglishMatch ? '' : rawTransText;
      newData[index].displayPron = isEnglishMatch ? '' : displayPron;

      if (isEnglishMatch) {
        newData[index].pronunciation = '';
      } else if (line._meta.isAdlib) {
        newData[index].pronunciation = formatAdlibPronunciation(line.displayText, displayPron);
      } else {
        newData[index].pronunciation = res.pronunciation || '';
      }

      setWorkspaceData(newData);
    }

    setActiveTranslatingId(null);
    setNotification({ show: true, message: 'Line translated!', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 1500);
  };

  const handleCancel = () => {
    if (isTranslatingAll) {
      stopTranslationProcess();
      return;
    }
    if (hasUnsavedChanges) {
      setConfirmModalState({
        isOpen: true,
        title: "Discard Translation Changes?",
        message: "You have unsaved translation changes. Are you sure you want to discard them and close?",
        confirmText: "Discard & Close",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
          cancelTranslationRef.current = true;
          setIsTranslationManagerOpen(false);
        }
      });
      return;
    }
    cancelTranslationRef.current = true;
    setIsTranslationManagerOpen(false);
  };

  return {
    isTranslatingAll,
    activeTranslatingId,
    showSuccessBanner,
    translateProgress,
    activeRowRef,
    cancelTranslationRef,
    handleRefreshWorkspace,
    handleTranslateAll,
    handleTranslateWithContext,
    handleRefetch,
    handleCancel
  };
};
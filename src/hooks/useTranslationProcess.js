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
    
    textToTranslate = textToTranslate.replace(/\s+/g, ' ').trim();
    if (!textToTranslate) return null;
    
    try {
      const sourceLang = line.lang || 'auto';
      const hasNumbers = /\d/.test(textToTranslate);
      
      let targetLang = sourceLang;
      let rawTranslation = '';
      let detectedSrc = sourceLang;
      
      // OPTIMIZATION: Only do the redundant double-fetch if it's 'auto' AND has numbers
      if (hasNumbers && sourceLang === 'auto') {
        const rawData = await fetchGoogleWithLang(textToTranslate, sourceLang);
        targetLang = rawData.srcLang || sourceLang;
        rawTranslation = rawData.translation;
        detectedSrc = rawData.srcLang;
      }
      
      // This handles translation AND transliteration natively in one go
      const resArr = await getBulkPronunciations([textToTranslate], null, targetLang);
      const res = resArr?.[0] || {};
      
      return {
        ...res,
        translation: rawTranslation || res.translation || '',
        srcLang: detectedSrc
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
    
    let currentData = [...workspaceData];
    let completedCount = 0;

    const promises = currentData.map(async (line, i) => {
      if (cancelTranslationRef.current) return null;
      
      if (line.lang === 'en') {
        completedCount++;
        setTranslateProgress({ current: completedCount, total: currentData.length });
        return { index: i, data: { ...line, translation: '', displayPron: '', pronunciation: '' } };
      }
      
      const res = await fetchSingleLine(line);
      
      completedCount++;
      const progressPct = Math.round((completedCount / currentData.length) * 100);
      setTranslateProgress({ current: completedCount, total: currentData.length });
      setNotification({ show: true, message: `Translating (${completedCount}/${currentData.length})...`, progress: progressPct });

      if (!res) return null;

      let rawTransText = res.translation !== undefined ? String(res.translation).trim() : '';
      const normOriginal = normalizeForComparison(line.displayText);
      const normTranslated = normalizeForComparison(rawTransText);
      
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
      
      return {
        index: i,
        data: {
          ...line,
          translation: rawTransText,
          pronunciation: finalPron,
          displayPron: displayPron,
          lang: finalLang
        }
      };
    });

    const results = await Promise.all(promises);

    if (cancelTranslationRef.current) {
      setIsTranslatingAll(false);
      return;
    }

    const newData = [...currentData];
    results.forEach(r => {
      if (r) newData[r.index] = r.data;
    });
    
    setWorkspaceData(newData);
    setIsTranslatingAll(false);
    setActiveTranslatingId(null);
    
    setShowSuccessBanner(true);
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setNotification({ show: true, message: 'All lines translated! Ready to Save.', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 2000);
    setTimeout(() => setShowSuccessBanner(false), 4000);
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
    
    const groups = {};
    currentData.forEach((line, index) => {
      if (line.lang === 'en') return;
      const lang = line.lang || 'auto';
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push({ line, index });
    });
    
    const langs = Object.keys(groups);
    for (let gIdx = 0; gIdx < langs.length; gIdx++) {
      if (cancelTranslationRef.current) break;
      const lang = langs[gIdx];
      const items = groups[lang];
      
      setNotification({ show: true, message: `Translating [${lang}] batch (${items.length} lines)...`, progress: 10 });
      
      if (items.length > 0) {
        setActiveTranslatingId(currentData[items[0].index].rowId);
      }
      
      const cleanTexts = items.map(({ line }) => {
        let text = line.displayText;
        if (!line._meta.isAdlib && line.isSplit && line.adlibs) {
          line.adlibs.forEach(a => { text = text.replace(a.text, ''); });
        }
        
        const clean = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        return clean.length > 0 ? clean : ' '; 
      });
      
      // NEW DELIMITER LOGIC: Add bracketed numbers at the start of each line, separated by newlines
      const combinedText = cleanTexts.map((text, i) => `[${i + 1}] ${text}`).join('\n');
      
      try {
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
        
        // Extract translated text dynamically using the bracketed markers
        const translatedLines = new Array(items.length).fill(undefined);
        // Robust regex that matches [1], (1), or Asian brackets 【1】 and captures the text until the next marker
        const regex = /[\[\(\【]\s*(\d+)\s*[\]\)\】]\s*([\s\S]*?)(?=[\[\(\【]\s*\d+\s*[\]\)\】]|$)/g;
        
        let match;
        let matchesFound = 0;
        
        while ((match = regex.exec(combinedTranslation)) !== null) {
          const lineIndex = parseInt(match[1], 10) - 1;
          const textPart = match[2].trim();
          
          if (lineIndex >= 0 && lineIndex < items.length) {
            if (translatedLines[lineIndex] === undefined) {
                translatedLines[lineIndex] = textPart;
                matchesFound++;
            }
          }
        }
        
        // Ensure no line was swallowed into a blank string during mapping
        const isAligned = matchesFound === items.length && !translatedLines.some((t, i) => t === '' && cleanTexts[i] !== ' ');
        if (!isAligned) {
          console.warn(`Context translation mismatch for [${lang}]: Expected ${items.length} markers, found ${matchesFound}. Falling back to 1:1 translations.`);
        }
        
        const hasNumbersInBatch = cleanTexts.some(text => /\d/.test(text));
        const translitLang = (hasNumbersInBatch && lang === 'auto') ? detectedLang : lang;
        
        const batchPronunciations = await getBulkPronunciations(cleanTexts, (current, total) => {
           setNotification({
             show: true,
             message: `Transliterating [${translitLang}] (${current}/${total})...`,
             progress: Math.round((current / total) * 100)
           });
        }, translitLang);
        
        if (cancelTranslationRef.current) break;
        
        items.forEach((item, i) => {
          const targetIdx = item.index;
          const line = currentData[targetIdx];
          
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
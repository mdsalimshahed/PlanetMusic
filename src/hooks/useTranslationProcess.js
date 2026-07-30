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
      textToTranslate = textToTranslate.replace(/\s+/g, ' ').trim();
    }
    textToTranslate = textToTranslate.replace(/[()]/g, '').trim();
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
      const cacheKey = textKey.replace(/[()]/g, '').trim().toLowerCase();
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
        let rawTransText = res.translation !== undefined ? String(res.translation).replace(/[()]/g, '').trim() : '';
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
    setNotification({ show: true, message: 'Starting Context Translation...', progress: 0 });

    let currentData = [...workspaceData];
    let i = 0;
    while (i < currentData.length) {
      if (cancelTranslationRef.current) break;

      // RULE: Skip already tagged 'en' lines
      if (currentData[i].lang === 'en') {
        currentData[i] = {
          ...currentData[i],
          translation: '',
          displayPron: '',
          pronunciation: ''
        };
        setWorkspaceData([...currentData]);
        i++;
        continue;
      }

      if (currentData[i]._meta.isAdlib) {
        const adlibRes = await fetchSingleLine(currentData[i]);
        if (adlibRes) {
          let rawTransText = adlibRes.translation ? String(adlibRes.translation).replace(/[()]/g, '').trim() : '';
          const normOrig = normalizeForComparison(currentData[i].displayText);
          const normTrans = normalizeForComparison(rawTransText);

          const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans;
          const finalLang = isEnglishMatch ? 'en' : (adlibRes.srcLang || currentData[i].lang || 'auto');

          let displayPron = '';
          if (!isEnglishMatch && adlibRes.pronunciation) {
            try {
              const p = JSON.parse(adlibRes.pronunciation);
              displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
            } catch(e) {}
          }

          let finalPron = isEnglishMatch ? '' : formatAdlibPronunciation(currentData[i].displayText, displayPron);

          currentData[i] = {
            ...currentData[i],
            translation: isEnglishMatch ? '' : (rawTransText || currentData[i].translation),
            pronunciation: isEnglishMatch ? '' : (finalPron || currentData[i].pronunciation),
            displayPron: isEnglishMatch ? '' : (displayPron || currentData[i].displayPron),
            lang: finalLang
          };
          setWorkspaceData([...currentData]);
        }
        i++;
        continue;
      }

      const mainBatchIndices = [];
      const adlibIndicesToProcess = [];
      let ptr = i;
      while (ptr < currentData.length && mainBatchIndices.length < 3) {
        if (currentData[ptr].lang === 'en') {
          ptr++;
          continue;
        }
        if (!currentData[ptr]._meta.isAdlib) {
          mainBatchIndices.push(ptr);
        } else {
          adlibIndicesToProcess.push(ptr);
        }
        ptr++;
      }
      if (mainBatchIndices.length === 0) {
        i = ptr > i ? ptr : i + 1;
        continue;
      }

      setActiveTranslatingId(currentData[mainBatchIndices[0]].rowId);
      const lastProcessedIdx = ptr - 1;
      setTranslateProgress({ current: lastProcessedIdx + 1, total: currentData.length });
      const progressPct = Math.round(((lastProcessedIdx + 1) / currentData.length) * 100);
      setNotification({
        show: true,
        message: `Translating context batch (${lastProcessedIdx + 1}/${currentData.length})...`,
        progress: progressPct
      });

      const cleanMainTexts = mainBatchIndices.map(idx => {
        const line = currentData[idx];
        let text = line.displayText;
        if (line.isSplit && line.adlibs) {
          line.adlibs.forEach(a => { text = text.replace(a.text, ''); });
        }
        return text.replace(/[()]/g, '').trim();
      });

      try {
        const combinedText = cleanMainTexts.join('\n');
        const firstLineLang = currentData[mainBatchIndices[0]].lang || 'auto';
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(firstLineLang)}&tl=en&dt=t&q=${encodeURIComponent(combinedText)}`;
        const response = await fetch(url);
        const data = await response.json();
        let combinedTranslation = '';
        let detectedLang = data?.[2] || firstLineLang;

        if (data && data[0]) {
          data[0].forEach(item => {
            if (item[0]) combinedTranslation += item[0];
          });
        }
        const translatedLines = combinedTranslation.split('\n').map(l => l.trim());
        const batchPronunciations = await getBulkPronunciations(cleanMainTexts, null);

        if (cancelTranslationRef.current) break;
        mainBatchIndices.forEach((targetIdx, bIdx) => {
          if (currentData[targetIdx]) {
            let rawTransText = translatedLines[bIdx] !== undefined ? translatedLines[bIdx] : (batchPronunciations[bIdx]?.translation || currentData[targetIdx].translation);
            if (rawTransText) rawTransText = String(rawTransText).replace(/[()]/g, '').trim();

            const normOrig = normalizeForComparison(cleanMainTexts[bIdx]);
            const normTrans = normalizeForComparison(rawTransText);

            const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans;
            const finalLang = isEnglishMatch ? 'en' : (detectedLang || currentData[targetIdx].lang || 'auto');

            let displayPron = currentData[targetIdx].displayPron;
            let finalPron = batchPronunciations[bIdx]?.pronunciation || currentData[targetIdx].pronunciation;

            if (isEnglishMatch || finalLang === 'en') {
              rawTransText = '';
              displayPron = '';
              finalPron = '';
            } else {
              if (batchPronunciations[bIdx]?.pronunciation) {
                try {
                  const p = JSON.parse(batchPronunciations[bIdx].pronunciation);
                  displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
                } catch (e) {}
              } else if (rawTransText && !/[^\x00-\x7F]/.test(currentData[targetIdx].displayText)) {
                displayPron = '';
                finalPron = '';
              }
            }

            currentData[targetIdx] = {
              ...currentData[targetIdx],
              translation: rawTransText,
              pronunciation: finalPron,
              displayPron: displayPron,
              lang: finalLang
            };
          }
        });
        setWorkspaceData([...currentData]);
      } catch (err) {
        console.error("Context batch translation error:", err);
      }

      for (const aIdx of adlibIndicesToProcess) {
        if (cancelTranslationRef.current) break;
        const adlibLine = currentData[aIdx];
        const res = await fetchSingleLine(adlibLine);
        if (res) {
          let rawTransText = res.translation !== undefined ? res.translation : adlibLine.translation;
          if (rawTransText) rawTransText = String(rawTransText).replace(/[()]/g, '').trim();

          const normOrig = normalizeForComparison(adlibLine.displayText);
          const normTrans = normalizeForComparison(rawTransText);

          const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans;
          const finalLang = isEnglishMatch ? 'en' : (res.srcLang || adlibLine.lang || 'auto');

          let displayPron = adlibLine.displayPron;
          if (!isEnglishMatch && res.pronunciation) {
            try {
              const p = JSON.parse(res.pronunciation);
              displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
            } catch (e) {}
          }
          let finalPron = isEnglishMatch ? '' : formatAdlibPronunciation(adlibLine.displayText, displayPron);

          currentData[aIdx] = {
            ...currentData[aIdx],
            translation: isEnglishMatch ? '' : rawTransText,
            pronunciation: isEnglishMatch ? '' : finalPron,
            displayPron: isEnglishMatch ? '' : displayPron,
            lang: finalLang
          };
          setWorkspaceData([...currentData]);
        }
      }
      i = ptr;
      await new Promise(r => setTimeout(r, 150));
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
      if (rawTransText) rawTransText = String(rawTransText).replace(/[()]/g, '').trim();

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
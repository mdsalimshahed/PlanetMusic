/* --- src/hooks/translation/useTranslationProcess.js --- */
import { useState, useRef, useEffect } from 'react';
import { getBulkPronunciations } from '../../services/transliterator';

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
  if (!text || text === '') return { translation: '', transliteration: null, srcLang: 'auto' };

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=en&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

// ============================================================================
// EXACT BRUTE-FORCE ALIGNMENT ENGINE HELPERS (From translation_tab_2.html)
// ============================================================================
const isSpacelessScript = (char) => {
  return /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u0e00-\u0e7f\uff00-\uffef]/.test(char);
};

const cleanPunctuationPythonStyle = (str) => {
  if (!str) return '';
  return str.replace(/['!"(),*+.:%;<!¬~=>?\[\\\]^_`।{|}~،؟¿¡”（）‘’？！\-]/g, '').trim();
};

const extractPunctuationMap = (block) => {
  const punctuationRegex = /[\p{P}\p{S}\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]/u;
  let cleanText = '';
  let punctMap = [];

  let currentPrefix = '';
  for (let i = 0; i < block.length; i++) {
    const char = block[i];
    if (punctuationRegex.test(char)) {
      if (cleanText.length === 0) {
        currentPrefix += char;
      } else {
        if (!punctMap[cleanText.length - 1]) {
          punctMap[cleanText.length - 1] = { prefix: '', suffix: '' };
        }
        punctMap[cleanText.length - 1].suffix += char;
      }
    } else {
      cleanText += char;
      punctMap.push({ prefix: currentPrefix, suffix: '' });
      currentPrefix = '';
    }
  }

  if (cleanText.length === 0 && currentPrefix.length > 0) {
    return { cleanText: '', purePunctuation: currentPrefix, punctMap: [] };
  }

  return { cleanText, purePunctuation: null, punctMap };
};

/*
 * PRECISE PORT OF PYTHON chinese_and_japanese(line) BRUTE FORCE ALGORITHM
 */
const runBruteForceAlignment = async (line, fullPron, sl, cancelRef) => {
  const fetchResMain = await fetchGoogleWithLang(line.replace(/\s+/g, ''), sl);
  let k = fetchResMain.transliteration || fullPron || fetchResMain.translation || '';

  let pronCleaned = cleanPunctuationPythonStyle(k.toLowerCase());
  let liner_main = pronCleaned.split(/\s+/).filter(t => t.length > 0).reverse();

  let w = '';
  let character = '';
  let add_to = [];
  let word_gotten = 0;
  let p = ''; 

  const lineChars = Array.from(line).reverse();

  for (let char of lineChars) {
    if (cancelRef && cancelRef.current) break;
    character = char;
    w = character + w;

    let contextStr = `(${line}) — ${w}`;
    let fetchRes = await fetchGoogleWithLang(contextStr, sl);
    let rawP = fetchRes.transliteration || fetchRes.translation || '';

    let parts = rawP.toLowerCase().split('—');
    let lastSegment = parts[parts.length - 1].replace(/^[-.,]+/, '').trim();
    p = cleanPunctuationPythonStyle(lastSegment);

    let liner = liner_main.slice(word_gotten, word_gotten + 1);

    // --- TYPE 1: Natural match ---
    if (liner.length > 0 && p === liner[0]) {
      add_to.unshift({ text: w, pron: liner[0] });
      w = '';
      word_gotten++;
      continue;
    }

    // --- TYPE 2: Separately match ---
    if (liner.length > 0 && p.replace(/\s+/g, '') === liner[0]) {
      add_to.unshift({ text: w, pron: liner[0] });
      w = '';
      word_gotten++;
      continue;
    }

    // --- TYPE Y: Residual trailing match ---
    if (liner.length === 0) {
      if (add_to.length > 0) {
        add_to[0].text = w + add_to[0].text;
      } else {
        add_to.unshift({ text: w, pron: '' });
      }
      w = '';
      continue;
    }

    // --- TYPE 4 & TYPE 5: Multiple words returned in p ---
    let pSplit = p.split(/\s+/).filter(x => x.length > 0);
    if (pSplit.length > 1) {
      if (pSplit.length === 2 && w.length === 2 && liner.length > 0 && pSplit[pSplit.length - 1] === liner[0]) {
        add_to.unshift({ text: w.substring(1), pron: liner[0] });
        w = w[0];
        word_gotten++;
      }

      let linerCurrent = liner_main.slice(word_gotten, word_gotten + 1);
      if (linerCurrent.length > 0 && pSplit[0] === linerCurrent[0]) {
        add_to.unshift({ text: w, pron: linerCurrent[0] });
        w = '';
        word_gotten++;
        continue;
      } else {
        continue;
      }
    }
  }

  // --- POST-LOOP RESIDUAL HANDLING (type X & MEGA ULTRA PSYCHO CRAZY ULTIMATE) ---
  if (w !== '') {
    w = w.trim();
    let wSplit = w.split(/\s+/).filter(x => x.length > 0);

    if (wSplit.length === p.length) {
      for (let item of wSplit.slice().reverse()) {
        add_to.unshift({ text: w, pron: liner_main[word_gotten] || '' });
        word_gotten++;
      }
    } else {
      let line1 = w;
      let liner_main1 = liner_main.slice(word_gotten).reverse();

      let w1 = '';
      let character1 = '';
      let add_to1 = [];
      let word_gotten1 = 0;

      for (let char1 of Array.from(line1)) {
        if (cancelRef && cancelRef.current) break;
        character1 = char1;
        w1 = w1 + character1;
        let fetchRes11 = await fetchGoogleWithLang(`(${line1}) — ${w1}`, sl);
        let rawP11 = fetchRes11.transliteration || fetchRes11.translation || '';
        let parts11 = rawP11.toLowerCase().split('—');
        let lastSegment11 = parts11[parts11.length - 1].replace(/^[-.,]+/, '').trim();
        let p11 = cleanPunctuationPythonStyle(lastSegment11);

        let liner1 = liner_main1.slice(word_gotten1, word_gotten1 + 1);

        if (liner1.length > 0 && p11 === liner1[0]) {
          add_to1.push({ text: w1, pron: liner1[0] });
          w1 = '';
          word_gotten1++;
          continue;
        }
      }

      if (w1 !== '') {
        add_to1.push({ text: w1, pron: liner_main1[word_gotten1] || '' });
      }

      add_to = add_to1.concat(add_to);
    }
  }

  return add_to;
};
// ============================================================================

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
  const [isAutoSpacing, setIsAutoSpacing] = useState(false);
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
    const hasSpacing = Boolean(line.spacingText && line.spacingText.trim());
    let textToTranslate = hasSpacing ? line.spacingText : line.displayText;
    
    if (!hasSpacing && !line._meta.isAdlib && line.isSplit && line.adlibs) {
      line.adlibs.forEach(a => {
        textToTranslate = textToTranslate.replace(a.text, '');
      });
    }
    
    textToTranslate = textToTranslate.replace(/\s+/g, ' ').trim();
    if (!textToTranslate) return null;
    
    try {
      const sourceLang = line.lang || 'auto';
      const rawData = await fetchGoogleWithLang(textToTranslate, sourceLang);
      
      const resArr = await getBulkPronunciations([{ text: textToTranslate, hasSpacing }], null, rawData.srcLang || sourceLang);
      const res = resArr?.[0] || {};
      
      const finalSrcLang = rawData.srcLang && rawData.srcLang !== 'auto'
         ? rawData.srcLang
         : (res.srcLang || sourceLang);
         
      return {
        ...res,
        translation: rawData.translation || res.translation || '',
        srcLang: finalSrcLang
      };
    } catch (e) {
      console.error("Single line fetch error:", e);
      return null;
    }
  };

  const stopTranslationProcess = () => {
    cancelTranslationRef.current = true;
    setIsTranslatingAll(false);
    setIsAutoSpacing(false);
    setActiveTranslatingId(null);
    setNotification({ show: true, message: 'Process stopped.', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 1500);
  };

  const handleRefreshWorkspace = () => {
    setConfirmModalState({
      isOpen: true,
      title: "Wipe All Translations",
      message: "Are you sure you want to refresh lyrics? This will wipe out all translation, transliteration, spacing fields, and reset language tags to auto.",
      confirmText: "Wipe Fields",
      cancelText: "Cancel",
      onConfirm: () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        cancelTranslationRef.current = true;
        setIsTranslatingAll(false);
        setIsAutoSpacing(false);
        setActiveTranslatingId(null);
        
        const wipedData = workspaceData.map(line => ({
          ...line,
          translation: '',
          displayPron: '',
          pronunciation: '',
          spacingText: '', 
          lang: 'auto'
        }));
        setWorkspaceData(wipedData);
        if (listContainerRef.current) listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        
        setNotification({ show: true, message: 'Wiped all translation and transliteration fields!', progress: 100 });
        setTimeout(() => setNotification({ show: false }), 2000);
      }
    });
  };

  // ============================================================================
  // FULLY PARALLELIZED AUTO-SPACING ENGINE
  // ============================================================================
  const handleAutoSpacing = async () => {
    if (isAutoSpacing || isTranslatingAll) return;
    
    const targetIndices = [];
    workspaceData.forEach((line, index) => {
      if (line.lang === 'ja' || line.lang?.startsWith('zh')) {
        targetIndices.push(index);
      }
    });

    if (targetIndices.length === 0) {
      setNotification({ show: true, message: 'No Japanese or Chinese lines found to auto-space.', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
      return;
    }

    setIsAutoSpacing(true);
    cancelTranslationRef.current = false;
    setTranslateProgress({ current: 0, total: targetIndices.length });
    setNotification({ show: true, message: 'Starting Auto Spacing Engine...', progress: 0 });

    let currentData = [...workspaceData];
    let completedCount = 0;

    const spacingPromises = targetIndices.map(async (i) => {
      if (cancelTranslationRef.current) return null;
      
      const line = currentData[i];
      const textInput = line.displayText;
      const blocks = textInput.split(/\s+/).filter(b => b.length > 0);

      const blockPromises = blocks.map(async (block) => {
        if (cancelTranslationRef.current) return '';
        const { cleanText, purePunctuation, punctMap } = extractPunctuationMap(block);
        
        if (purePunctuation) return purePunctuation;
        if (!isSpacelessScript(cleanText)) return block;

        const blockData = await fetchGoogleWithLang(cleanText, line.lang);
        let blockPron = blockData.transliteration || cleanText;
        const cleanPron = cleanPunctuationPythonStyle(blockPron);
        const pronTokens = cleanPron.trim().split(/\s+/).filter(t => t.length > 0);

        let alignedItems = [];
        if (pronTokens.length === 1) {
            alignedItems = [{ text: cleanText, pron: cleanPron }];
        } else {
            alignedItems = await runBruteForceAlignment(cleanText, cleanPron, line.lang, cancelTranslationRef);
        }
        
        if (cancelTranslationRef.current) return '';

        let resultArr = [];
        let charOffset = 0;
        alignedItems.forEach(item => {
          let itemLength = item.text.length;
          let prefixPunct = punctMap[charOffset] ? punctMap[charOffset].prefix : '';
          let suffixPunct = punctMap[charOffset + itemLength - 1] ? punctMap[charOffset + itemLength - 1].suffix : '';
          
          let restoredText = `${prefixPunct}${item.text}${suffixPunct}`;
          resultArr.push(restoredText);
          charOffset += itemLength;
        });
        
        return resultArr.join(' ');
      });

      const resolvedBlocks = await Promise.all(blockPromises);
      if (cancelTranslationRef.current) return null;

      const newSpacingText = resolvedBlocks.join(' ').trim();

      completedCount++;
      const progressPct = Math.round((completedCount / targetIndices.length) * 100);
      setTranslateProgress({ current: completedCount, total: targetIndices.length });
      setNotification({ show: true, message: `Auto Spacing (${completedCount}/${targetIndices.length})...`, progress: progressPct });

      return { index: i, spacingText: newSpacingText };
    });

    const results = await Promise.all(spacingPromises);

    if (!cancelTranslationRef.current) {
      results.forEach(res => {
        if (res) {
          currentData[res.index] = { ...currentData[res.index], spacingText: res.spacingText };
        }
      });
      setWorkspaceData(currentData);
      setNotification({ show: true, message: 'Auto Spacing complete!', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
    }

    setIsAutoSpacing(false);
    setActiveTranslatingId(null);
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
      
      const baselineText = line.spacingText?.trim() ? line.spacingText : line.displayText;
      const normOriginal = normalizeForComparison(baselineText);
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
        } else if (rawTransText && !/[^\x00-\x7F]/.test(baselineText)) {
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
      
      setNotification({ show: true, message: `Translating [${lang}] group (${items.length} lines)...`, progress: 20 });

      if (items.length > 0) {
        setActiveTranslatingId(currentData[items[0].index].rowId);
      }

      const cleanTexts = items.map(({ line }) => {
        const hasSpacing = Boolean(line.spacingText && line.spacingText.trim());
        let text = hasSpacing ? line.spacingText : line.displayText;
        
        if (!hasSpacing && !line._meta.isAdlib && line.isSplit && line.adlibs) {
          line.adlibs.forEach(a => { text = text.replace(a.text, ''); });
        }
        return { text: text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), hasSpacing };
      });

      const combinedText = cleanTexts.map(t => t.text).join(' \u266B ');

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(lang)}&tl=en&dt=t`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

        const translatedSegments = combinedTranslation.split(/\s*[\u266B]\s*/);
        const isAligned = translatedSegments.length === items.length;

        if (!isAligned) {
          console.warn(`Context translation mismatch for [${lang}]: Expected ${items.length} lines, got ${translatedSegments.length} segments.`);
        }

        const hasNumbersInBatch = cleanTexts.some(t => /\d/.test(t.text));
        const translitLang = (hasNumbersInBatch && lang === 'auto') ? detectedLang : lang;

        const batchPronunciations = await getBulkPronunciations(cleanTexts, null, translitLang);
        
        if (cancelTranslationRef.current) break;

        items.forEach((item, i) => {
          const targetIdx = item.index;
          const line = currentData[targetIdx];
          
          let rawTransText = (isAligned && translatedSegments[i] !== undefined)
              ? translatedSegments[i]
              : (batchPronunciations[i]?.translation || line.translation);
              
          if (rawTransText) rawTransText = String(rawTransText).trim();
          
          const normOrig = normalizeForComparison(cleanTexts[i].text);
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
                displayPron = p.full || p.chunks.map(ch => ch.trans || ch.text).join('');
              } catch (e) {}
            } else if (rawTransText && !/[^\x00-\x7F]/.test(cleanTexts[i].text)) {
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
        console.error("Context translation error:", err);
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
      
      const baselineText = line.spacingText?.trim() ? line.spacingText : line.displayText;
      const normOrig = normalizeForComparison(baselineText);
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
    if (isTranslatingAll || isAutoSpacing) {
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
    isAutoSpacing,
    activeTranslatingId,
    showSuccessBanner,
    translateProgress,
    activeRowRef,
    cancelTranslationRef,
    handleAutoSpacing,
    handleRefreshWorkspace,
    handleTranslateAll,
    handleTranslateWithContext,
    handleRefetch,
    handleCancel
  };
};
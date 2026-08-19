/* --- src/hooks/translation/useTranslationBatch.js --- */
import { useState } from 'react';
import { getBulkPronunciations } from '../../services/transliterator.js';
import { 
  fetchSingleLine, 
  fetchGoogleWithLang, 
  normalizeForComparison, 
  formatAdlibPronunciation 
} from './utils/translationApi.js';

export const useTranslationBatch = ({
  workspaceData,
  setWorkspaceData,
  listContainerRef,
  cancelTranslationRef,
  setTranslateProgress,
  setNotification,
  setActiveTranslatingId,
  setShowSuccessBanner
}) => {
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);

  const stopTranslationProcess = () => {
    cancelTranslationRef.current = true;
    setIsTranslatingAll(false);
    setActiveTranslatingId(null);
    setNotification({ show: true, message: 'Process stopped.', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 1500);
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
    
    let completedCount = 0;

    const promises = workspaceData.map(async (line, idx) => {
      if (cancelTranslationRef.current) return null;
      
      if (line.lang === 'en') {
        completedCount++;
        const progressPct = Math.round((completedCount / workspaceData.length) * 100);
        setTranslateProgress({ current: completedCount, total: workspaceData.length });
        setNotification({ show: true, message: `Translating (${completedCount}/${workspaceData.length})...`, progress: progressPct });
        return { index: idx, data: { ...line, translation: '', displayPron: '', pronunciation: '' } };
      }
      
      const res = await fetchSingleLine(line);
      
      completedCount++;
      const progressPct = Math.round((completedCount / workspaceData.length) * 100);
      setTranslateProgress({ current: completedCount, total: workspaceData.length });
      setNotification({ show: true, message: `Translating (${completedCount}/${workspaceData.length})...`, progress: progressPct });

      if (!res) return null;

      let rawTransText = res.translation !== undefined ? String(res.translation).trim() : '';
      
      let baselineText = line.spacingText?.trim() ? line.spacingText : line.displayText;
      if (!line.spacingText?.trim() && !line._meta?.isAdlib && line.isSplit && line.adlibs) {
        line.adlibs.forEach(a => { baselineText = baselineText.replace(a.text, ''); });
      }

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
            displayPron = p.full || p.chunks.map(c => c.trans || c.text).join(' ');
          } catch (e) {}
        } else if (rawTransText && !/[^\x00-\x7F]/.test(baselineText)) {
          displayPron = '';
          finalPron = '';
        }

        if (line._meta?.isAdlib) {
          finalPron = formatAdlibPronunciation(line.displayText, displayPron);
        }
      }
      
      return {
        index: idx,
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

    setWorkspaceData(prev => {
      const next = [...prev];
      results.forEach(r => {
        if (r) next[r.index] = r.data;
      });
      return next;
    });
    
    if (!cancelTranslationRef.current) {
      setShowSuccessBanner(true);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setNotification({ show: true, message: 'All lines translated! Ready to Save.', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
      setTimeout(() => setShowSuccessBanner(false), 4000);
    }

    setIsTranslatingAll(false);
    setActiveTranslatingId(null);
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
    
    setWorkspaceData(prev => {
        const next = [...prev];
        for (let i = 0; i < next.length; i++) {
          if (next[i].lang === 'en') {
            next[i] = {
              ...next[i],
              translation: '',
              displayPron: '',
              pronunciation: ''
            };
          }
        }
        return next;
    });
    
    const groups = {};
    workspaceData.forEach((line, index) => {
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
        setActiveTranslatingId(workspaceData[items[0].index].rowId);
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

        setWorkspaceData(prev => {
          const next = [...prev];
          
          items.forEach((item, i) => {
            const targetIdx = item.index;
            const line = next[targetIdx];
            
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
                  displayPron = p.full || p.chunks.map(ch => ch.trans || ch.text).join(' ');
                } catch (e) {}
              } else if (rawTransText && !/[^\x00-\x7F]/.test(cleanTexts[i].text)) {
                displayPron = '';
                finalPron = '';
              }
            }

            if (!isEnglishMatch && line._meta?.isAdlib) {
              finalPron = formatAdlibPronunciation(line.displayText, displayPron);
            }
            
            next[targetIdx] = {
              ...line,
              translation: isEnglishMatch ? '' : rawTransText,
              pronunciation: isEnglishMatch ? '' : finalPron,
              displayPron: isEnglishMatch ? '' : displayPron,
              lang: finalLang
            };
          });
          
          return next;
        });

      } catch (err) {
        console.error("Context translation error:", err);
      }
    }
    
    if (!cancelTranslationRef.current) {
      setShowSuccessBanner(true);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setNotification({ show: true, message: 'Context Translation complete! Ready to Save.', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
      setTimeout(() => setShowSuccessBanner(false), 4000);
    }

    setIsTranslatingAll(false);
    setActiveTranslatingId(null);
  };

  const handleRefetch = async (index) => {
    const line = workspaceData[index];

    setActiveTranslatingId(line.rowId);
    setNotification({ show: true, message: `Translating line ${index + 1}...`, progress: null });
    
    const res = await fetchSingleLine(line);
    
    if (res) {
      setWorkspaceData(prev => {
          const next = [...prev];
          
          let rawTransText = res.translation !== undefined ? res.translation : next[index].translation;
          if (rawTransText) rawTransText = String(rawTransText).trim();
          
          let baselineText = next[index].spacingText?.trim() ? next[index].spacingText : next[index].displayText;
          if (!next[index].spacingText?.trim() && !next[index]._meta?.isAdlib && next[index].isSplit && next[index].adlibs) {
            next[index].adlibs.forEach(a => { baselineText = baselineText.replace(a.text, ''); });
          }

          const normOrig = normalizeForComparison(baselineText);
          const normTrans = normalizeForComparison(rawTransText);
          
          const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans;
          const finalLang = isEnglishMatch ? 'en' : (res.srcLang || next[index].lang || 'auto');
          
          let displayPron = '';
          if (!isEnglishMatch && res.pronunciation) {
            try {
              const p = JSON.parse(res.pronunciation);
              displayPron = p.full || p.chunks.map(c => c.trans || c.text).join(' ');
            } catch (e) {}
          }
          
          next[index] = {
              ...next[index],
              lang: finalLang,
              translation: isEnglishMatch ? '' : rawTransText,
              displayPron: isEnglishMatch ? '' : displayPron,
              pronunciation: isEnglishMatch ? '' : (next[index]._meta?.isAdlib ? formatAdlibPronunciation(next[index].displayText, displayPron) : (res.pronunciation || ''))
          };

          return next;
      });
    }
    
    setActiveTranslatingId(null);
    setNotification({ show: true, message: 'Line translated!', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 1500);
  };

  return {
    isTranslatingAll,
    stopTranslationProcess,
    handleTranslateAll,
    handleTranslateWithContext,
    handleRefetch
  };
};
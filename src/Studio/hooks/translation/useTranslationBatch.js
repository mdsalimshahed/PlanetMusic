/* --- src/Studio/hooks/translation/useTranslationBatch.js --- */
import { useState } from 'react';
import { getBulkPronunciations } from '../../services/transliterator.js';
import { 
  fetchSingleLine, 
  fetchGoogleWithLang, 
  normalizeForComparison, 
  formatAdlibPronunciation 
} from './utils/translationApi.js';

const createTranslationRunId = () => (
  globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

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
    let failedLineCount = 0;
    const runId = createTranslationRunId();

    const promises = workspaceData.map(async (line, idx) => {
      if (cancelTranslationRef.current) return null;
      
      if (line.lang === 'en') {
        const data = { ...line, translation: '', displayPron: '', pronunciation: '' };
        setActiveTranslatingId(line.rowId);
        setWorkspaceData(prev => prev.map((current, index) => (
          index === idx ? data : current
        )));
        completedCount++;
        const progressPct = Math.round((completedCount / workspaceData.length) * 100);
        setTranslateProgress({ current: completedCount, total: workspaceData.length });
        setNotification({ show: true, message: `Translating (${completedCount}/${workspaceData.length})...`, progress: progressPct });
        return;
      }
      
      const res = await fetchSingleLine(
        line,
        `translate-all:${runId}:${idx}`,
        rawData => {
          if (cancelTranslationRef.current) return;
          setActiveTranslatingId(line.rowId);
          setWorkspaceData(prev => prev.map((current, index) => (
            index === idx
              ? {
                ...current,
                translation: String(rawData.translation || '').trim(),
                lang: rawData.srcLang || current.lang || 'auto'
              }
              : current
          )));
        }
      );
      
      if (cancelTranslationRef.current) return;

      completedCount++;
      const progressPct = Math.round((completedCount / workspaceData.length) * 100);
      setTranslateProgress({ current: completedCount, total: workspaceData.length });
      setNotification({ show: true, message: `Translating (${completedCount}/${workspaceData.length})...`, progress: progressPct });

      if (!res) {
        if (line.spacingText?.trim() || line.displayText?.trim()) {
          failedLineCount++;
        }
        return;
      }

      let rawTransText = res.translation !== undefined ? String(res.translation).trim() : '';
      
      let baselineText = line.spacingText?.trim() ? line.spacingText : line.displayText;
      if (!line.spacingText?.trim() && !line._meta?.isAdlib && line.isSplit && line.adlibs) {
        line.adlibs.forEach(a => { baselineText = baselineText.replace(a.text, ''); });
      }

      const normOriginal = normalizeForComparison(baselineText);
      const normTranslated = normalizeForComparison(rawTransText);
      
      // FIX: Only flag as an English match if the text contains actual Latin letters. Prevents wiping pure numbers/CJK.
      const isEnglishMatch = normOriginal.length > 0 && normOriginal === normTranslated && /[a-z]/i.test(normOriginal);
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
            // CRITICAL FIX: Only use p.full if spacingText is NOT active, otherwise preserve the carefully aligned chunks. Join seamlessly without doubled spaces.
            const hasSpacing = Boolean(line.spacingText && line.spacingText.trim());
            displayPron = (p.full && !hasSpacing) ? p.full : p.chunks.map(ch => ch.trans || ch.text).join('');
          } catch (e) {}
        } else if (rawTransText && !/[^\x00-\x7F]/.test(baselineText)) {
          displayPron = '';
          finalPron = '';
        }

        if (line._meta?.isAdlib) {
          finalPron = formatAdlibPronunciation(line.displayText, displayPron);
        }
      }
      
      setActiveTranslatingId(line.rowId);
      setWorkspaceData(prev => prev.map((current, index) => (
        index === idx
          ? {
            ...current,
            translation: rawTransText,
            pronunciation: finalPron,
            displayPron,
            lang: finalLang
          }
          : current
      )));
    });

    await Promise.all(promises);

    if (cancelTranslationRef.current) {
      setIsTranslatingAll(false);
      setActiveTranslatingId(null);
      listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!cancelTranslationRef.current) {
      setShowSuccessBanner(failedLineCount === 0);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setNotification({
        show: true,
        message: failedLineCount
          ? `Translation finished with issues: ${failedLineCount} line(s) could not be translated. Retry those lines.`
          : 'All lines translated! Ready to Save.',
        progress: 100
      });
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
    const runId = createTranslationRunId();
    let skippedOversizedLineCount = 0;
    let failedChunkCount = 0;
    
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
        
        if (!hasSpacing && !line._meta?.isAdlib && line.isSplit && line.adlibs) {
          line.adlibs.forEach(a => { text = text.replace(a.text, ''); });
        }
        return { text: text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), hasSpacing };
      });

      const contextChunks = [];
      let currentChunk = [];
      let currentLength = 0;
      cleanTexts.forEach((cleanText, index) => {
        const textLength = Array.from(cleanText.text).length;
        if (textLength > 5000) {
          skippedOversizedLineCount++;
          return;
        }
        const nextLength = currentLength + textLength + (currentChunk.length ? 3 : 0);
        if (currentChunk.length && nextLength > 5000) {
          contextChunks.push(currentChunk);
          currentChunk = [];
          currentLength = 0;
        }
        if (currentChunk.length) currentLength += 3;
        currentChunk.push(index);
        currentLength += textLength;
      });
      if (currentChunk.length) contextChunks.push(currentChunk);

      const chunkResults = await Promise.allSettled(contextChunks.map(async (chunkIndices, chunkNumber) => {
          if (cancelTranslationRef.current) return;
          const contextSession = `translate-context:${runId}:${lang}:${chunkNumber}`;
          const chunkItems = chunkIndices.map(index => items[index]);
          const chunkTexts = chunkIndices.map(index => cleanTexts[index]);
          const combinedText = chunkTexts.map(t => t.text).join(' \u266B ');
          const { translation: combinedTranslation, srcLang: detectedLang } =
            await fetchGoogleWithLang(combinedText, lang, contextSession);

          const translatedSegments = combinedTranslation.split(/\s*[\u266B]\s*/);
          const isAligned = translatedSegments.length === chunkItems.length;

          if (!isAligned) {
            console.warn(`Context translation mismatch for [${lang}]: Expected ${chunkItems.length} lines, got ${translatedSegments.length} segments.`);
          }

          const hasNumbersInBatch = chunkTexts.some(t => /\d/.test(t.text));
          const translitLang = (hasNumbersInBatch && lang === 'auto') ? detectedLang : lang;

          if (isAligned) {
            chunkItems.forEach((item, index) => {
              setActiveTranslatingId(workspaceData[item.index].rowId);
              setWorkspaceData(prev => prev.map((current, currentIndex) => (
                currentIndex === item.index
                  ? {
                    ...current,
                    translation: translatedSegments[index].trim(),
                    lang: detectedLang || current.lang || 'auto'
                  }
                  : current
              )));
            });
          }

          const batchPronunciations = await getBulkPronunciations(
            chunkTexts, null, translitLang, contextSession
          );
        
          if (cancelTranslationRef.current) return;

          chunkItems.forEach(item => setActiveTranslatingId(
            workspaceData[item.index].rowId
          ));
          setWorkspaceData(prev => {
            const next = [...prev];
          
            chunkItems.forEach((item, i) => {
              const targetIdx = item.index;
              const line = next[targetIdx];
            
            let rawTransText = (isAligned && translatedSegments[i] !== undefined)
                ? translatedSegments[i]
                : (batchPronunciations[i]?.translation || line.translation);
                
            if (rawTransText) rawTransText = String(rawTransText).trim();
            
            const normOrig = normalizeForComparison(chunkTexts[i].text);
            const normTrans = normalizeForComparison(rawTransText);
            
            // FIX: Prevent pure numbers/CJK from triggering false English match auto-wipe
            const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans && /[a-z]/i.test(normOrig);
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
                  const hasSpacing = Boolean(line.spacingText && line.spacingText.trim());
                  displayPron = (p.full && !hasSpacing) ? p.full : p.chunks.map(ch => ch.trans || ch.text).join('');
                } catch (e) {}
              } else if (rawTransText && !/[^\x00-\x7F]/.test(chunkTexts[i].text)) {
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
        }));

      chunkResults.forEach(result => {
        if (result.status === 'rejected') {
          failedChunkCount++;
          console.error('Context translation error:', result.reason);
        }
      });
    }
    
    if (!cancelTranslationRef.current) {
      const issues = [];
      if (skippedOversizedLineCount) {
        issues.push(
          `${skippedOversizedLineCount} line(s) exceeded 5,000 characters and were skipped`
        );
      }
      if (failedChunkCount) {
        issues.push(`${failedChunkCount} context chunk(s) failed`);
      }
      setShowSuccessBanner(issues.length === 0);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setNotification({
        show: true,
        message: issues.length
          ? `Context Translation finished with issues: ${issues.join('; ')}.`
          : 'Context Translation complete! Ready to Save.',
        progress: 100
      });
      setTimeout(() => setShowSuccessBanner(false), 4000);
    }

    setIsTranslatingAll(false);
    setActiveTranslatingId(null);
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefetch = async (index) => {
    const line = workspaceData[index];
    setActiveTranslatingId(line.rowId);
    setNotification({ show: true, message: `Translating line ${index + 1}...`, progress: null });
    
    const res = await fetchSingleLine(
      line,
      `refetch:${createTranslationRunId()}:${index}`,
      rawData => {
        setActiveTranslatingId(line.rowId);
        setWorkspaceData(prev => prev.map((current, currentIndex) => (
          currentIndex === index
            ? {
              ...current,
              translation: String(rawData.translation || '').trim(),
              lang: rawData.srcLang || current.lang || 'auto'
            }
            : current
        )));
      }
    );

    if (!res && (line.spacingText?.trim() || line.displayText?.trim())) {
      setNotification({
        show: true,
        message: `Could not translate line ${index + 1}. Check the connection or proxy and retry.`,
        progress: 100
      });
    }
    
    if (res) {
      setActiveTranslatingId(line.rowId);
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
          
          // FIX: Prevent pure numbers/CJK from triggering false English match auto-wipe
          const isEnglishMatch = normOrig.length > 0 && normOrig === normTrans && /[a-z]/i.test(normOrig);
          const finalLang = isEnglishMatch ? 'en' : (res.srcLang || next[index].lang || 'auto');
          
          let displayPron = '';
          if (!isEnglishMatch && res.pronunciation) {
            try {
              const p = JSON.parse(res.pronunciation);
              const hasSpacing = Boolean(next[index].spacingText && next[index].spacingText.trim());
              displayPron = (p.full && !hasSpacing) ? p.full : p.chunks.map(c => c.trans || c.text).join('');
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
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setNotification({ show: true, message: 'Line translated!', progress: 100 });
  };

  return {
    isTranslatingAll,
    stopTranslationProcess,
    handleTranslateAll,
    handleTranslateWithContext,
    handleRefetch
  };
};
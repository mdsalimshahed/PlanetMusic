/* --- src/hooks/translation/useAutoSpacing.js --- */
import { useState } from 'react';
import { fetchGoogleWithLang } from './utils/translationApi.js';
import { 
  extractPunctuationMap, 
  cleanPunctuationPythonStyle, 
  runBruteForceAlignment 
} from './utils/bruteForceEngine.js';
import { splitAutoSpacingBlocks } from './utils/autoSpacingText.js';

export const useAutoSpacing = ({
  workspaceData,
  setWorkspaceData,
  isTranslatingAll,
  cancelTranslationRef,
  setTranslateProgress,
  setNotification,
  setActiveTranslatingId
}) => {
  const [isAutoSpacing, setIsAutoSpacing] = useState(false);

  const handleAutoSpacing = async () => {
    if (isAutoSpacing || isTranslatingAll) return;
    
    const targetIndices = [];
    workspaceData.forEach((line, index) => {
      if (line.lang === 'ja' || line.lang?.startsWith('zh')) {
        targetIndices.push(index);
      }
    });

    if (targetIndices.length === 0) {
      setNotification({ show: true, message: 'No valid lines found to auto-space.', progress: 100 });
      return;
    }

    setIsAutoSpacing(true);
    cancelTranslationRef.current = false;
    setTranslateProgress({ current: 0, total: targetIndices.length });
    setNotification({ show: true, message: 'Running Brute Force Engine...', progress: 0 });

    let completedCount = 0;

    const phasePromises = targetIndices.map(async (idx) => {
      if (cancelTranslationRef.current) return null;

      let line = workspaceData[idx];
      
      let textInput = line.displayText || '';
      if (!line._meta?.isAdlib && line.isSplit && line.adlibs) {
        line.adlibs.forEach(a => { textInput = textInput.replace(a.text, ''); });
      }
      textInput = textInput.trim();

      // Keep each run in source order so non-CJK text bypasses auto-spacing unchanged.
      const blocks = splitAutoSpacingBlocks(textInput);

      const resultBlocks = [];
      const pronunciationBlocks = [];
      for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
        if (cancelTranslationRef.current) break;
        const block = blocks[bIdx];
        
        if (block.mode === 'latin') {
          resultBlocks.push(block.text);
          pronunciationBlocks.push(block.text);
          continue;
        }

        const { cleanText, purePunctuation, punctMap } = extractPunctuationMap(block.text);
        
        if (purePunctuation) {
          resultBlocks.push(purePunctuation);
          pronunciationBlocks.push(purePunctuation);
          continue;
        }

        const gData = await fetchGoogleWithLang(cleanText, line.lang);
        const blockPron = gData.transliteration || gData.translation || '';
        const cleanPron = cleanPunctuationPythonStyle(blockPron);

        let alignedItems = await runBruteForceAlignment(cleanText, cleanPron, line.lang, cancelTranslationRef);
        let resultArr = [];
        let charOffset = 0;
        
        alignedItems.forEach(item => {
          let itemLength = item.text.length; 
          let prefixPunct = punctMap[charOffset] ? punctMap[charOffset].prefix : '';
          let suffixPunct = punctMap[charOffset + itemLength - 1] ? punctMap[charOffset + itemLength - 1].suffix : '';
          
          resultArr.push(`${prefixPunct}${item.text}${suffixPunct}`);
          charOffset += itemLength;
        });
        
        resultBlocks.push(resultArr.join(' '));
        pronunciationBlocks.push(blockPron);
      }

      let newSpacingText = resultBlocks.join('');
      
      let newDisplayPron = pronunciationBlocks.join('');

      completedCount++;
      const progressPct = Math.round((completedCount / targetIndices.length) * 100);
      
      setTranslateProgress({ current: completedCount, total: targetIndices.length });
      setNotification({ show: true, message: `Auto Spacing (${completedCount}/${targetIndices.length})...`, progress: progressPct });

      return { idx, newSpacingText, newDisplayPron };
    });

    let phaseResults;
    try {
      phaseResults = await Promise.all(phasePromises);
    } catch (error) {
      cancelTranslationRef.current = true;
      setIsAutoSpacing(false);
      setActiveTranslatingId(null);
      const message = error.message?.includes('HTTP 429')
        ? 'Google Translate is rate-limiting requests. Wait a minute before retrying Auto Spacing.'
        : `Auto Spacing failed: ${error.message || 'Translation service unavailable.'}`;
      setNotification({ show: true, message, progress: 100 });
      return;
    }

    if (cancelTranslationRef.current) {
        setIsAutoSpacing(false);
        setActiveTranslatingId(null);
        return;
    }

    setWorkspaceData(prev => {
      const next = [...prev];
      phaseResults.forEach(res => {
        if (res) {
          next[res.idx] = { 
              ...next[res.idx], 
              spacingText: res.newSpacingText,
              displayPron: res.newDisplayPron
          };
        }
      });
      return next;
    });

    setNotification({ show: true, message: 'Auto Spacing complete!', progress: 100 });
    setIsAutoSpacing(false);
    setActiveTranslatingId(null);
  };

  return { isAutoSpacing, setIsAutoSpacing, handleAutoSpacing };
};
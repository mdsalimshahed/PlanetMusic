/* --- src/hooks/translation/useAutoSpacing.js --- */
import { useState } from 'react';
import { fetchGoogleWithLang } from './utils/translationApi';
import { 
  isSpacelessScript, 
  extractPunctuationMap, 
  cleanPunctuationPythonStyle, 
  runBruteForceAlignment 
} from './utils/bruteForceEngine';

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
      if (line.lang === 'ja' || line.lang?.startsWith('zh') || line.lang === 'ko') {
        targetIndices.push(index);
      }
    });

    if (targetIndices.length === 0) {
      setNotification({ show: true, message: 'No CJK lines found to auto-space.', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
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
      textInput = textInput.replace(/\s+/g, ' ').trim();

      // 1. REGEX TOKENIZATION: Split line into CJK vs Latin/English chunks
      const tokens = textInput.split(/([\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+)/u).filter(Boolean);
      
      const blocks = [];
      tokens.forEach(t => {
        const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(t);
        if (t.trim()) {
          blocks.push({ mode: isLatin ? 'latin' : 'cjk', text: t.trim() });
        }
      });

      // 2. FETCH PRONUNCIATIONS USING MUSIC NOTE DELIMITER (\u266B)
      let finalPronChunks = [];
      if (blocks.length > 1) {
        const delimitedText = blocks.map(b => b.text).join(' \u266B ');
        const gData = await fetchGoogleWithLang(delimitedText, line.lang);
        const delimitedPron = gData.transliteration || gData.translation || '';
        const pronChunks = delimitedPron.split(/\s*[\u266B♫]\s*/).map(s => s.trim());

        for (let i = 0; i < blocks.length; i++) {
          if (blocks[i].mode === 'latin') {
            // LATIN CHUNK: Strictly force exact raw text (no Romaji)
            finalPronChunks.push(blocks[i].text);
          } else {
            finalPronChunks.push(pronChunks[i] || '');
          }
        }
      } else if (blocks.length === 1 && blocks[0].mode === 'latin') {
        finalPronChunks = [blocks[0].text];
      } else {
        const gData = await fetchGoogleWithLang(textInput, line.lang);
        finalPronChunks = [gData.transliteration || gData.translation || ''];
      }

      // 3. RUN BRUTE FORCE ONLY ON CJK BLOCKS
      const resultBlocks = [];
      for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
        if (cancelTranslationRef.current) break;
        const block = blocks[bIdx];
        
        if (block.mode === 'latin') {
          resultBlocks.push(block.text);
          continue;
        }

        const blockPron = finalPronChunks[bIdx] || '';
        const { cleanText, purePunctuation, punctMap } = extractPunctuationMap(block.text);
        
        if (purePunctuation) {
          resultBlocks.push(purePunctuation);
          continue;
        }

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
      }

      let newSpacingText = resultBlocks.join(' ').replace(/\s+/g, ' ').trim();
      
      // Clean display pron: Combine CJK Romaji + raw Latin text
      let newDisplayPron = blocks.map((b, i) => b.mode === 'latin' ? b.text : finalPronChunks[i]).join(' ').replace(/\s+/g, ' ').trim();

      completedCount++;
      const progressPct = Math.round((completedCount / targetIndices.length) * 100);
      
      setTranslateProgress({ current: completedCount, total: targetIndices.length });
      setNotification({ show: true, message: `Auto Spacing (${completedCount}/${targetIndices.length})...`, progress: progressPct });

      return { idx, newSpacingText, newDisplayPron };
    });

    const phaseResults = await Promise.all(phasePromises);

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
    setTimeout(() => setNotification({ show: false }), 2000);
    setIsAutoSpacing(false);
    setActiveTranslatingId(null);
  };

  return { isAutoSpacing, setIsAutoSpacing, handleAutoSpacing };
};
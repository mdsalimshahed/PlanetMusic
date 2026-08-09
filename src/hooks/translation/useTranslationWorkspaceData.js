/* --- src/hooks/translation/useTranslationWorkspaceData.js --- */
import { useState, useEffect, useMemo, useRef } from 'react';
import { parseLyrics } from '../../utils/songHelpers';

const formatAdlibPronunciation = (adlibText, displayPron) => {
  if (!displayPron) return '';
  return JSON.stringify({
    full: displayPron,
    chunks: [{ type: 'foreign', text: adlibText, trans: displayPron }]
  });
};

export const buildChunkedPronunciation = (text, displayPron) => {
  if (!displayPron || !displayPron.trim()) return '';
  const cleanText = (text || '').trim();
  if (!cleanText) return displayPron;

  const transWords = displayPron
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim());

  const tokens = cleanText.split(/(\s+)/);
  const chunks = [];
  let wordIndex = 0;

  for (const token of tokens) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      chunks.push({ type: 'en', text: token, trans: '' });
    } else {
      const isEnToken = Array.from(token).every(c => /^[\p{Script=Latin}\p{M}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(c));
      const currentTrans = transWords[wordIndex] || '';

      if (/^[\p{P}\p{S}]+$/u.test(token.trim())) {
        chunks.push({ type: 'en', text: token, trans: '' });
        continue;
      }

      if (isEnToken) {
        chunks.push({ type: 'en', text: token, trans: '' });
        const cleanToken = token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim().toLowerCase();
        const cleanTransWord = (transWords[wordIndex] || '').toLowerCase();
        if (cleanTransWord === cleanToken && cleanToken !== '') {
          wordIndex++;
        }
      } else {
        chunks.push({ type: 'foreign', text: token, trans: currentTrans || token });
        wordIndex++;
      }
    }
  }

  return JSON.stringify({ full: displayPron.trim(), chunks });
};

export const useTranslationWorkspaceData = ({
  selectedSong,
  customData,
  masterPalette,
  updateSongInLibrary,
  setIsTranslationManagerOpen,
  setNotification,
  setConfirmModalState
}) => {
  const [workspaceData, setWorkspaceData] = useState([]);
  const [initialDataSnapshot, setInitialDataSnapshot] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const listContainerRef = useRef(null);

  const parsedLyricsColorMap = useMemo(() => {
    if (!customData?.lyrics || !selectedSong?.artistName) return [];
    return parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);
  }, [customData?.lyrics, selectedSong?.artistName, masterPalette]);

  const loadSourceWorkspaceData = () => {
    let sourceData = selectedSong?.syncData || selectedSong?.autoSyncData;
    if ((!sourceData || sourceData.length === 0) && customData?.lyrics) {
      sourceData = parseLyrics(customData.lyrics, selectedSong?.artistName, masterPalette).map(l => ({
        ...l,
        start: null,
        end: null,
        translation: '',
        pronunciation: null,
        lang: 'auto'
      }));
    }
    if (!sourceData) sourceData = [];
    const mapped = [];
    sourceData.forEach((line, i) => {
      let mainText = line.text;
      const parsedLineObj = parsedLyricsColorMap[i] || null;
      let pron = line.pronunciation || '';
      let displayPron = pron;
      if (typeof pron === 'string') {
        if (pron.startsWith('{')) {
          try {
            const p = JSON.parse(pron);
            displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
          } catch (e) {}
        } else if (pron.startsWith('[')) {
          try {
            const p = JSON.parse(pron);
            displayPron = p.map(c => c.trans || c.text).join('');
          } catch (e) {}
        }
      }
      const isEn = line.lang === 'en';
      const effectiveLineText = mainText || line.text || '';
      const hasSpacesInText = /\S\s+\S/.test(effectiveLineText);

      mapped.push({
        ...line,
        rowId: `main-${i}`,
        segments: parsedLineObj?.segments || line.segments,
        displayText: effectiveLineText,
        spacedText: line.spacedText || (hasSpacesInText ? effectiveLineText : ''),
        translation: isEn ? '' : (line.translation || ''),
        pronunciation: isEn ? '' : pron,
        displayPron: isEn ? '' : displayPron,
        lang: line.lang || 'auto',
        _meta: { isAdlib: false, lineIndex: i }
      });

      if (line.isSplit && line.adlibs) {
        line.adlibs.forEach((adlib, j) => {
          let aPron = adlib.pronunciation || '';
          let aDisplayPron = aPron;
          if (typeof aPron === 'string') {
            if (aPron.startsWith('{')) {
              try {
                const p = JSON.parse(aPron);
                aDisplayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
              } catch (e) {}
            } else if (aPron.startsWith('[')) {
              try {
                const p = JSON.parse(aPron);
                aDisplayPron = p.map(c => c.trans || c.text).join('');
              } catch (e) {}
            }
          }
          const isAdlibEn = adlib.lang === 'en';
          mapped.push({
            ...adlib,
            rowId: `adlib-${i}-${j}`,
            segments: adlib.segments,
            displayText: adlib.text,
            spacedText: adlib.spacedText || (/\S\s+\S/.test(adlib.text) ? adlib.text : ''),
            translation: isAdlibEn ? '' : (adlib.translation || ''),
            pronunciation: isAdlibEn ? '' : aPron,
            displayPron: isAdlibEn ? '' : aDisplayPron,
            lang: adlib.lang || 'auto',
            _meta: { isAdlib: true, lineIndex: i, adlibIndex: j }
          });
        });
      }
    });
    return mapped;
  };

  useEffect(() => {
    const loaded = loadSourceWorkspaceData();
    setWorkspaceData(loaded);
    setInitialDataSnapshot(JSON.stringify(loaded.map(item => ({ t: item.translation, p: item.displayPron, l: item.lang, s: item.spacedText }))));
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong?.trackId, selectedSong?.syncData, selectedSong?.autoSyncData]);

  const hasUnsavedChanges = useMemo(() => {
    const currentSnapshot = JSON.stringify(workspaceData.map(item => ({ t: item.translation, p: item.displayPron, l: item.lang, s: item.spacedText })));
    return currentSnapshot !== initialDataSnapshot;
  }, [workspaceData, initialDataSnapshot]);

  const handleChange = (index, field, value) => {
    const newData = [...workspaceData];
    if (field === 'lang') {
      const cleanLang = value.toLowerCase().trim();
      newData[index].lang = cleanLang;
      if (cleanLang === 'en') {
        newData[index].translation = '';
        newData[index].displayPron = '';
        newData[index].pronunciation = '';
      }
    } else if (field === 'displayPron') {
      if (newData[index].lang === 'en' && value) {
        newData[index].lang = 'auto';
      }
      newData[index].displayPron = value;
      let currentPron = newData[index].pronunciation;
      if (newData[index]._meta.isAdlib) {
        newData[index].pronunciation = formatAdlibPronunciation(newData[index].displayText, value);
      } else if (currentPron && currentPron.startsWith('{')) {
        try {
          let p = JSON.parse(currentPron);
          p.full = value;
          newData[index].pronunciation = JSON.stringify(p);
        } catch (e) {
          newData[index].pronunciation = value;
        }
      } else {
        newData[index].pronunciation = value;
      }
    } else if (field === 'translation') {
      if (newData[index].lang === 'en' && value) {
        newData[index].lang = 'auto';
      }
      newData[index].translation = value;
    } else {
      newData[index][field] = value;
    }
    setWorkspaceData(newData);
  };

  const handleSave = (cancelTranslationRef) => {
    cancelTranslationRef.current = true;
    let sourceData = selectedSong?.syncData || selectedSong?.autoSyncData;
    if ((!sourceData || sourceData.length === 0) && customData?.lyrics) {
      sourceData = parseLyrics(customData.lyrics, selectedSong?.artistName, masterPalette).map(l => ({
        ...l,
        start: null,
        end: null,
        translation: '',
        pronunciation: null,
        lang: 'auto'
      }));
    }
    if (!sourceData) sourceData = [];
    const newSyncData = JSON.parse(JSON.stringify(sourceData));

    workspaceData.forEach(item => {
      const meta = item._meta;
      const isEn = item.lang === 'en';

      const effectiveText = (item.spacedText && item.spacedText.trim())
        ? item.spacedText.trim()
        : ''; // We only want to save the spacing format, not overwrite text

      let displayPron = item.displayPron ? item.displayPron.trim() : '';
      let finalTrans = isEn ? '' : (item.translation || '');
      let finalPron = isEn ? '' : item.pronunciation;

      if (!isEn && displayPron) {
        const lang = (item.lang || 'auto').toLowerCase();
        const hasAsianChars = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u0e00-\u0e7f]/.test(item.displayText);
        const hasSpaces = /\S\s+\S/.test(effectiveText);

        if (hasSpaces || (hasAsianChars && /\s/.test(effectiveText))) {
          finalPron = buildChunkedPronunciation(effectiveText, displayPron);
        } else if (typeof finalPron === 'string' && finalPron.startsWith('{')) {
          try {
            let p = JSON.parse(finalPron);
            p.full = displayPron;
            finalPron = JSON.stringify(p);
          } catch (e) {
            finalPron = displayPron;
          }
        } else {
          finalPron = displayPron;
        }
      }

      if (meta.isAdlib) {
        if (newSyncData[meta.lineIndex] && newSyncData[meta.lineIndex].adlibs) {
          const target = newSyncData[meta.lineIndex].adlibs[meta.adlibIndex];
          if (target) {
            target.spacedText = effectiveText;
            target.translation = finalTrans;
            target.pronunciation = finalPron;
            target.lang = item.lang || 'auto';
          }
        }
      } else {
        const target = newSyncData[meta.lineIndex];
        if (target) {
          target.spacedText = effectiveText;
          target.translation = finalTrans;
          target.pronunciation = finalPron;
          target.lang = item.lang || 'auto';
        }
      }
    });

    // CAREFUL FIX: Only save syncData. NEVER overwrite `lyrics` with stripped database text.
    const updatedSong = {
      ...selectedSong,
      syncData: newSyncData,
      autoSyncData: selectedSong.autoSyncData ? newSyncData : selectedSong.autoSyncData
    };

    updateSongInLibrary(updatedSong);
    setIsTranslationManagerOpen(false);
    setNotification({ show: true, message: 'Translation changes saved!', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 2000);
  };

  const handleExport = () => {
    const textContent = workspaceData.map(line =>
      `[lang: ${line.lang || 'auto'}]\n${line.spacedText || line.displayText}\n${line.displayPron ? line.displayPron + '\n' : ''}${line.translation ? line.translation + '\n' : ''}`
    ).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSong.trackName}_Translation.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportText = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (!text || !text.trim()) return alert("The selected text file is empty.");
        const blocks = text.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean);
        if (blocks.length === 0) return alert("Could not parse blocks in text file.");
        const newData = [...workspaceData];
        let importedCount = 0;
        blocks.forEach((block, blockIdx) => {
          let lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length === 0) return;
          let importedLang = 'auto';
          if (lines[0].startsWith('[lang:') && lines[0].endsWith(']')) {
            importedLang = lines[0].replace('[lang:', '').replace(']', '').trim();
            lines.shift();
          }
          if (lines.length === 0) return;
          const originalText = lines[0];
          let importedPron = '';
          let importedTrans = '';
          if (lines.length === 2) {
            importedTrans = lines[1];
          } else if (lines.length >= 3) {
            importedPron = lines[1];
            importedTrans = lines[2];
          }
          let targetIndex = newData.findIndex(
            w => w.displayText.toLowerCase() === originalText.toLowerCase() || (w.spacedText && w.spacedText.toLowerCase() === originalText.toLowerCase())
          );
          if (targetIndex === -1 && blockIdx < newData.length) {
            targetIndex = blockIdx;
          }
          if (targetIndex !== -1) {
            const isEn = importedLang === 'en';
            newData[targetIndex].lang = importedLang;
            newData[targetIndex].translation = isEn ? '' : importedTrans;
            newData[targetIndex].displayPron = isEn ? '' : importedPron;
            if (/\S\s+\S/.test(originalText)) {
              newData[targetIndex].spacedText = originalText;
            }
            if (isEn) {
              newData[targetIndex].pronunciation = '';
            } else if (newData[targetIndex]._meta.isAdlib) {
              newData[targetIndex].pronunciation = formatAdlibPronunciation(newData[targetIndex].displayText, importedPron);
            } else {
              let currentPron = newData[targetIndex].pronunciation;
              if (currentPron && currentPron.startsWith('{')) {
                try {
                  let p = JSON.parse(currentPron);
                  p.full = importedPron;
                  newData[targetIndex].pronunciation = JSON.stringify(p);
                } catch (err) {
                  newData[targetIndex].pronunciation = importedPron;
                }
              } else {
                newData[targetIndex].pronunciation = importedPron;
              }
            }
            importedCount++;
          }
        });
        setWorkspaceData(newData);
        if (listContainerRef.current) listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        setNotification({ show: true, message: `Overwrote workspace data for ${importedCount} lines!`, progress: 100 });
        setTimeout(() => setNotification({ show: false }), 2500);
      } catch (err) {
        console.error("Text import error:", err);
        alert("Failed to parse text file.");
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  return {
    workspaceData,
    setWorkspaceData,
    isLoading,
    hasUnsavedChanges,
    listContainerRef,
    handleChange,
    handleSave,
    handleExport,
    handleImportText
  };
};
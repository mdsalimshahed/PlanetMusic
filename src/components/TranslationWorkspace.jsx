/* --- src/components/TranslationWorkspace.jsx --- */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseLyrics } from '../utils/songHelpers';
import { getBulkPronunciations } from '../transliterator';
import ConfirmModal from './ConfirmModal';
import './TranslationWorkspace.css';

const TranslationWorkspace = ({
  selectedSong, customData, masterPalette, updateSongInLibrary, setIsTranslationManagerOpen, setNotification }) => {
  const [workspaceData, setWorkspaceData] = useState([]);
  const [initialDataSnapshot, setInitialDataSnapshot] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [activeTranslatingId, setActiveTranslatingId] = useState(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0 });
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Discard Changes',
    cancelText: 'Cancel',
    onConfirm: () => {}
  });

  const importFileInputRef = useRef(null);
  const activeRowRef = useRef(null);
  const listContainerRef = useRef(null);
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

  const parsedLyricsColorMap = useMemo(() => {
    if (!customData?.lyrics || !selectedSong?.artistName) return [];
    return parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);
  }, [customData?.lyrics, selectedSong?.artistName, masterPalette]);

  const loadSourceWorkspaceData = () => {
    let sourceData = selectedSong.syncData || selectedSong.autoSyncData || [];
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
                } catch(e){}
            } else if (pron.startsWith('[')) {
                try {
                    const p = JSON.parse(pron);
                    displayPron = p.map(c => c.trans || c.text).join('');
                } catch(e){}
            }
        }
        mapped.push({
           ...line,
           rowId: `main-${i}`,
           segments: parsedLineObj?.segments || line.segments,
           displayText: mainText || line.text,
           translation: line.translation || '',
           pronunciation: pron,
           displayPron: displayPron,
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
                        } catch(e){}
                    } else if (aPron.startsWith('[')) {
                        try {
                            const p = JSON.parse(aPron);
                            aDisplayPron = p.map(c => c.trans || c.text).join('');
                        } catch(e){}
                    }
                }
                mapped.push({
                    ...adlib,
                    rowId: `adlib-${i}-${j}`,
                    segments: adlib.segments,
                    displayText: adlib.text,
                    translation: adlib.translation || '',
                    pronunciation: aPron,
                    displayPron: aDisplayPron,
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
    setInitialDataSnapshot(JSON.stringify(loaded.map(item => ({ t: item.translation, p: item.displayPron }))));
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong?.trackId, parsedLyricsColorMap]);

  const hasUnsavedChanges = useMemo(() => {
    const currentSnapshot = JSON.stringify(workspaceData.map(item => ({ t: item.translation, p: item.displayPron })));
    return currentSnapshot !== initialDataSnapshot;
  }, [workspaceData, initialDataSnapshot]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleGlobalCaptureClick = (e) => {
      const workspaceContainer = document.querySelector('.tw-container');
      const modalOverlay = document.querySelector('.confirm-modal-overlay');
      if (modalOverlay && modalOverlay.contains(e.target)) return;
      if (workspaceContainer && !workspaceContainer.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const pendingTarget = e.target;
        setConfirmModalState({
          isOpen: true,
          title: "Unsaved Changes",
          message: "You have unsaved translation changes. Are you sure you want to navigate away and discard them?",
          confirmText: "Discard & Continue",
          cancelText: "Keep Editing",
          onConfirm: () => {
            setConfirmModalState(prev => ({ ...prev, isOpen: false }));
            cancelTranslationRef.current = true;
            setIsTranslationManagerOpen(false);
            setTimeout(() => {
              if (pendingTarget && typeof pendingTarget.click === 'function') {
                pendingTarget.click();
              }
            }, 50);
          }
        });
      }
    };
    window.addEventListener('click', handleGlobalCaptureClick, true);
    return () => {
      window.removeEventListener('click', handleGlobalCaptureClick, true);
    };
  }, [hasUnsavedChanges, setIsTranslationManagerOpen]);

  const handleRefreshWorkspace = () => {
    setConfirmModalState({
      isOpen: true,
      title: "Wipe All Translations",
      message: "Are you sure you want to refresh lyrics? This will wipe out all translation and transliteration fields.",
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
          pronunciation: ''
        }));
        setWorkspaceData(wipedData);
        if (listContainerRef.current) listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        setNotification({ show: true, message: 'Wiped all translation and transliteration fields!', progress: 100 });
        setTimeout(() => setNotification({ show: false }), 2000);
      }
    });
  };

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
      const resArr = await getBulkPronunciations([textToTranslate], null);
      return resArr?.[0] || null;
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

  // --- STANDARD TRANSLATE ALL ---
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
             let newTrans = res.translation !== undefined ? res.translation : line.translation;
             if (newTrans) newTrans = String(newTrans).replace(/[()]/g, '').trim();
             let displayPron = line.displayPron;
             let finalPron = res.pronunciation || line.pronunciation;
             if (res.pronunciation) {
                 try {
                     const p = JSON.parse(res.pronunciation);
                     displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
                 } catch(e) {}
             } else if (res.translation && !/[^\x00-\x7F]/.test(line.displayText)) {
                 displayPron = '';
                 finalPron = '';
             }
             currentData[i] = {
                 ...currentData[i],
                 translation: newTrans,
                 pronunciation: finalPron,
                 displayPron: displayPron
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

  // --- CONTEXT TRANSLATION (ONE BATCHED GOOGLE API REQUEST FOR UP TO 3 LINES) ---
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

      // Handle orphan or leading adlib rows individually
      if (currentData[i]._meta.isAdlib) {
        const adlibRes = await fetchSingleLine(currentData[i]);
        if (adlibRes) {
          let newTrans = adlibRes.translation ? String(adlibRes.translation).replace(/[()]/g, '').trim() : '';
          let displayPron = '';
          let finalPron = adlibRes.pronunciation || '';
          if (adlibRes.pronunciation) {
            try {
              const p = JSON.parse(adlibRes.pronunciation);
              displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
            } catch(e) {}
          }
          currentData[i] = {
            ...currentData[i],
            translation: newTrans || currentData[i].translation,
            pronunciation: finalPron || currentData[i].pronunciation,
            displayPron: displayPron || currentData[i].displayPron
          };
          setWorkspaceData([...currentData]);
        }
        i++;
        continue;
      }

      // Collect up to 3 MAIN lines for the context batch
      const mainBatchIndices = [];
      const adlibIndicesToProcess = [];
      let ptr = i;

      while (ptr < currentData.length && mainBatchIndices.length < 3) {
        if (!currentData[ptr]._meta.isAdlib) {
          mainBatchIndices.push(ptr);
        } else {
          adlibIndicesToProcess.push(ptr);
        }
        ptr++;
      }

      if (mainBatchIndices.length === 0) break;

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

      // 1. Fetch 3-line main context batch in a SINGLE API call
      try {
        const combinedText = cleanMainTexts.join('\n');
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(combinedText)}`;
        const response = await fetch(url);
        const data = await response.json();

        let combinedTranslation = '';
        if (data && data[0]) {
          data[0].forEach(item => {
            if (item[0]) combinedTranslation += item[0];
          });
        }

        const translatedLines = combinedTranslation.split('\n').map(l => l.trim());

        // Fetch pronunciations for chunk mapping
        const batchPronunciations = await getBulkPronunciations(cleanMainTexts, null);

        if (cancelTranslationRef.current) break;

        mainBatchIndices.forEach((targetIdx, bIdx) => {
          if (currentData[targetIdx]) {
            let newTrans = translatedLines[bIdx] !== undefined ? translatedLines[bIdx] : (batchPronunciations[bIdx]?.translation || currentData[targetIdx].translation);
            if (newTrans) newTrans = String(newTrans).replace(/[()]/g, '').trim();

            let displayPron = currentData[targetIdx].displayPron;
            let finalPron = batchPronunciations[bIdx]?.pronunciation || currentData[targetIdx].pronunciation;

            if (batchPronunciations[bIdx]?.pronunciation) {
              try {
                const p = JSON.parse(batchPronunciations[bIdx].pronunciation);
                displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
              } catch(e) {}
            } else if (newTrans && !/[^\x00-\x7F]/.test(currentData[targetIdx].displayText)) {
              displayPron = '';
              finalPron = '';
            }

            currentData[targetIdx] = {
              ...currentData[targetIdx],
              translation: newTrans,
              pronunciation: finalPron,
              displayPron: displayPron
            };
          }
        });
        setWorkspaceData([...currentData]);
      } catch (err) {
        console.error("Context batch translation error:", err);
      }

      // 2. Fetch ad-libs individually
      for (const aIdx of adlibIndicesToProcess) {
        if (cancelTranslationRef.current) break;
        const adlibLine = currentData[aIdx];
        const res = await fetchSingleLine(adlibLine);
        if (res) {
          let newTrans = res.translation !== undefined ? res.translation : adlibLine.translation;
          if (newTrans) newTrans = String(newTrans).replace(/[()]/g, '').trim();
          let displayPron = adlibLine.displayPron;
          let finalPron = res.pronunciation || adlibLine.pronunciation;
          if (res.pronunciation) {
            try {
              const p = JSON.parse(res.pronunciation);
              displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
            } catch(e) {}
          }
          currentData[aIdx] = {
            ...currentData[aIdx],
            translation: newTrans,
            pronunciation: finalPron,
            displayPron: displayPron
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
         let newTrans = res.translation !== undefined ? res.translation : newData[index].translation;
         if (newTrans) newTrans = String(newTrans).replace(/[()]/g, '').trim();
         newData[index].translation = newTrans;
         newData[index].pronunciation = res.pronunciation || newData[index].pronunciation;
         if (res.pronunciation) {
             try {
                 const p = JSON.parse(res.pronunciation);
                 newData[index].displayPron = p.full || p.chunks.map(c => c.trans || c.text).join('');
             } catch(e) {}
         } else {
             newData[index].displayPron = '';
             newData[index].pronunciation = '';
         }
         setWorkspaceData(newData);
     }
     setActiveTranslatingId(null);
     setNotification({ show: true, message: 'Line translated!', progress: 100 });
     setTimeout(() => setNotification({ show: false }), 1500);
  };

  const handleChange = (index, field, value) => {
     const newData = [...workspaceData];
     if (field === 'displayPron') {
         newData[index].displayPron = value;
         let currentPron = newData[index].pronunciation;
         if (currentPron && currentPron.startsWith('{')) {
             try {
                 let p = JSON.parse(currentPron);
                 p.full = value;
                 newData[index].pronunciation = JSON.stringify(p);
             } catch(e) {
                 newData[index].pronunciation = value;
             }
         } else {
             newData[index].pronunciation = value;
         }
     } else {
         newData[index][field] = value;
     }
     setWorkspaceData(newData);
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

  const handleSave = () => {
     cancelTranslationRef.current = true;
     let sourceData = selectedSong.syncData || selectedSong.autoSyncData || [];
     const newSyncData = JSON.parse(JSON.stringify(sourceData));
     workspaceData.forEach(item => {
         const meta = item._meta;
         let finalPron = item.pronunciation;
         if (typeof finalPron === 'string' && finalPron.startsWith('{')) {
             try {
                 let p = JSON.parse(finalPron);
                 p.full = item.displayPron;
                 finalPron = JSON.stringify(p);
             } catch(e) {
                 finalPron = item.displayPron;
             }
         } else {
             finalPron = item.displayPron;
         }
         if (meta.isAdlib) {
             if (newSyncData[meta.lineIndex] && newSyncData[meta.lineIndex].adlibs) {
                 const target = newSyncData[meta.lineIndex].adlibs[meta.adlibIndex];
                 if (target) {
                     target.translation = item.translation;
                     target.pronunciation = finalPron;
                 }
             }
         } else {
             const target = newSyncData[meta.lineIndex];
             if (target) {
                 target.translation = item.translation;
                 target.pronunciation = finalPron;
             }
         }
     });
     updateSongInLibrary({
        ...selectedSong,
        syncData: newSyncData,
        autoSyncData: selectedSong.autoSyncData ? newSyncData : selectedSong.autoSyncData
     });
     setIsTranslationManagerOpen(false);
     setNotification({ show: true, message: 'Workspace changes saved!', progress: 100 });
     setTimeout(() => setNotification({ show: false }), 2000);
  };

  const handleExport = () => {
     const textContent = workspaceData.map(line => 
              `${line.displayText}\n${line.displayPron ? line.displayPron + '\n' : ''}${line.translation ? line.translation + '\n' : ''}`
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
          const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
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
            w => w.displayText.toLowerCase() === originalText.toLowerCase()
          );
          if (targetIndex === -1 && blockIdx < newData.length) {
            targetIndex = blockIdx;
          }
          if (targetIndex !== -1) {
            newData[targetIndex].translation = importedTrans;
            newData[targetIndex].displayPron = importedPron;
            let currentPron = newData[targetIndex].pronunciation;
            if (currentPron && currentPron.startsWith('{')) {
              try {
                let p = JSON.parse(currentPron);
                p.full = importedPron;
                newData[targetIndex].pronunciation = JSON.stringify(p);
              } catch(err) {
                newData[targetIndex].pronunciation = importedPron;
              }
            } else {
              newData[targetIndex].pronunciation = importedPron;
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

  const renderTextWithYellowPunctuation = (text, baseStyle = {}, isAdlibChar = false) => {
    if (!text) return null;
    const parts = text.split(/([.,!?;:"'()\[\]{}\- ]+)/);
    return parts.map((part, pIdx) => {
      const isPunct = /^[.,!?;:"'()\[\]{}\- ]+$/.test(part);
      if (isPunct && !isAdlibChar) {
        return (
          <span key={pIdx} style={{ color: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.6)' }}>
            {part}
          </span>
        );
      }
      return <span key={pIdx} style={baseStyle}>{part}</span>;
    });
  };

  const renderColoredOriginalText = (line) => {
    const isMainAndSplit = !line._meta.isAdlib && line.isSplit && line.adlibs;
    if (line.segments && line.segments.length > 0) {
      let globalCharIndex = 0;
      return line.segments.map((seg, idx) => {
        let inlineColor = seg.color || '#ffffff';
        let inlineIsGradient = seg.isGradient || false;
        let inlineGradient = seg.gradient || '';
        if (seg.artists && seg.artists.length > 0) {
          if (seg.artists.length > 1) {
            inlineIsGradient = true;
            const c1 = masterPalette[seg.artists[0]] || '#ffffff';
            const c2 = masterPalette[seg.artists[1]] || '#ffffff';
            inlineGradient = `linear-gradient(90deg, ${c1}, ${c2})`;
          } else {
            inlineColor = masterPalette[seg.artists[0]] || inlineColor;
          }
        }
        const segChars = Array.from(seg.text);
        const charElements = segChars.map((char) => {
          const cIdx = globalCharIndex++;
          const isAdlibChar = isMainAndSplit && line.adlibs.some(a => cIdx >= a.charStart && cIdx < a.charEnd);
          let segStyle = inlineIsGradient ? {
            backgroundImage: inlineGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          } : {
            color: inlineColor
          };
          if (isAdlibChar) {
            segStyle = {
              ...segStyle,
              opacity: 0.35,
              textDecoration: 'line-through 2px white',
              textDecorationColor: '#ffffff'
            };
          }
          return (
            <React.Fragment key={cIdx}>
              {renderTextWithYellowPunctuation(char, segStyle, isAdlibChar)}
            </React.Fragment>
          );
        });
        return <React.Fragment key={idx}>{charElements}</React.Fragment>;
      });
    }
    const defaultColor = line.singer ? masterPalette[line.singer.split(/\s*(?:&|,|\band\b)\s*/i)[0]?.trim()] || '#ffffff' : '#ffffff';
    if (isMainAndSplit) {
      const chars = Array.from(line.displayText);
      return chars.map((char, cIdx) => {
        const isAdlibChar = line.adlibs.some(a => cIdx >= a.charStart && cIdx < a.charEnd);
        let baseStyle = { color: defaultColor };
        if (isAdlibChar) {
          baseStyle = {
            ...baseStyle,
            opacity: 0.35,
            textDecoration: 'line-through 2px white',
            textDecorationColor: '#ffffff'
          };
        }
        return (
          <React.Fragment key={cIdx}>
            {renderTextWithYellowPunctuation(char, baseStyle, isAdlibChar)}
          </React.Fragment>
        );
      });
    }
    return renderTextWithYellowPunctuation(line.displayText, { color: defaultColor }, false);
  };

  if (isLoading) return <div className="tw-container"><p>Loading workspace...</p></div>;

  return (
    <div className="tw-container">
        <ConfirmModal
          isOpen={confirmModalState.isOpen}
          title={confirmModalState.title}
          message={confirmModalState.message}
          confirmText={confirmModalState.confirmText}
          cancelText={confirmModalState.cancelText}
          onConfirm={confirmModalState.onConfirm}
          onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        />
        <div className="tw-header glass-panel">
            <div className="tw-header-actions full-width-actions">
                <button 
                  className={`tw-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
                  onClick={handleTranslateAll}
                >
                  {isTranslatingAll ? (
                    <>
                      <span className="tw-spinner"></span>
                      <span>Stop Translation ({translateProgress.current}/{translateProgress.total})</span>
                    </>
                  ) : (
                    'Translate All'
                  )}
                </button>
                <button 
                  className={`tw-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
                  onClick={handleTranslateWithContext}
                  style={{ background: 'rgba(179, 136, 235, 0.2)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  Translate with Context
                </button>
                <button 
                  className="tw-btn"
                  onClick={handleRefreshWorkspace}
                  disabled={isTranslatingAll}
                  title="Wipe all translation and transliteration fields"
                  style={{ background: 'rgba(250, 36, 60, 0.15)', borderColor: 'rgba(250, 36, 60, 0.3)', color: '#FA243C' }}
                >
                  Refresh Lyrics
                </button>
                
                <button className="tw-btn" onClick={handleExport} disabled={isTranslatingAll}>Export Text</button>
                
                <input 
                  type="file"
                  accept=".txt,text/plain"
                  ref={importFileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImportText}
                />
                <button className="tw-btn" onClick={() => importFileInputRef.current?.click()} disabled={isTranslatingAll}>
                  Import Text
                </button>
                <div className="tw-header-spacer"></div>
                <button className="tw-btn tw-btn-cancel" onClick={handleCancel}>Cancel</button>
                <button 
                  className="tw-btn tw-btn-save"
                  onClick={handleSave}
                >
                  Save Changes
                </button>
            </div>
        </div>

        {showSuccessBanner && (
          <div className="tw-success-banner">
             <span className="tw-success-icon">✓</span>
             <span>All lines translated successfully! Click <strong>Save Changes</strong> to apply to lyrics.</span>
          </div>
        )}

        <div className="tw-list glass-panel-light" ref={listContainerRef}>
           {workspaceData.map((line, idx) => {
              const isAdlib = line._meta.isAdlib;
              const isTranslating = activeTranslatingId === line.rowId;
              return (
                  <div 
                    key={line.rowId}
                    ref={isTranslating ? activeRowRef : null}
                    className={`tw-row ${isAdlib ? 'tw-row-adlib' : ''} ${isTranslating ? 'tw-row-active' : ''}`}
                  >
                     <div className="tw-col tw-col-left">
                        <div className="tw-original-text" dir="ltr" style={{ textAlign: 'left' }}>
                          {renderColoredOriginalText(line)}
                        </div>
                        <input 
                          className="tw-input tw-translit-input"
                          value={line.displayPron || ''}
                          onChange={(e) => handleChange(idx, 'displayPron', e.target.value)}
                          placeholder="Transliteration..."
                          dir="ltr"
                          style={{ textAlign: 'left' }}
                        />
                     </div>
                     <div className="tw-col tw-col-right">
                        <textarea 
                          className="tw-input tw-translation-input"
                          value={line.translation || ''}
                          onChange={(e) => handleChange(idx, 'translation', e.target.value)}
                          placeholder="English Translation..."
                          dir="ltr"
                          style={{ textAlign: 'left' }}
                        />
                     </div>
                     <div className="tw-col-actions">
                        <button 
                          className={`tw-refetch-btn ${isTranslating ? 'tw-refetch-active' : ''}`}
                          onClick={() => handleRefetch(idx)}
                          disabled={isTranslatingAll}
                          title="Re-fetch from Google Translate"
                        >
                            {isTranslating ? (
                              <span className="tw-spinner"></span>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                            )}
                        </button>
                     </div>
                  </div>
              );
           })}
        </div>
    </div>
  );
};

export default TranslationWorkspace;
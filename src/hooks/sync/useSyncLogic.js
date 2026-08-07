/* --- src/hooks/useSyncLogic.js --- */
import { useEffect } from 'react';
import { quickTransliterate } from '../../services/transliterator';
import { workspaceClock } from '../../utils/clockEngine';
import { fetchYouLyrics, fetchLRCLIB, parseLRC, parseLyrics } from '../../utils/songHelpers';

// ------------------------------------------------------------------
// 1. ENGINE: Handles the requestAnimationFrame loop and auto-tracking
// ------------------------------------------------------------------
export const useSyncEngine = ({
  isSyncPlaying, setIsSyncPlaying, syncAudioRef, syncYtVideoId, syncYtPlayerRef,
  workspaceLinesRef, activeIdxRef, setActiveSyncIndex,
  syncDataRef, updateWorkspaceData,
  loopRangeRef, setLoopRange,
  constrainedEndRef, setConstrainedEnd }) => {

  const autoTrackSyncPlayback = (time) => {
    const wLines = workspaceLinesRef.current;
    if (!wLines || wLines.length === 0) return;
    const currentItem = wLines[activeIdxRef.current];
    
    if (currentItem && (currentItem.ref.start === null || (currentItem.ref.start !== null && currentItem.ref.end === null))) {
      return; 
    }
    
    let newIdx = -1;
    for (let i = 0; i < wLines.length; i++) {
      const item = wLines[i];
      if (item.type !== 'main' || item.ref.start === null) continue;
      
      let nextStart = null;
      for (let j = i + 1; j < wLines.length; j++) {
        if (wLines[j].type === 'main' && wLines[j].ref.start !== null) {
          nextStart = wLines[j].ref.start;
          break;
        }
      }
      
      if (time >= item.ref.start) {
        if (nextStart === null || time < nextStart) {
            if (item.ref.end !== null && time > item.ref.end) {
                newIdx = -1;
            } else {
                newIdx = i;
            }
            break;
        }
      }
    }
    
    if (newIdx === -1) {
        for (let i = 0; i < wLines.length; i++) {
            if (wLines[i].type === 'main') {
                if (wLines[i].ref.start === null) {
                    newIdx = i;
                }
                break;
            }
        }
    }
    
    if (newIdx !== activeIdxRef.current) {
      if (newIdx !== -1 && currentItem?.type === 'adlib' && wLines[newIdx].lineIndex === currentItem.lineIndex) {
        return; 
      }
      setActiveSyncIndex(newIdx);
    }
  };

  useEffect(() => {
    let animationFrameId;
    
    const syncTick = () => {
      if (isSyncPlaying) {
        const time = workspaceClock.getCurrentTime();

        // Sync native player anchor checks
        if (syncYtVideoId && syncYtPlayerRef?.current) {
          try {
            const ytTime = syncYtPlayerRef.current.getCurrentTime();
            if (ytTime !== undefined) workspaceClock.updateAnchor(ytTime);
          } catch (e) {}
        } else if (syncAudioRef?.current) {
          workspaceClock.updateAnchor(syncAudioRef.current.currentTime);
        }
        
        const wLines = workspaceLinesRef.current;
        const currentItem = wLines[activeIdxRef.current];
        
        if (currentItem?.type === 'adlib' && currentItem.ref.start !== null && currentItem.ref.end === null) {
          if (currentItem.parentRef.end !== null && time >= currentItem.parentRef.end) {
             const data = [...syncDataRef.current];
             const itemToMutate = data[currentItem.lineIndex].adlibs[currentItem.adlibIndex];
             itemToMutate.end = currentItem.parentRef.end;
             updateWorkspaceData(data);
             setLoopRange(null);
             
             let nextIdx = activeIdxRef.current + 1;
             while (nextIdx < wLines.length && wLines[nextIdx].type !== 'main') nextIdx++;
             if (nextIdx < wLines.length) {
                 setActiveSyncIndex(nextIdx);
                 activeIdxRef.current = nextIdx;
             }
          }
        }
        
        if (loopRangeRef.current) {
          if (time >= loopRangeRef.current.end) {
            if (syncYtVideoId && syncYtPlayerRef?.current) {
              try {
                syncYtPlayerRef.current.pauseVideo();
                syncYtPlayerRef.current.seekTo(loopRangeRef.current.start, true);
              } catch (e) {}
            } else if (syncAudioRef?.current) {
              syncAudioRef.current.pause();
              syncAudioRef.current.currentTime = loopRangeRef.current.start;
            }
            workspaceClock.pause();
            workspaceClock.seek(loopRangeRef.current.start);
            setIsSyncPlaying(false);
          }
        } else if (constrainedEndRef.current !== null && time >= constrainedEndRef.current) {
          if (syncYtVideoId && syncYtPlayerRef?.current) {
            try { syncYtPlayerRef.current.pauseVideo(); } catch (e) {}
          } else if (syncAudioRef?.current) {
            syncAudioRef.current.pause();
          }
          workspaceClock.pause();
          setIsSyncPlaying(false);
          setConstrainedEnd(null);
        } else {
          autoTrackSyncPlayback(time);
        }

        animationFrameId = requestAnimationFrame(syncTick);
      }
    };

    if (isSyncPlaying) {
      workspaceClock.start(workspaceClock.getCurrentTime());
      animationFrameId = requestAnimationFrame(syncTick);
    } else {
      workspaceClock.pause();
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSyncPlaying, syncYtVideoId]);
};

// ------------------------------------------------------------------
// 2. KEYBOARD: Handles manual syncing and spacebar controls
// ------------------------------------------------------------------
export const useSyncKeyboard = ({
  isSyncMode, syncAudioRef, syncYtVideoId, syncYtPlayerRef, activeIdxRef, workspaceLinesRef,
  syncDataRef, updateWorkspaceData, setActiveSyncIndex, setLoopRange,
  loopRangeRef, isShowingAutoSync }) => {

  const getCurrentTime = () => {
    return workspaceClock.getCurrentTime();
  };

  const seekToTime = (t) => {
    workspaceClock.seek(t);
    if (syncYtVideoId && syncYtPlayerRef?.current) {
      try { syncYtPlayerRef.current.seekTo(t, true); } catch (e) {}
    } else if (syncAudioRef?.current) {
      syncAudioRef.current.currentTime = t;
    }
  };

  useEffect(() => {
    if (!isSyncMode) return;
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        e.preventDefault();
        
        if (syncYtVideoId && syncYtPlayerRef?.current) {
          try {
            const state = syncYtPlayerRef.current.getPlayerState();
            if (state === window.YT.PlayerState.PLAYING) {
              syncYtPlayerRef.current.pauseVideo();
              workspaceClock.pause();
            } else {
              if (loopRangeRef?.current && getCurrentTime() >= loopRangeRef.current.end) {
                seekToTime(loopRangeRef.current.start);
              }
              syncYtPlayerRef.current.playVideo();
              workspaceClock.start(getCurrentTime());
            }
          } catch (err) {}
        } else if (syncAudioRef?.current) {
          if (loopRangeRef && loopRangeRef.current && syncAudioRef.current.currentTime >= loopRangeRef.current.end) {
              syncAudioRef.current.currentTime = loopRangeRef.current.start;
          }
          if (syncAudioRef.current.paused) {
            syncAudioRef.current.play().catch(err => console.log(err));
            workspaceClock.start(syncAudioRef.current.currentTime || 0);
          } else {
            syncAudioRef.current.pause();
            workspaceClock.pause();
          }
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekToTime(Math.max(0, getCurrentTime() - 1));
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekToTime(getCurrentTime() + 1);
        return;
      }
      
      const currentIdx = activeIdxRef.current;
      const wLines = workspaceLinesRef.current;
      if (!wLines[currentIdx]) return;
      
      const currentItem = wLines[currentIdx];
      const data = [...syncDataRef.current];
      
      let itemToMutate;
      if (currentItem.type === 'main') itemToMutate = data[currentItem.lineIndex];
      else itemToMutate = data[currentItem.lineIndex].adlibs[currentItem.adlibIndex];
      
      const time = getCurrentTime();
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (isShowingAutoSync && currentItem.type === 'main') {
            let nextIdx = currentIdx + 1;
            while (nextIdx < wLines.length && wLines[nextIdx].type !== 'main') nextIdx++;
            if (nextIdx < wLines.length) {
                setActiveSyncIndex(nextIdx);
                activeIdxRef.current = nextIdx;
            }
            return;
        }

        if (itemToMutate.start === null) itemToMutate.start = time;
        else if (itemToMutate.end === null) {
          let newEnd = time;
          if (newEnd < itemToMutate.start) newEnd = itemToMutate.start;
          
          if (currentItem.type === 'adlib' && currentItem.parentRef.end !== null && newEnd > currentItem.parentRef.end) {
            newEnd = currentItem.parentRef.end;
          }
          itemToMutate.end = newEnd;
          
          if (currentItem.type === 'adlib') setLoopRange(null);
          
          let nextIdx = currentIdx + 1;
          while (nextIdx < wLines.length && wLines[nextIdx].type !== 'main') nextIdx++;
          if (nextIdx < wLines.length) {
            setActiveSyncIndex(nextIdx);
            activeIdxRef.current = nextIdx;
          }
        } else {
          let nextIdx = currentIdx + 1;
          while (nextIdx < wLines.length && wLines[nextIdx].type !== 'main') nextIdx++;
          if (nextIdx < wLines.length) {
            setActiveSyncIndex(nextIdx);
            activeIdxRef.current = nextIdx;
          }
        }
        updateWorkspaceData(data);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isShowingAutoSync && currentItem.type === 'main') {
            let prevIdx = currentIdx - 1;
            while (prevIdx >= 0 && wLines[prevIdx].type !== 'main') prevIdx--;
            if (prevIdx >= 0) {
                setActiveSyncIndex(prevIdx);
                activeIdxRef.current = prevIdx;
                const prevItem = wLines[prevIdx].ref;
                seekToTime(prevItem.start || 0);
            }
            return;
        }

        if (itemToMutate.end !== null) {
          itemToMutate.end = null;
          if (currentItem.type === 'adlib') {
            setLoopRange({ start: currentItem.parentRef.start, end: currentItem.parentRef.end });
          }
          seekToTime(itemToMutate.start || 0);
        } else if (itemToMutate.start !== null) {
          itemToMutate.start = null;
          let prevIdx = currentIdx - 1;
          while (prevIdx >= 0 && wLines[prevIdx].type !== 'main') prevIdx--;
          const prevItem = prevIdx >= 0 ? wLines[prevIdx].ref : null;
          seekToTime(prevItem?.end || prevItem?.start || 0);
        } else {
          let prevIdx = currentIdx - 1;
          while (prevIdx >= 0 && wLines[prevIdx].type !== 'main') prevIdx--;
          if (prevIdx >= 0) {
            setActiveSyncIndex(prevIdx);
            activeIdxRef.current = prevIdx;
            const prevItem = wLines[prevIdx].ref;
            seekToTime(prevItem.start || 0);
          }
        }
        updateWorkspaceData(data);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSyncMode, isShowingAutoSync, syncYtVideoId]);
};

// ------------------------------------------------------------------
// 3. ACTIONS: DB Fetching, Bulk Translating, Ad-lib Splitting, & Auto Mapping
// ------------------------------------------------------------------
export const useSyncActions = ({
  selectedSong, isSaved, customData, setCustomData, masterPalette,
  updateSongInLibrary, isShowingAutoSync, setIsShowingAutoSync,
  isSyncMode, setSyncData, syncDataRef, setNotification,
  setIsLrcFetching, setIsTranslating, updateWorkspaceData,
  setLoopRange, setDebugInfo }) => {

  const handleSplitAdlibs = async (lineIndex) => {
    const data = [...syncDataRef.current];
    const line = data[lineIndex];
    const lineChars = Array.from(line.text);
    const adlibs = [];
    
    let inAdlib = false;
    let charStart = 0;
    let adlibText = '';
    
    for (let i = 0; i < lineChars.length; i++) {
        if (lineChars[i] === '(' && !inAdlib) {
            inAdlib = true;
            charStart = i;
            adlibText = '(';
        } else if (inAdlib) {
            adlibText += lineChars[i];
            if (lineChars[i] === ')') {
                inAdlib = false;
                const charEnd = i + 1;
                
                const adlibSegments = [];
                const adlibArtistsSet = new Set();
                let currentPos = 0;
                
                for (const seg of line.segments) {
                    const segChars = Array.from(seg.text);
                    const segStart = currentPos;
                    const segEnd = currentPos + segChars.length;
                    const overlapStart = Math.max(charStart, segStart);
                    const overlapEnd = Math.min(charEnd, segEnd);
                    if (overlapStart < overlapEnd) {
                        const overlapText = segChars.slice(overlapStart - segStart, overlapEnd - segStart).join('');
                        adlibSegments.push({
                            ...seg,
                            text: overlapText
                        });
                        const isOnlyPunctuationOrSpace = /^[\s.,!?;:"'()\[\]{}\- ]*$/;
                        if (!isOnlyPunctuationOrSpace.test(overlapText)) {
                            if (seg.artists) seg.artists.forEach(a => adlibArtistsSet.add(a));
                        }
                    }
                    currentPos = segEnd;
                }
                const derivedSinger = Array.from(adlibArtistsSet).join(', ') || line.singer;
                const pronData = await quickTransliterate(adlibText);
                adlibs.push({
                  text: adlibText,
                  charStart,
                  charEnd,
                  start: null,
                  end: null,
                  segments: adlibSegments,
                  singer: derivedSinger,
                  pronunciation: pronData.transliteration ? JSON.stringify({ full: pronData.transliteration, chunks: [{ type: 'foreign', text: adlibText, trans: pronData.transliteration }] }) : null
                });
            }
        }
    }
    
    if (adlibs.length > 0) {
      line.isSplit = true;
      line.adlibs = adlibs;
      updateWorkspaceData(data);
    }
  };

  const handleUndoSplit = (lineIndex) => {
    const data = [...syncDataRef.current];
    data[lineIndex].isSplit = false;
    delete data[lineIndex].adlibs;
    updateWorkspaceData(data);
    setLoopRange(null);
  };

  const handleMapAutoSync = () => {
    if (!selectedSong?.autoSyncData || selectedSong.autoSyncData.length === 0) {
      return alert("No Auto-Sync data available to map from!");
    }
    const autoData = selectedSong.autoSyncData.filter(line => line.start !== null);
    if (autoData.length === 0) {
      return alert("Auto-Sync data contains no timing points.");
    }
    const parsedLines = parseLyrics(customData.lyrics || '', selectedSong.artistName, masterPalette);
    if (parsedLines.length === 0) {
      return alert("No manual lyrics available to map.");
    }

    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    const updatedSyncData = parsedLines.map((line, i) => {
      const existing = selectedSong?.syncData?.[i] || {};
      return {
        ...line,
        translation: existing.translation || '',
        pronunciation: existing.pronunciation || null,
        start: null,
        end: null,
        isSplit: existing.isSplit || false,
        adlibs: existing.adlibs || undefined
      };
    });

    let autoPointer = 0;
    let manualPointer = 0;

    while (manualPointer < updatedSyncData.length && autoPointer < autoData.length) {
      const manualLine = updatedSyncData[manualPointer];
      const cleanManual = normalize(manualLine.text);

      if (!cleanManual) {
        manualPointer++;
        continue;
      }

      let matchedAutoIdx = -1;
      let highestScore = 0;

      for (let a = autoPointer; a < Math.min(autoPointer + 5, autoData.length); a++) {
        const cleanAuto = normalize(autoData[a].text);
        if (!cleanAuto) continue;

        let score = 0;
        if (cleanManual === cleanAuto) {
          score = 100;
        } else if (cleanAuto.includes(cleanManual) || cleanManual.includes(cleanAuto)) {
          score = 60 + (Math.min(cleanManual.length, cleanAuto.length) / Math.max(cleanManual.length, cleanAuto.length)) * 40;
        }

        if (score > highestScore && score > 35) {
          highestScore = score;
          matchedAutoIdx = a;
        }
      }

      if (matchedAutoIdx !== -1) {
        const targetAutoLine = autoData[matchedAutoIdx];
        const manualGroup = [manualPointer];
        let nextManual = manualPointer + 1;
        
        while (nextManual < updatedSyncData.length) {
          const cleanNextManual = normalize(updatedSyncData[nextManual].text);
          if (!cleanNextManual) {
            nextManual++;
            continue;
          }
          const cleanAutoText = normalize(targetAutoLine.text);
          if (cleanAutoText.includes(cleanNextManual) && !cleanAutoText.startsWith(cleanManual)) {
            manualGroup.push(nextManual);
            nextManual++;
          } else {
            break;
          }
        }

        const blockStart = targetAutoLine.start;
        const blockEnd = targetAutoLine.end !== null ? targetAutoLine.end : blockStart + 5;
        const blockDuration = Math.max(0.5, blockEnd - blockStart);

        if (manualGroup.length === 1) {
          updatedSyncData[manualPointer].start = blockStart;
          updatedSyncData[manualPointer].end = blockEnd;
        } else {
          let totalChars = 0;
          const charCounts = manualGroup.map(idx => {
            const len = Array.from(updatedSyncData[idx].text.trim()).length || 1;
            totalChars += len;
            return len;
          });

          let accTime = blockStart;
          manualGroup.forEach((mIdx, pos) => {
            const ratio = charCounts[pos] / totalChars;
            const dur = blockDuration * ratio;
            updatedSyncData[mIdx].start = Math.round(accTime * 1000) / 1000;
            accTime += dur;
            updatedSyncData[mIdx].end = Math.round(accTime * 1000) / 1000;
          });
        }

        manualPointer = manualGroup[manualGroup.length - 1] + 1;
        autoPointer = matchedAutoIdx + 1;
      } else {
        manualPointer++;
      }
    }

    updateSongInLibrary({
      ...selectedSong,
      syncData: updatedSyncData
    });

    if (isSyncMode) {
      setSyncData(updatedSyncData);
      syncDataRef.current = updatedSyncData;
    }
    
    setNotification({ show: true, message: 'Sequentially mapped Auto-Sync timings to Manual Lyrics!', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 2500);
  };

  const handleAutoSyncDatabases = async (forceSync = false) => {
    if (!isSaved && !forceSync) return alert("Please add to Vault first before auto-syncing!");
    
    if (selectedSong.autoSyncData && selectedSong.autoSyncData.length > 0 && !forceSync) {
      if (isShowingAutoSync) {
        setIsShowingAutoSync(false);
        if (isSyncMode) {
          setSyncData(selectedSong.syncData || []);
          syncDataRef.current = selectedSong.syncData || [];
        }
        setNotification({ show: true, message: 'Switched to Manual Sync', progress: 100 });
        setTimeout(() => setNotification({ show: false }), 2000);
      } else {
        setIsShowingAutoSync(true);
        if (isSyncMode) {
          setSyncData(selectedSong.autoSyncData);
          syncDataRef.current = selectedSong.autoSyncData;
        }
        setNotification({ show: true, message: 'Showing Auto-Sync Data', progress: 100 });
        setTimeout(() => setNotification({ show: false }), 2000);
      }
      return;
    }

    setIsLrcFetching(true);
    setNotification({ show: true, message: 'Fetching from databases...', progress: null });
    
    try {
      let finalSyncData = null;
      let finalPlainText = "";
      let hasWordSync = false;
      let finalSource = 'None';
      let finalRawData = null;

      const youData = await fetchYouLyrics(selectedSong.trackName, selectedSong.artistName, selectedSong.trackTimeMillis);
      let youParsed = null;
      let youHasWordSync = false;
      
      if (youData?.syncedLyrics) {
        youParsed = parseLRC(youData.syncedLyrics, selectedSong.artistName, masterPalette);
        youHasWordSync = youParsed.syncData.some(line => line.wordSync?.length > 0);
      }

      if (youHasWordSync) {
        finalSyncData = youParsed.syncData; finalPlainText = youParsed.plainTextLyrics; hasWordSync = true; finalSource = 'YouLyrics API'; finalRawData = youData;
      } else {
        const lrcData = await fetchLRCLIB(selectedSong.trackName, selectedSong.artistName, selectedSong.trackTimeMillis);
        if (lrcData?.syncedLyrics) {
          const lrcParsed = parseLRC(lrcData.syncedLyrics, selectedSong.artistName, masterPalette);
          const lrcHasWordSync = lrcParsed.syncData.some(line => line.wordSync?.length > 0);
          if (lrcHasWordSync || !youParsed) {
            finalSyncData = lrcParsed.syncData; finalPlainText = lrcParsed.plainTextLyrics; hasWordSync = lrcHasWordSync; finalSource = 'LRCLIB API'; finalRawData = lrcData;
          } else {
            finalSyncData = youParsed.syncData; finalPlainText = youParsed.plainTextLyrics; finalSource = 'YouLyrics API (Fallback)'; finalRawData = youData;
          }
        } else if (youParsed) {
          finalSyncData = youParsed.syncData; finalPlainText = youParsed.plainTextLyrics; finalSource = 'YouLyrics API (Fallback)'; finalRawData = youData;
        } else {
          if (youData?.plainLyrics) { finalPlainText = youData.plainLyrics; finalSource = 'YouLyrics API (Plain Text)'; finalRawData = youData; }
          else if (lrcData?.plainLyrics) { finalPlainText = lrcData.plainLyrics; finalSource = 'LRCLIB API (Plain Text)'; finalRawData = lrcData; }
        }
      }

      setDebugInfo({ source: finalSource, rawData: finalRawData });

      if (!finalSyncData && !finalPlainText) {
        setNotification({ show: false });
        alert("No lyrics found in databases.");
        return setIsLrcFetching(false);
      }

      if (finalSyncData) {
        const hasManualLyrics = Boolean(customData.lyrics && customData.lyrics.trim());
        const hasManualSync = selectedSong.syncData && selectedSong.syncData.some(l => l.start !== null);
        
        let newSyncData = hasManualSync ? selectedSong.syncData : (hasManualLyrics ? selectedSong.syncData : finalSyncData);
        let saveLyrics = hasManualLyrics ? customData.lyrics : finalPlainText;

        updateSongInLibrary({ ...selectedSong, autoSyncData: finalSyncData, syncData: newSyncData, lyrics: saveLyrics });
        
        if (!hasManualLyrics) {
          setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
        }
        
        setNotification({ show: true, message: hasWordSync ? 'Word-by-word sync found!' : 'Auto-sync successful!', progress: 100 });
      } else {
        if (!customData.lyrics) {
          updateSongInLibrary({ ...selectedSong, lyrics: finalPlainText });
          setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
        }
        setNotification({ show: true, message: 'Imported plain lyrics.', progress: 100 });
      }
    } catch (error) {
      console.error(error); alert("Error fetching lyrics.");
      setNotification({ show: false });
    } finally {
       setIsLrcFetching(false);
       setTimeout(() => setNotification({ show: false }), 3000);
    }
  };

  const handleTranslate = async () => {};

  return { handleSplitAdlibs, handleUndoSplit, handleAutoSyncDatabases, handleTranslate, handleMapAutoSync };
};
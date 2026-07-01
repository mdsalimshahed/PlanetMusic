/* --- src/hooks/useSyncWorkspace.js --- */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getAudioFile } from '../db';
import { getBulkPronunciations, quickTransliterate } from '../transliterator';
import { parseLyrics, mergeSyncWithGenius, fetchYouLyrics, fetchLRCLIB, parseLRC } from '../utils/songHelpers';

export const useSyncWorkspace = (selectedSong, isSaved, customData, setCustomData, masterPalette, updateSongInLibrary, setCurrentTrack, setNotification) => {
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isLrcFetching, setIsLrcFetching] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [syncData, setSyncData] = useState([]);
  const [activeSyncIndex, setActiveSyncIndex] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [isSyncPlaying, setIsSyncPlaying] = useState(false);
  const [syncAudioSrc, setSyncAudioSrc] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [debugInfo, setDebugInfo] = useState({ source: 'None', rawData: null });
  
  const [constrainedEnd, setConstrainedEnd] = useState(null);
  const [loopRange, setLoopRange] = useState(null);

  const syncAudioRef = useRef(null);
  const activeLineRef = useRef(null);
  
  const activeIdxRef = useRef(activeSyncIndex);
  const syncDataRef = useRef(syncData);
  const constrainedEndRef = useRef(constrainedEnd);
  const loopRangeRef = useRef(loopRange);

  useEffect(() => { activeIdxRef.current = activeSyncIndex; }, [activeSyncIndex]);
  useEffect(() => { syncDataRef.current = syncData; }, [syncData]);
  useEffect(() => { constrainedEndRef.current = constrainedEnd; }, [constrainedEnd]);
  useEffect(() => { loopRangeRef.current = loopRange; }, [loopRange]);

  const workspaceLines = useMemo(() => {
    const lines = [];
    syncData.forEach((line, i) => {
      lines.push({ type: 'main', lineIndex: i, ref: line });
      if (line.isSplit && line.adlibs) {
        line.adlibs.forEach((adlib, j) => {
          lines.push({ type: 'adlib', lineIndex: i, adlibIndex: j, ref: adlib, parentRef: line });
        });
      }
    });
    return lines;
  }, [syncData]);

  const workspaceLinesRef = useRef(workspaceLines);
  useEffect(() => { workspaceLinesRef.current = workspaceLines; }, [workspaceLines]);

  useEffect(() => {
    if (selectedSong) {
      setIsSyncMode(false);
      setPlaybackRate(1.0);
      setDebugInfo({ source: 'Local Vault / Cache', rawData: null });
      setConstrainedEnd(null);
      setLoopRange(null);
    }
  }, [selectedSong]);

  useEffect(() => {
    const loadSyncAudio = async () => {
      if (isSyncMode && selectedSong) {
        if (customData.hasLocal) {
          const file = await getAudioFile(selectedSong.trackId);
          setSyncAudioSrc(file ? URL.createObjectURL(file) : selectedSong.previewUrl);
        } else setSyncAudioSrc(selectedSong.previewUrl);
      }
    };
    loadSyncAudio();
  }, [isSyncMode, customData.hasLocal, selectedSong]);

  useEffect(() => {
    if (isSyncMode && syncAudioRef.current) {
      const savedVolume = localStorage.getItem('playerVolume');
      syncAudioRef.current.volume = savedVolume !== null ? parseFloat(savedVolume) : 1;
      syncAudioRef.current.playbackRate = playbackRate;
    }
  }, [isSyncMode, syncAudioSrc, playbackRate]);

  useEffect(() => {
    if (isSyncMode && activeLineRef.current) {
      const container = activeLineRef.current.parentElement;
      const scrollPos = activeLineRef.current.offsetTop - (container.clientHeight / 2) + (activeLineRef.current.clientHeight / 2);
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activeSyncIndex, isSyncMode]);

  const autoTrackSyncPlayback = (time) => {
    const wLines = workspaceLinesRef.current;
    if (!wLines || wLines.length === 0) return;

    const currentItem = wLines[activeIdxRef.current];
    
    // Do not auto-track or steal focus if the user is waiting to record an unsynced line
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
      if (syncAudioRef.current && isSyncPlaying) {
        const time = syncAudioRef.current.currentTime;

        window.dispatchEvent(new CustomEvent('workspaceTimeUpdate', { detail: time }));

        const wLines = workspaceLinesRef.current;
        const currentItem = wLines[activeIdxRef.current];

        if (currentItem?.type === 'adlib' && currentItem.ref.start !== null && currentItem.ref.end === null) {
          if (currentItem.parentRef.end !== null && time >= currentItem.parentRef.end) {
             const data = [...syncDataRef.current];
             const itemToMutate = data[currentItem.lineIndex].adlibs[currentItem.adlibIndex];
             itemToMutate.end = currentItem.parentRef.end;
             setSyncData(data);
             syncDataRef.current = data;
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
          if (time >= loopRangeRef.current.end && syncAudioRef.current) {
            syncAudioRef.current.currentTime = loopRangeRef.current.start;
          }
        } else if (constrainedEndRef.current !== null && time >= constrainedEndRef.current) {
          syncAudioRef.current.pause();
          setIsSyncPlaying(false);
          setConstrainedEnd(null);
        } else {
          autoTrackSyncPlayback(time);
        }
      }
      
      if (isSyncPlaying) {
        animationFrameId = requestAnimationFrame(syncTick);
      }
    };

    if (isSyncPlaying) {
      animationFrameId = requestAnimationFrame(syncTick);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isSyncPlaying]);

  useEffect(() => {
    if (!isSyncMode) return;
    const handleKeyDown = (e) => {
      
      if (e.code === 'Space') {
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        e.preventDefault();
        if (syncAudioRef.current) {
          if (syncAudioRef.current.paused) syncAudioRef.current.play().catch(err => console.log(err));
          else syncAudioRef.current.pause();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (syncAudioRef.current) {
          syncAudioRef.current.currentTime = Math.max(0, syncAudioRef.current.currentTime - 1);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (syncAudioRef.current) {
          syncAudioRef.current.currentTime += 1;
        }
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

      const time = syncAudioRef.current?.currentTime || 0;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
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
            activeIdxRef.current = nextIdx; // INSTANT UPDATE PREVENTS DOUBLE JUMP
          }

        } else {
          let nextIdx = currentIdx + 1;
          while (nextIdx < wLines.length && wLines[nextIdx].type !== 'main') nextIdx++;
          if (nextIdx < wLines.length) {
            setActiveSyncIndex(nextIdx);
            activeIdxRef.current = nextIdx; // INSTANT UPDATE
          }
        }
        setSyncData(data);
        syncDataRef.current = data; // INSTANT UPDATE

      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (itemToMutate.end !== null) {
          itemToMutate.end = null;
          if (currentItem.type === 'adlib') {
            setLoopRange({ start: currentItem.parentRef.start, end: currentItem.parentRef.end });
          }
          if (syncAudioRef.current) syncAudioRef.current.currentTime = itemToMutate.start;
        } else if (itemToMutate.start !== null) {
          itemToMutate.start = null;
          let prevIdx = currentIdx - 1;
          while (prevIdx >= 0 && wLines[prevIdx].type !== 'main') prevIdx--;
          const prevItem = prevIdx >= 0 ? wLines[prevIdx].ref : null;
          if (syncAudioRef.current) syncAudioRef.current.currentTime = prevItem?.end || prevItem?.start || 0;
        } else {
          let prevIdx = currentIdx - 1;
          while (prevIdx >= 0 && wLines[prevIdx].type !== 'main') prevIdx--;
          if (prevIdx >= 0) {
            setActiveSyncIndex(prevIdx);
            activeIdxRef.current = prevIdx; // INSTANT UPDATE ALLOWS RECURSIVE DELETIONS
            const prevItem = wLines[prevIdx].ref;
            if (syncAudioRef.current) syncAudioRef.current.currentTime = prevItem.start || 0;
          }
        }
        setSyncData(data);
        syncDataRef.current = data; // INSTANT UPDATE
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSyncMode]);

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
                        const isOnlyPunctuationOrSpace = /^[\s.,!?;:"'()\[\]{}\-—–~¿¡«»“”‘’]*$/;
                        if (!isOnlyPunctuationOrSpace.test(overlapText)) {
                            if (seg.artists) seg.artists.forEach(a => adlibArtistsSet.add(a));
                        }
                    }
                    currentPos = segEnd;
                }

                const derivedSinger = Array.from(adlibArtistsSet).join(', ') || line.singer;
                const pron = await quickTransliterate(adlibText);

                adlibs.push({
                  text: adlibText,
                  charStart,
                  charEnd,
                  start: null,
                  end: null,
                  segments: adlibSegments,
                  singer: derivedSinger,
                  pronunciation: pron ? JSON.stringify([{ type: 'foreign', text: adlibText, trans: pron }]) : null
                });
            }
        }
    }
    
    if (adlibs.length > 0) {
      line.isSplit = true;
      line.adlibs = adlibs;
      setSyncData(data);
      syncDataRef.current = data;
    }
  };

  const handleUndoSplit = (lineIndex) => {
    const data = [...syncDataRef.current];
    data[lineIndex].isSplit = false;
    delete data[lineIndex].adlibs;
    setSyncData(data);
    syncDataRef.current = data;
    setLoopRange(null);
  };

  const startSyncMode = async () => {
    if (!isSaved) return alert("Please add this song to your Vault first before syncing!");
    setCurrentTrack(null);
    setIsSyncLoading(true);
    
    const parsedLines = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);
    let initialData = [];

    if (selectedSong.syncData?.length === parsedLines.length) {
      initialData = parsedLines.map((line, i) => ({ ...line, pronunciation: selectedSong.syncData[i].pronunciation || null, start: selectedSong.syncData[i].start, end: selectedSong.syncData[i].end, isSplit: selectedSong.syncData[i].isSplit || false, adlibs: selectedSong.syncData[i].adlibs || undefined }));
    } else if (selectedSong.syncData?.some(l => l.start !== null)) {
      const salvagedData = mergeSyncWithGenius(selectedSong.syncData, customData.lyrics, selectedSong.artistName, masterPalette);
      initialData = salvagedData.map((line) => ({ ...line, pronunciation: line.pronunciation || null }));
    } else {
      initialData = parsedLines.map((line) => ({ ...line, pronunciation: null, start: null, end: null }));
    }
    
    setSyncData(initialData);
    setActiveSyncIndex(0);
    setIsSyncMode(true);
    setIsSyncLoading(false);
  };

  const handleAutoSyncDatabases = async (forceSync = false) => {
    if (!isSaved && !forceSync) return alert("Please add to Vault first before auto-syncing!");
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
        if (customData.lyrics) {
          finalSyncData = mergeSyncWithGenius(finalSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
          finalPlainText = customData.lyrics;
        }
        
        updateSongInLibrary({ ...selectedSong, syncData: finalSyncData, lyrics: finalPlainText });
        setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
        setSyncData(finalSyncData);
        setNotification({ show: true, message: hasWordSync ? '✨ Word-by-word sync found!' : 'Auto-sync successful!', progress: 100 });
      } else {
        updateSongInLibrary({ ...selectedSong, lyrics: finalPlainText });
        setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
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

  const handleTranslate = async () => {
    if (!isSaved) return alert("Please add to Vault first before translating!");
    setIsTranslating(true);
    setNotification({ show: true, message: 'Preparing translation...', progress: 0 });

    let targetData = isSyncMode ? [...syncData] : (selectedSong.syncData ? [...selectedSong.syncData] : []);

    if (targetData.length === 0) {
      if (!customData.lyrics) {
        alert("No lyrics to translate!");
        setIsTranslating(false);
        setNotification({ show: false });
        return;
      }
      targetData = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette).map(l => ({...l, start: null, end: null, pronunciation: null}));
    }

    const linesToTranslate = targetData.map(l => l.text);

    const pronunciations = await getBulkPronunciations(linesToTranslate, (current, total) => {
      setNotification({ show: true, message: `Translating line ${current} of ${total}...`, progress: Math.round((current/total)*100) });
    });

    targetData = targetData.map((line, i) => ({ ...line, pronunciation: pronunciations[i] || line.pronunciation }));

    if (isSyncMode) setSyncData(targetData);
    
    updateSongInLibrary({ ...selectedSong, syncData: targetData });

    setNotification({ show: true, message: 'Translation complete!', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 3000);
    setIsTranslating(false);
  };

  const saveSyncData = () => {
    updateSongInLibrary({ ...selectedSong, syncData, lyrics: customData.lyrics });
    setIsSyncMode(false);
  };

  const toggleSyncPlay = () => {
    if (!syncAudioRef.current) return;
    if (syncAudioRef.current.paused) syncAudioRef.current.play().catch(e => console.log(e));
    else syncAudioRef.current.pause();
  };

  const handleSyncSeek = (e) => {
    const time = Number(e.target.value);
    if (syncAudioRef.current) syncAudioRef.current.currentTime = time;
    window.dispatchEvent(new CustomEvent('workspaceTimeUpdate', { detail: time }));
  };

  const handleSpeedChange = (e) => setPlaybackRate(parseFloat(e.target.value));

  return {
    isSyncMode, setIsSyncMode, isSyncLoading, isLrcFetching, isTranslating, syncData, setSyncData, activeSyncIndex, setActiveSyncIndex,
    syncDuration, setSyncDuration, isSyncPlaying, setIsSyncPlaying, syncAudioSrc, playbackRate, debugInfo,
    syncAudioRef, activeLineRef, startSyncMode, saveSyncData, handleAutoSyncDatabases, handleTranslate, toggleSyncPlay, handleSyncSeek,
    handleSpeedChange, workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange
  };
};
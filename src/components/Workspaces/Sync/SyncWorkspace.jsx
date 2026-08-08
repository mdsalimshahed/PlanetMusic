/* --- src/components/Workspaces/Sync/SyncWorkspace.jsx --- */
import React, { useState, useEffect, useRef } from 'react';
import { formatPreciseTime } from '../../../utils/songHelpers';
import { quickTransliterate } from '../../../services/transliterator';
import { workspaceClock } from '../../../utils/clockEngine';
import { normalizeTrans } from '../Lyrics/LyricsLineRenderer';
import { getGraphemes } from '../../LyricsRenderer/textUtils';
import './SyncWorkspace.css';

const isRTLLanguage = (text) => /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text || '');

export const SyncWorkspace = ({
  syncData, activeSyncIndex, setActiveSyncIndex, syncDuration, setSyncDuration,
  isSyncPlaying, toggleSyncPlay, handleSyncSeek, playbackRate, handleSpeedChange,
  syncAudioRef, syncAudioSrc, syncYtVideoId, syncYtPlayerRef, activeSyncSource, setActiveSyncSource, setIsSyncPlaying, activeLineRef, 
  workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange, masterPalette,
  selectedSong, isShowingAutoSync, toggleWorkspaceMode, handleMapAutoSync,
  availableSources, setManualSource, setNotification
}) => {
  const progressSliderRef = useRef(null);
  const preciseTimeRef = useRef(null);
  const containerRef = useRef(null);

  const [accentColor, setAccentColor] = useState('var(--accent)');
  const [ytReady, setYtReady] = useState(false);

  useEffect(() => {
    if (!selectedSong || !selectedSong.artworkUrl100) return;
    let img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 5; canvas.height = 5;
        ctx.drawImage(img, 0, 0, 5, 5);
        
        const data = ctx.getImageData(0, 0, 5, 5).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] > 127 && (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20)) {
            r += data[i]; g += data[i+1]; b += data[i+2]; count++;
          }
        }
        
        if (count > 0) {
          r = Math.min(255, Math.floor(r / count) + 30);
          g = Math.min(255, Math.floor(g / count) + 30);
          b = Math.min(255, Math.floor(b / count) + 30);
          setAccentColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch (e) {
        setAccentColor('var(--accent)'); 
      } finally {
        img.onload = null; img.onerror = null; img.src = ''; img = null;
      }
    };
    img.onerror = () => {
      setAccentColor('var(--accent)');
      img.onload = null; img.onerror = null; img.src = ''; img = null;
    };
    img.src = selectedSong.artworkUrl100;
  }, [selectedSong?.artworkUrl100]);

  useEffect(() => {
    if (!syncYtVideoId) return;
    let playerInstance = null;

    const initSyncYT = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initSyncYT, 100);
        return;
      }
      const target = document.getElementById('sync-yt-target-container');
      if (!target) return;
      
      target.innerHTML = '<div id="sync-yt-iframe" style="width:100%;height:100%;"></div>';
      
      playerInstance = new window.YT.Player('sync-yt-iframe', {
        videoId: syncYtVideoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0, playsinline: 1, rel: 0, enablejsapi: 1, origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            syncYtPlayerRef.current = event.target;
            setYtReady(true);
            const savedVol = localStorage.getItem('playerVolume');
            const vol = savedVol !== null ? parseFloat(savedVol) : 1;
            event.target.setVolume(vol * 100);
            event.target.setPlaybackRate(playbackRate);
            const dur = event.target.getDuration();
            if (dur && !isNaN(dur)) setSyncDuration(dur);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const apiTime = syncYtPlayerRef.current?.getCurrentTime() || 0;
              workspaceClock.updateAnchor(apiTime, true);
              setIsSyncPlaying(true);
              
              if (syncYtPlayerRef.current) {
                const dur = syncYtPlayerRef.current.getDuration();
                if (dur && !isNaN(dur)) setSyncDuration(dur);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
              setIsSyncPlaying(false);
              workspaceClock.pause();
            }
          },
          onError: (event) => {
            console.warn("YouTube Embed Error Code:", event.data, "- Falling back to standard audio preview");
            if (syncYtPlayerRef.current && typeof syncYtPlayerRef.current.destroy === 'function') {
                try { syncYtPlayerRef.current.destroy(); } catch (e) {}
            }
            syncYtPlayerRef.current = null;
            setYtReady(false);
            setActiveSyncSource('preview');
          }
        }
      });
    };

    initSyncYT();

    return () => {
      if (syncYtPlayerRef.current && typeof syncYtPlayerRef.current.destroy === 'function') {
        try { syncYtPlayerRef.current.destroy(); } catch (e) {}
      }
      syncYtPlayerRef.current = null;
      setYtReady(false);
    };
  }, [syncYtVideoId]);

  const handleAudioLoaded = (e) => {
    if (!syncYtVideoId && e.target.readyState > 0) {
      setSyncDuration(e.target.duration || 0);
    }
  };

  useEffect(() => {
    const handleWorkspaceTime = (e) => {
      const time = e.detail;
      if (progressSliderRef.current) {
         progressSliderRef.current.value = time;
         const max = parseFloat(progressSliderRef.current.max) || 1;
         progressSliderRef.current.style.setProperty('--progress', `${(time / max) * 100}%`);
      }
      if (preciseTimeRef.current) preciseTimeRef.current.innerText = formatPreciseTime(time);

      if (containerRef.current) {
        const adlibNodes = containerRef.current.querySelectorAll('.workspace-adlib-line');
        for (let i = 0; i < adlibNodes.length; i++) {
          const node = adlibNodes[i];
          const start = parseFloat(node.dataset.start);
          const end = parseFloat(node.dataset.end);
          if (!isNaN(start)) {
            if (time >= start && time <= end) {
              if (!node.classList.contains('adlib-playing')) node.classList.add('adlib-playing');
            } else {
              if (node.classList.contains('adlib-playing')) node.classList.remove('adlib-playing');
            }
          }
        }
      }
    };
    window.addEventListener('workspaceTimeUpdate', handleWorkspaceTime);
    return () => window.removeEventListener('workspaceTimeUpdate', handleWorkspaceTime);
  }, []);

  const localHandleSplitAdlibs = async (lineIndex) => {
    const data = [...syncData];
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
      handleSplitAdlibs(lineIndex, data);
    }
  };

  const renderWorkspaceLine = (line, isMain) => {
    const pronString = line.pronunciation;
    const segments = line.segments || [{ text: line.text }];
    const isRTL = isRTLLanguage(line.text);
    
    const pronStyle = {
      fontSize: '0.55em', color: '#ffffff', opacity: 0.85, textShadow: 'none',
      fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px',
      textAlign: 'left', marginTop: '4px', display: 'inline-block'
    };

    let parsedChunks = null;
    let fullTrans = null;

    if (typeof pronString === 'string') {
      const cleanPron = pronString.trim();
      if (cleanPron.startsWith('{')) {
        try {
          const parsed = JSON.parse(cleanPron);
          parsedChunks = parsed.chunks;
          fullTrans = parsed.full;
        } catch(e) {}
      } else if (cleanPron.startsWith('[')) {
        try { parsedChunks = JSON.parse(cleanPron); } catch(e) {}
      }
    }

    const chars = [];
    let gIdx = 0;
    let cpIdx = 0; 
    
    segments.forEach(seg => {
      const segChars = getGraphemes(seg.text);
      segChars.forEach(char => {
        const cpLen = Array.from(char).length; 
        chars.push({ char, seg, globalIndex: gIdx++, cpStart: cpIdx, cpEnd: cpIdx + cpLen });
        cpIdx += cpLen;
      });
    });

    const renderColoredChar = (c, cIdx) => {
      const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(c.char);
      let activeColor = '#ffffff';
      let isGradient = false;
      let gradientStyle = '';

      if (!isPunct && c.seg) {
        let targetArtists = c.seg.artists;
        if (!targetArtists && line.singer) {
          targetArtists = line.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim());
        }
        if (targetArtists && targetArtists.length > 0) {
          if (targetArtists.length > 1) {
            isGradient = true;
            const c1 = masterPalette[targetArtists[0]] || '#ffffff';
            const c2 = masterPalette[targetArtists[1]] || '#ffffff';
            gradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
          } else {
            activeColor = masterPalette[targetArtists[0]] || '#ffffff';
          }
        } else {
          activeColor = c.seg.color || '#ffffff';
          isGradient = c.seg.isGradient || false;
          gradientStyle = c.seg.gradient || '';
        }
      }

      const style = isGradient ? { backgroundImage: gradientStyle, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: activeColor };
      
      if (isPunct && c.char.trim() !== '') {
        style.color = '#fbbf24';
        style.WebkitTextFillColor = '#fbbf24';
        style.textShadow = '0 0 10px rgba(251, 191, 36, 0.6)';
      }

      if (isMain && line.isSplit) {
        const isAdlibChar = line.adlibs?.some(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd);
        if (isAdlibChar) {
          style.opacity = 0.2;
          style.textDecoration = 'line-through';
        }
      }

      return <span key={cIdx} style={style}>{c.char}</span>;
    };

    const renderedChars = chars.map((c, cIdx) => renderColoredChar(c, cIdx));

    let fullTransText = '';
    if (fullTrans) {
      fullTransText = normalizeTrans(fullTrans);
    } else if (parsedChunks) {
      fullTransText = parsedChunks.map(c => normalizeTrans(c.trans || (isRTL ? c.text : ''))).join(' ').trim();
    } else if (pronString && !pronString.startsWith('{') && !pronString.startsWith('[')) {
      fullTransText = normalizeTrans(pronString);
    }

    if (!isMain || isRTL) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', verticalAlign: 'bottom' }}>
            <span className="sync-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', display: 'inline-block' }} dir={isRTL ? "rtl" : "ltr"}>
              {renderedChars}
            </span>
            {fullTransText ? (
              <span className="pronunciation-text" style={pronStyle} dir="ltr">
                {fullTransText}
              </span>
            ) : null}
          </span>
        </div>
      );
    }

    let activeParsedChunks = parsedChunks;
    if (!activeParsedChunks) {
      activeParsedChunks = [{ type: 'main', trans: '', text: line.text }];
    }

    let alignedChunks = [];
    let pChunkIndex = 0;
    let currentPChunk = activeParsedChunks[0];
    let currentPChunkConsumed = 0;

    let i = 0;
    while (i < chars.length) {
      if (!currentPChunk) {
        alignedChunks.push({ type: 'main', chars: [chars[i]], text: chars[i].char, trans: '' });
        i++;
        continue;
      }

      let chunkChars = [];
      const targetLen = Array.from(currentPChunk.text || '').length;

      while (currentPChunkConsumed < targetLen && i < chars.length) {
        chunkChars.push(chars[i]);
        currentPChunkConsumed += Array.from(chars[i].char).length;
        i++;
      }
      
      if (chunkChars.length > 0) {
        alignedChunks.push({
          type: currentPChunk.type,
          trans: currentPChunk.trans,
          chars: chunkChars,
          isMain: true
        });
      }

      if (currentPChunkConsumed >= targetLen) {
        pChunkIndex++;
        currentPChunk = activeParsedChunks[pChunkIndex];
        currentPChunkConsumed = 0;
      }
    }

    const renderedChunksJSX = alignedChunks.map((chunk, chunkIdx) => {
      const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex));

      if (chunk.type === 'foreign' && chunk.trans) {
        const cleanTrans = normalizeTrans(chunk.trans);
        return (
          <span key={chunkIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'bottom', margin: '0 2px' }}>
            <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{renderedText}</span>
            <span className="pronunciation-text" style={pronStyle} dir="ltr">{cleanTrans}</span>
          </span>
        );
      } else {
        return (
          <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'bottom', display: 'inline-block' }}>
            {renderedText}
          </span>
        );
      }
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
        <span className="sync-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', display: 'inline-flex', alignItems: 'baseline', textAlign: 'left' }} dir="ltr">
          {renderedChunksJSX}
        </span>
      </div>
    );
  };

  return (
    <div className="sync-mode-container" style={{
        '--workspace-accent': accentColor,
        '--workspace-accent-glow': `color-mix(in srgb, ${accentColor} 25%, transparent)`,
        '--player-accent': accentColor
      }}>
      
      <div 
         id="sync-yt-target-container" 
         style={{ display: activeSyncSource === 'youtube' ? 'block' : 'none', width: '1px', height: '1px', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      ></div>

      <div className="sync-top-toolbar glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', marginBottom: '-4px' }}>
         <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
                onClick={toggleWorkspaceMode} 
                className="edit-links-btn"
               style={{ background: isShowingAutoSync ? 'rgba(29, 185, 84, 0.2)' : 'rgba(255, 255, 255, 0.1)', borderColor: isShowingAutoSync ? '#1DB954' : 'rgba(255, 255, 255, 0.2)', color: isShowingAutoSync ? '#1DB954' : 'white', margin: 0 }}
            >
              {isShowingAutoSync ? '  Auto Sync Mode' : '  Manual Sync Mode'}
            </button>
            {!isShowingAutoSync && selectedSong?.autoSyncData?.length > 0 && (
              <button 
                  onClick={handleMapAutoSync} 
                  className="edit-links-btn"
                 style={{ background: 'rgba(251, 191, 36, 0.2)', borderColor: '#fbbf24', color: '#fbbf24', margin: 0 }}
                title="Map Auto-Sync timings to these manual lyrics"
              >
                  Map Timings from Auto
              </button>
            )}
         </div>

         <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {(() => {
                  const isMultiple = availableSources && availableSources.length > 1;
                  const cycleSource = () => {
                      if (isMultiple) {
                          const currentIndex = availableSources.indexOf(activeSyncSource);
                          const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
                          const nextIndex = (effectiveIndex + 1) % availableSources.length;
                          
                          const upcomingSource = availableSources[nextIndex];
                          if (upcomingSource === 'deezer' && !Boolean(localStorage.getItem('appSettings') ? JSON.parse(localStorage.getItem('appSettings')).deezerArl : false)) {
                             if (setNotification) {
                               setNotification({ show: true, message: 'Deezer ARL required. Falling back to next source.', progress: 100 });
                               setTimeout(() => setNotification({ show: false }), 3500);
                             }
                             const fallbackIndex = (nextIndex + 1) % availableSources.length;
                             setManualSource(availableSources[fallbackIndex]);
                          } else {
                             setManualSource(upcomingSource);
                          }
                      }
                  };
                  
                  const cursorStyle = isMultiple ? { cursor: 'pointer', userSelect: 'none', transition: 'transform 0.2s' } : {};
                  const title = isMultiple ? "Click to switch audio source" : "";
                  
                  const Wrapper = ({ children }) => (
                    <span 
                       onClick={cycleSource} 
                       style={{...cursorStyle, display: 'inline-block'}} 
                       title={title}
                      onMouseEnter={(e) => { if (isMultiple) e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseLeave={(e) => { if (isMultiple) e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {children}
                    </span>
                  );

                  if (activeSyncSource === 'youtube') return <Wrapper><span className="source-badge" style={{background: '#FF0000', color: 'white', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold'}}>YT Music</span></Wrapper>;
                  if (activeSyncSource === 'local') return <Wrapper><span className="source-badge" style={{background: '#4ade80', color: 'black', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold'}}>LOCAL</span></Wrapper>;
                  if (activeSyncSource === 'deezer') return <Wrapper><span className="source-badge" style={{background: '#9200FF', color: 'white', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold'}}>DEEZER</span></Wrapper>;
                  
                  return null;
              })()}
            </div>
            <span>{isShowingAutoSync ? 'Only Ad-libs Editable' : 'Full Edit Enabled'}</span>
         </div>
      </div>

      <div className="sync-player glass-panel">
        <button className="sync-play-btn" onClick={toggleSyncPlay}>
          {isSyncPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          )}
        </button>
        <span className="precise-time" ref={preciseTimeRef}>00:00.000</span>
        
        <input 
            type="range" className="custom-slider sync-slider"
            min="0" max={syncDuration || 1} step="0.001"
            defaultValue="0"
          ref={progressSliderRef}
          onChange={handleSyncSeek}
          style={{ '--progress': '0%' }}
          />
        <span className="precise-time">{formatPreciseTime(syncDuration)}</span>
      </div>

      <div className="sync-speed-deck glass-panel">
        <div className="speed-label-container">
          <span>Speed: <strong>{playbackRate.toFixed(2)}x</strong></span>
          {playbackRate !== 1.0 && (
            <button className="speed-reset-btn" onClick={() => handleSpeedChange({ target: { value: 1.0 }})}>Reset</button>
          )}
        </div>
        <input 
            type="range" className="custom-slider speed-slider"
            min="0.5" max="2.0" step="0.05"
            value={playbackRate} onChange={handleSpeedChange}
            style={{ '--progress': `${((playbackRate - 0.5) / 1.5) * 100}%` }}
          />
        <div className="speed-ticks">
          <span>0.5x</span><span>1.0x</span><span>1.5x</span><span>2.0x</span>
        </div>
      </div>

      <div className="sync-lines-container" ref={containerRef}>
        {workspaceLines.map((item, i) => {
          const isMain = item.type === 'main';
          const line = item.ref;
          const isActive = i === activeSyncIndex;
          const isRecording = line.start !== null && line.end === null;
          const isSynced = line.start !== null && line.end !== null;
          
          const hasParentheses = isMain && /\([^)]+\)/.test(line.text);
          let boundedEnd = Number.MAX_VALUE;
          if (!isMain) {
            boundedEnd = line.end !== null ? line.end : (item.parentRef?.end !== null ? item.parentRef.end : Number.MAX_VALUE);
          }

          return (
            <div 
                key={i}
                ref={isActive ? activeLineRef : null}
              className={`sync-line ${isActive ? 'active' : ''} ${isRecording ? 'recording' : ''} ${isSynced ? 'synced' : ''} ${!isMain ? 'nested-adlib workspace-adlib-line' : ''}`}
              data-start={!isMain ? (line.start !== null ? line.start : 'NaN') : 'NaN'}
              data-end={!isMain ? boundedEnd : 'NaN'}
              onClick={() => {
                setActiveSyncIndex(i);
                
                if (!isMain) {
                  const pStart = item.parentRef.start;
                  if (pStart !== null) {
                    const pEnd = item.parentRef.end !== null ? item.parentRef.end : (pStart + 5);
                    setLoopRange({ start: pStart, end: pEnd });
                    setConstrainedEnd(null);
                    
                    workspaceClock.seek(pStart);
                    if (syncYtVideoId && syncYtPlayerRef.current) {
                      try {
                        syncYtPlayerRef.current.seekTo(pStart, true);
                      } catch(e){}
                    } else if (syncAudioRef.current) {
                      syncAudioRef.current.currentTime = pStart;
                    }
                    if (!isSyncPlaying) toggleSyncPlay();
                  }
                } else if (line.start !== null) {
                  setLoopRange(null);
                  setConstrainedEnd(null);
                  workspaceClock.seek(line.start);
                  if (syncYtVideoId && syncYtPlayerRef.current) {
                    try {
                      syncYtPlayerRef.current.seekTo(line.start, true);
                    } catch(e){}
                  } else if (syncAudioRef.current) {
                    syncAudioRef.current.currentTime = line.start;
                  }
                }
              }}
            >
              <div className="sync-text-wrapper" style={{ flex: 1, minWidth: 0, paddingRight: '16px', display: 'flex', alignItems: 'center' }}>
                {renderWorkspaceLine(line, isMain)}
                
                {isMain && hasParentheses && (
                  <button 
                      className={`action-split-btn ${line.isSplit ? 'undo' : ''}`}
                      onClick={(e) => {
                      e.stopPropagation();
                      if (line.isSplit) handleUndoSplit(item.lineIndex);
                      else localHandleSplitAdlibs(item.lineIndex);
                    }}
                  >
                    {line.isSplit ? 'Undo Split' : 'Split Adlibs'}
                  </button>
                )}
              </div>
              
              <span className="sync-time">{formatPreciseTime(line.start)} - {formatPreciseTime(line.end)}</span>
            </div>
          );
        })}
      </div>

      <audio 
          ref={syncAudioRef}
        src={syncAudioSrc || undefined}
        onLoadedMetadata={handleAudioLoaded}
        onDurationChange={handleAudioLoaded}
        onEnded={() => setIsSyncPlaying(false)}
        onPlay={() => {
          setIsSyncPlaying(true);
          window.dispatchEvent(new CustomEvent('pauseGlobalPlayer'));
        }}
        onPause={() => setIsSyncPlaying(false)}
      />
    </div>
  );
};
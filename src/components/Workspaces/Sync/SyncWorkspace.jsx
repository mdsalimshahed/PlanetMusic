/* --- src/components/Workspaces/Sync/SyncWorkspace.jsx --- */
import React, { useState, useEffect, useRef } from 'react';
import { formatPreciseTime } from '../../../utils/songHelpers';
import { workspaceClock } from '../../../utils/clockEngine';
import { getGraphemes, normalizeTrans, isCJ, isRTLLanguage } from '../../LyricsRenderer/textUtils';
import { alignChunksWithTransliteration, renderFormattedTranslation } from '../../LyricsRenderer/Formatters';
import './SyncWorkspace.css';

export const SyncWorkspace = ({
  syncData, activeSyncIndex, setActiveSyncIndex, syncDuration, setSyncDuration,
  isSyncPlaying, toggleSyncPlay, handleSyncSeek, playbackRate, handleSpeedChange,
  syncAudioRef, syncAudioSrc, syncYtVideoId, syncYtPlayerRef, activeSyncSource, setActiveSyncSource, setIsSyncPlaying, activeLineRef, 
  workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange, masterPalette,
  selectedSong, isShowingAutoSync, toggleWorkspaceMode, handleMapAutoSync,
  availableSources, setManualSource, setNotification, handleShiftTimings
}) => {
  const progressSliderRef = useRef(null);
  const preciseTimeRef = useRef(null);
  const containerRef = useRef(null);
  const cachedAdlibNodesRef = useRef([]);

  const [accentColor, setAccentColor] = useState('var(--accent)');
  const [ytReady, setYtReady] = useState(false);

  const [lyricScale, setLyricScale] = useState(0.5);
  const cycleScale = () => setLyricScale(s => s === 1 ? 0.75 : s === 0.75 ? 0.5 : 1);
  const currentFontSize = Math.max(12, 34 * lyricScale);

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
    const timer = setTimeout(() => {
      if (containerRef.current) {
        cachedAdlibNodesRef.current = Array.from(containerRef.current.querySelectorAll('.workspace-adlib-line'));
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [workspaceLines]);

  useEffect(() => {
    const handleWorkspaceTime = (e) => {
      const time = e.detail;
      if (progressSliderRef.current) {
         progressSliderRef.current.value = time;
         const max = parseFloat(progressSliderRef.current.max) || 1;
         progressSliderRef.current.style.setProperty('--progress', `${(time / max) * 100}%`);
      }
      if (preciseTimeRef.current) preciseTimeRef.current.innerText = formatPreciseTime(time);
      
      const adlibNodes = cachedAdlibNodesRef.current;
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
    };
    window.addEventListener('workspaceTimeUpdate', handleWorkspaceTime);
    return () => window.removeEventListener('workspaceTimeUpdate', handleWorkspaceTime);
  }, []);

  const renderSyncNode = (node, isMain) => {
    if (!node) return null;

    const isRTL = isRTLLanguage(node.text || '');

    const activeSpacingText = node.spacingText || '';
    const useSpacingText = Boolean(activeSpacingText && activeSpacingText.trim());
    const activeDisplayText = useSpacingText ? activeSpacingText : (node.text || '');
    
    let chars = [];
    let globalCpIdx = 0;
    let gIdx = 0;
    const segments = node.segments || [{ text: node.text }];

    if (useSpacingText) {
         const spacedGraphemes = getGraphemes(activeDisplayText);
         const origGraphemes = getGraphemes(node.text || '');
         let origPointer = 0;
         let segmentPointer = 0;
         let charPointerInSegment = 0;
         let currentCpStart = 0;
         
         spacedGraphemes.forEach(char => {
             let currentSeg = segments[segmentPointer] || segments[segments.length - 1] || {};
             let isOrigChar = false;
             
             if (origPointer < origGraphemes.length && char === origGraphemes[origPointer]) {
                 isOrigChar = true;
             } else if (/\s/.test(char) && origPointer < origGraphemes.length && !/\s/.test(origGraphemes[origPointer])) {
                 isOrigChar = false;
             } else {
                 isOrigChar = !/\s/.test(char);
             }

             const cpLen = Array.from(char).length;
             chars.push({ char, seg: currentSeg, globalIndex: gIdx++, cpStart: currentCpStart, cpEnd: currentCpStart + cpLen });

             if (isOrigChar) {
                 const origLen = Array.from(origGraphemes[origPointer] || char).length;
                 currentCpStart += origLen;
                 origPointer++;
                 charPointerInSegment += getGraphemes(char).length;
                 if (currentSeg && charPointerInSegment >= getGraphemes(currentSeg.text || '').length) {
                     segmentPointer++;
                     charPointerInSegment = 0;
                 }
             }
         });
    } else {
         segments.forEach(seg => {
             const segChars = getGraphemes(seg.text);
             segChars.forEach(char => {
                 const cpLen = Array.from(char).length;
                 chars.push({ char, seg, globalIndex: gIdx++, cpStart: globalCpIdx, cpEnd: globalCpIdx + cpLen });
                 globalCpIdx += cpLen;
             });
         });
    }

    let displayChars = chars;
    if (isMain && node.isSplit && node.adlibs && node.adlibs.length > 0) {
         displayChars = chars.filter(c => !node.adlibs.some(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd));
    }

    let parsedChunks = null;
    let fullTrans = null;
    let pronString = node.pronunciation || '';
    
    if (typeof pronString === 'string') {
         if (pronString.startsWith('{')) {
              try { const p = JSON.parse(pronString); parsedChunks = p.chunks; fullTrans = p.full; } catch(e){}
         } else if (pronString.startsWith('[')) {
              try { parsedChunks = JSON.parse(pronString); } catch(e){}
         } else {
              fullTrans = pronString;
         }
    }

    const basePronStyle = {
         fontSize: 'var(--dyn-translit-font-size, 0.55em)',
         fontWeight: '800',
         textTransform: 'uppercase',
         letterSpacing: '0.5px',
         textAlign: 'center',
         marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
         display: 'inline-block',
         whiteSpace: 'nowrap',
         WebkitTextFillColor: 'currentcolor',
         backgroundImage: 'none',
         color: 'rgba(255,255,255,0.7)',
         textShadow: 'none'
    };

    const getSegmentStyle = (seg) => {
         let targetArtists = seg?.artists;
         let isGrad = false;
         let gradStyle = '';

         if (targetArtists && targetArtists.length > 1) {
             isGrad = true;
             const gradientColors = targetArtists.map(artist => masterPalette[artist] || '#ffffff').join(', ');
             gradStyle = `linear-gradient(90deg, ${gradientColors})`;
         } else if (seg?.isGradient && seg?.gradient) {
             isGrad = true;
             gradStyle = seg.gradient;
         }

         if (isGrad) {
             return {
                 backgroundImage: gradStyle,
                 WebkitBackgroundClip: 'text',
                 WebkitTextFillColor: 'transparent',
                 WebkitBoxDecorationBreak: 'clone',
                 display: 'inline',
                 paddingBottom: '1.2em',
                 paddingTop: '0.2em',
                 filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`
             };
         }
         return {
             display: 'inline',
             paddingBottom: '1.2em',
             paddingTop: '0.2em'
         };
    };

    const renderColoredChar = (c, globalIdx) => {
         const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(c.char);
         let style = { transition: 'none', fontWeight: 'bold' };
         
         if (isPunct && c.char.trim() !== '') {
             style = {
                 ...style,
                 color: '#fbbf24',
                 WebkitTextFillColor: '#fbbf24',
                 textShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
                 backgroundImage: 'none',
                 filter: 'none'
             };
         } else {
             let targetArtists = c.seg?.artists;
             let isGrad = (targetArtists && targetArtists.length > 1) || c.seg?.isGradient;
             
             if (!isGrad) {
                 let activeColor = '#ffffff';
                 if (targetArtists && targetArtists.length === 1) {
                     activeColor = masterPalette[targetArtists[0]] || '#ffffff';
                 } else if (c.seg?.color) {
                     activeColor = c.seg.color;
                 }
                 style.color = activeColor;
                 style.WebkitTextFillColor = activeColor;
                 style.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 20px ${activeColor}80`;
             }
         }
         return <span key={globalIdx} style={style}>{c.char}</span>;
    };

    const alignedJSX_Gradient = alignChunksWithTransliteration(
         displayChars, parsedChunks, fullTrans, renderColoredChar, basePronStyle, isRTL, false, useSpacingText, getSegmentStyle, false
    );
    const alignedJSX_Solid = alignChunksWithTransliteration(
         displayChars, parsedChunks, fullTrans, renderColoredChar, basePronStyle, isRTL, false, useSpacingText, getSegmentStyle, true
    );

    let shouldRenderBlockPron = false;
    let displayPronString = null;
    const isCJKLine = displayChars.some(c => isCJ(c.char));
    
    if (isRTL) {
         if (fullTrans) {
              displayPronString = normalizeTrans(fullTrans);
              shouldRenderBlockPron = true;
         } else if (parsedChunks) {
              displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).filter(Boolean).join(' ');
              shouldRenderBlockPron = true;
         }
    } else if (pronString && !pronString.startsWith('{') && !pronString.startsWith('[')) {
         if (!isCJKLine && !parsedChunks) {
             const cleanOrig = node.text.toLowerCase().replace(/[\W_]+/g, '');
             const cleanPron = pronString.toLowerCase().replace(/[\W_]+/g, '');
             if (cleanOrig !== cleanPron) {
                 displayPronString = normalizeTrans(pronString);
                 shouldRenderBlockPron = true;
             }
         }
    }

    const blockPronStyle = {
         ...basePronStyle,
         marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
         display: 'block',
         textAlign: 'left',
         wordSpacing: '4px',
         lineHeight: '1.4'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%', maxWidth: '100%', boxSizing: 'border-box', lineHeight: 1.2, fontSize: 'var(--workspace-lyric-size, 16px)' }}>
           <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'normal', display: 'inline-block', position: 'relative', textAlign: 'left', direction: isRTL ? 'rtl' : 'ltr', width: '100%', maxWidth: '100%', textWrap: 'normal', boxSizing: 'border-box' }}>
               <span className="core-chunks" style={{ position: 'relative', display: 'inline-block', margin: '0', width: 'auto', maxWidth: '100%', textAlign: 'left', boxSizing: 'border-box' }}>
                   
                   <span className="dual-layer-container" style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                     <span className="main-lyrics-layer layer-gradient" style={{ display: 'inline', width: '100%', textAlign: 'left', boxSizing: 'border-box' }} dir="auto" aria-hidden="true">
                         {alignedJSX_Gradient}
                     </span>
                     <span className="main-lyrics-layer layer-solid" style={{ position: 'absolute', inset: 0, display: 'inline', width: '100%', textAlign: 'left', boxSizing: 'border-box', pointerEvents: 'none' }} dir="auto">
                         {alignedJSX_Solid}
                     </span>
                   </span>

               </span>
           </span>
           
           {shouldRenderBlockPron && displayPronString && (
               <span className="pronunciation-text" style={blockPronStyle} dir="ltr">
                   {renderFormattedTranslation(displayPronString, false)}
               </span>
           )}
        </div>
    );
  };

  return (
    <div className="sync-mode-container" style={{
        '--workspace-accent': accentColor,
        '--workspace-accent-glow': `color-mix(in srgb, ${accentColor} 25%, transparent)`,
        '--player-accent': accentColor,
        '--workspace-lyric-size': `${currentFontSize}px`
      }}>
      
      <div 
          id="sync-yt-target-container" 
          style={{ display: activeSyncSource === 'youtube' ? 'block' : 'none', width: '1px', height: '1px', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      ></div>

      <div className="sync-top-toolbar glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', marginBottom: '-4px' }}>
         <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
                onClick={toggleWorkspaceMode} 
                className="edit-links-btn"
                style={{ background: isShowingAutoSync ? 'rgba(29, 185, 84, 0.2)' : 'rgba(255, 255, 255, 0.1)', borderColor: isShowingAutoSync ? '#1DB954' : 'rgba(255, 255, 255, 0.2)', color: isShowingAutoSync ? '#1DB954' : 'white', margin: 0 }}
            >
              {isShowingAutoSync ? 'Auto Sync Mode' : 'Manual Sync Mode'}
            </button>
            <button className="edit-links-btn" onClick={cycleScale} style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)', color: 'white', margin: 0 }}>
              Text Size: {lyricScale * 100}%
            </button>
            {!isShowingAutoSync && selectedSong?.autoSyncData?.length > 0 && (
              <button 
                  onClick={handleMapAutoSync} 
                  className="edit-links-btn"
                  style={{ background: 'rgba(251, 191, 36, 0.2)', borderColor: '#fbbf24', color: '#fbbf24', margin: 0 }}
                  title="Map Timings from Auto to Manual Lyrics"
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

      <div className="sync-controls-row">
        <div className="sync-speed-deck glass-panel" style={{ flex: 1 }}>
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
        
        <div className="sync-offset-deck glass-panel" style={{ flex: 1 }}>
           <div className="speed-label-container">
             <span>Global Offset (Shift Timings)</span>
           </div>
           <div className="offset-buttons">
              <button className="offset-btn" onClick={() => handleShiftTimings(-1)} title="Shift all timings backward by 1 second">-1.0s</button>
              <button className="offset-btn" onClick={() => handleShiftTimings(-0.1)} title="Shift all timings backward by 0.1 seconds">-0.1s</button>
              <button className="offset-btn" onClick={() => handleShiftTimings(0.1)} title="Shift all timings forward by 0.1 seconds">+0.1s</button>
              <button className="offset-btn" onClick={() => handleShiftTimings(1)} title="Shift all timings forward by 1 second">+1.0s</button>
           </div>
        </div>
      </div>

      <div className="sync-lines-container" ref={containerRef}>
        {workspaceLines.map((item, i) => {
          const isMain = item.type === 'main';
          const line = item.ref;
          const isActive = i === activeSyncIndex;
          const isRecording = line.start !== null && line.end === null;
          const isSynced = line.start !== null && line.end !== null;
          
          const hasParentheses = isMain && /[(\uFF08][^)\uFF09]+[)\uFF09]/.test(line.text);

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
                    
                    if (line.start === null) {
                      if (isSyncPlaying) toggleSyncPlay();
                    } else {
                      if (!isSyncPlaying) toggleSyncPlay();
                    }
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
                   
                {renderSyncNode(line, isMain)}
                   
                {isMain && hasParentheses && (
                  <button 
                      className={`action-split-btn ${line.isSplit ? 'undo' : ''}`}
                      onClick={(e) => {
                      e.stopPropagation();
                      if (line.isSplit) handleUndoSplit(item.lineIndex);
                      else handleSplitAdlibs(item.lineIndex);
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
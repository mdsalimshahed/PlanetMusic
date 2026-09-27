/* --- src/Studio/components/Workspaces/Sync/SyncWorkspace.jsx --- */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatPreciseTime } from '../../../utils/songHelpers';
import { workspaceClock } from '../../../utils/clockEngine';
import './SyncWorkspace.css';

const isRTLLanguage = (text) => /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text || '');
const getGraphemes = (str) => {
  if (!str) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), s => s.segment);
  }
  return str.match(/[\u0900-\u097F][\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963]*|./gu) || Array.from(str);
};

export const SyncWorkspace = ({
  syncData, activeSyncIndex, setActiveSyncIndex, syncDuration, setSyncDuration,
  isSyncPlaying, toggleSyncPlay, handleSyncSeek, playbackRate, handleSpeedChange,
  syncAudioRef, syncAudioSrc, syncYtVideoId, syncYtPlayerRef, activeSyncSource, setActiveSyncSource, setIsSyncPlaying, activeLineRef, 
  workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange, masterPalette,
  selectedSong, isShowingAutoSync, toggleWorkspaceMode, handleMapAutoSync,
  handleShiftTimings
}) => {
  const progressSliderRef = useRef(null);
  const preciseTimeRef = useRef(null);
  const containerRef = useRef(null);
  const cachedAdlibNodesRef = useRef([]);
  const [accentColor, setAccentColor] = useState('var(--accent)');
  const [ytReady, setYtReady] = useState(false);
  const [syncVolume, setSyncVolume] = useState(() => {
    const savedVolume = localStorage.getItem('playerVolume');
    const parsedVolume = Number(savedVolume);
    return savedVolume !== null && Number.isFinite(parsedVolume) && parsedVolume > 0 ? parsedVolume : 1;
  });
  const [syncMuted, setSyncMuted] = useState(() => {
    const savedMuted = localStorage.getItem('playerMuted');
    const savedVolume = localStorage.getItem('playerVolume');
    return savedMuted !== null ? savedMuted === 'true' : savedVolume !== null && Number(savedVolume) === 0;
  });
  const [isAdjustingVolume, setIsAdjustingVolume] = useState(false);
  const [syncControlsTarget, setSyncControlsTarget] = useState(null);
  const [lyricScale, setLyricScale] = useState(0.5);
  const cycleScale = () => setLyricScale(s => s === 1 ? 0.75 : s === 0.75 ? 0.5 : 1);
  const currentFontSize = Math.max(12, 34 * lyricScale);

  useEffect(() => {
    setSyncControlsTarget(document.querySelector('.sync-workspace-controls-slot'));
  }, []);

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

  useEffect(() => {
    const applyVolume = () => {
      const effectiveVolume = syncMuted ? 0 : syncVolume;
      if (syncAudioRef.current) syncAudioRef.current.volume = effectiveVolume;
      if (ytReady && syncYtPlayerRef.current) {
        try { syncYtPlayerRef.current.setVolume(effectiveVolume * 100); } catch {}
      }
    };
    applyVolume();
  }, [syncVolume, syncMuted, syncAudioRef, syncYtPlayerRef, syncYtVideoId, ytReady, syncAudioSrc]);

  useEffect(() => {
    const handleSharedVolumeChange = (event) => {
      const nextVolume = Number(event.detail?.volume);
      if (Number.isFinite(nextVolume) && nextVolume > 0) setSyncVolume(nextVolume);
      if (typeof event.detail?.isMuted === 'boolean') setSyncMuted(event.detail.isMuted);
    };
    window.addEventListener('playerVolumeChange', handleSharedVolumeChange);
    return () => window.removeEventListener('playerVolumeChange', handleSharedVolumeChange);
  }, []);

  const setSharedVolume = (nextVolume) => {
    nextVolume = Math.max(0, Math.min(1, nextVolume));
    const nextMuted = nextVolume === 0;
    if (!nextMuted) {
      setSyncVolume(nextVolume);
      localStorage.setItem('playerVolume', String(nextVolume));
    }
    setSyncMuted(nextMuted);
    localStorage.setItem('playerMuted', String(nextMuted));
    window.dispatchEvent(new CustomEvent('playerVolumeChange', {
      detail: { volume: nextMuted ? syncVolume : nextVolume, isMuted: nextMuted }
    }));
  };

  const handleVolumeKnobPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const angle = Math.atan2(
      event.clientY - (bounds.top + bounds.height / 2),
      event.clientX - (bounds.left + bounds.width / 2)
    ) * 180 / Math.PI;
    setSharedVolume((Math.max(-135, Math.min(135, angle)) + 135) / 270);
  };

  const handleVolumeKnobKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    const currentVolume = syncMuted ? 0 : syncVolume;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      setIsAdjustingVolume(true);
      setSharedVolume(currentVolume + 0.01);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setIsAdjustingVolume(true);
      setSharedVolume(currentVolume - 0.01);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setIsAdjustingVolume(true);
      setSharedVolume(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setIsAdjustingVolume(true);
      setSharedVolume(1);
    }
  };

  const toggleSyncMute = (event) => {
    event.stopPropagation();
    const nextMuted = !syncMuted;
    setSyncMuted(nextMuted);
    localStorage.setItem('playerMuted', String(nextMuted));
    window.dispatchEvent(new CustomEvent('playerVolumeChange', {
      detail: { volume: syncVolume, isMuted: nextMuted }
    }));
  };

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
    const hasSpacingText = Boolean(node.spacingText && node.spacingText.trim());
    
    let segmentsToRender = node.segments && node.segments.length > 0 
       ? node.segments.map(s => ({...s})) 
       : [{ ...node }];

    if (isMain && node.isSplit && node.adlibs) {
      segmentsToRender = segmentsToRender.map(seg => {
        let segText = seg.text;
        node.adlibs.forEach(a => {
          segText = segText.replace(a.text, '');
        });
        segText = segText.replace(/\s{2,}/g, ' ');
        return { ...seg, text: segText };
      }).filter(seg => seg.text.trim().length > 0);
    }

    let pronText = '';
    if (node.pronunciation) {
      if (typeof node.pronunciation === 'string' && (node.pronunciation.startsWith('{') || node.pronunciation.startsWith('['))) {
        try {
          const parsed = JSON.parse(node.pronunciation);
          if (parsed.full) {
            pronText = parsed.full;
          } else if (parsed.chunks) {
            pronText = parsed.chunks.map(c => c.trans || c.text).join(' ');
          } else if (Array.isArray(parsed)) {
            pronText = parsed.map(c => c.trans || c.text).join(' ');
          }
        } catch (e) {
          pronText = node.pronunciation;
        }
      } else {
        pronText = node.pronunciation;
      }
    }
    
    if (!isMain && pronText) { 
       pronText = pronText.replace(/[()[\]{}]/g, '').trim();
    }

    const renderColoredText = (item, overrideText = null) => {
      let artists = item.artists || [];
      if (artists.length === 0 && item.singer) {
        artists = item.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(a => a.trim());
      }
      let isGradient = false;
      let gradientStyle = '';
      let activeColor = '#ffffff';
      if (artists.length > 1) {
        isGradient = true;
        const gradientColors = artists.map(artist => masterPalette[artist] || '#ffffff').join(', ');
        gradientStyle = `linear-gradient(90deg, ${gradientColors})`;
      } else if (artists.length === 1) {
        activeColor = masterPalette[artists[0]] || item.color || '#ffffff';
      } else if (item.isGradient && item.gradient) {
        isGradient = true;
        gradientStyle = item.gradient;
      } else {
        activeColor = item.color || '#ffffff';
      }
      let parentStyle = { 
         display: 'inline', 
         textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)' 
      };
      if (isGradient) {
        parentStyle.backgroundImage = gradientStyle;
        parentStyle.WebkitBackgroundClip = 'text';
        parentStyle.WebkitTextFillColor = 'transparent';
      } else {
        parentStyle.color = activeColor;
      }
      const textToRender = overrideText !== null ? overrideText : item.text;
      const chars = getGraphemes(textToRender);
      const renderedChars = chars.map((char, cIdx) => {
        const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(char);
        let childStyle = {};
        if (isPunct && char.trim() !== '') {
          childStyle = {
            color: '#fbbf24',
            WebkitTextFillColor: '#fbbf24',
            textShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
            backgroundImage: 'none'
          };
        }
        return Object.keys(childStyle).length > 0 ? (
          <span key={cIdx} style={childStyle}>{char}</span>
        ) : (
          <React.Fragment key={cIdx}>{char}</React.Fragment>
        );
      });
      return <span style={parentStyle}>{renderedChars}</span>;
    };

    let finalJSX;
    if (hasSpacingText) {
      let displayText = node.spacingText;
      if (isMain && node.isSplit && node.adlibs) {
        node.adlibs.forEach(a => {
          displayText = displayText.replace(a.text, '');
        });
        displayText = displayText.replace(/\s{2,}/g, ' ').trim();
      }
      
      const validColorSource = segmentsToRender.find(s => s.text.trim().length > 0) || node;
      finalJSX = renderColoredText(validColorSource, displayText);
    } else {
      finalJSX = segmentsToRender.map((seg, sIdx) => (
        <React.Fragment key={sIdx}>
          {renderColoredText(seg)}
        </React.Fragment>
      ));
    }

    return (
        <div className="preview-line" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <span className="primary-text" style={{
                display: 'block',
                whiteSpace: 'pre-wrap',
                wordBreak: 'normal',
                overflowWrap: 'normal',
                textAlign: 'left',
                width: '100%',
                maxWidth: '100%'
            }} dir={isRTL ? 'rtl' : 'ltr'}>
                {finalJSX}
            </span>
            {pronText && (
                <span className="pronunciation-text" style={{
                    fontSize: 'calc(var(--dyn-translit-font-size, 0.55em) * 1.6)',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textAlign: 'left',
                    marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
                    display: 'block',
                    whiteSpace: 'nowrap',
                    color: 'rgba(255,255,255,0.7)',
                    textShadow: 'none',
                    wordSpacing: '4px',
                    lineHeight: '1.4'
                }} dir="ltr">
                    {pronText}
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
      {syncControlsTarget && createPortal(
        <div className="sync-workspace-header-actions">
          <button
            onClick={toggleWorkspaceMode}
            className="edit-links-btn"
            style={{ background: isShowingAutoSync ? 'rgba(29, 185, 84, 0.2)' : 'rgba(255, 255, 255, 0.1)', borderColor: isShowingAutoSync ? '#1DB954' : 'rgba(255, 255, 255, 0.2)', color: isShowingAutoSync ? '#1DB954' : 'white', margin: 0 }}
          >
            {isShowingAutoSync ? 'Auto Sync Mode' : 'Manual Sync Mode'}
          </button>
          <button className="edit-links-btn" onClick={cycleScale} style={{ margin: 0 }}>
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
        </div>,
        syncControlsTarget
      )}
      
      <div 
           id="sync-yt-target-container" 
           style={{ display: activeSyncSource === 'youtube' ? 'block' : 'none', width: '1px', height: '1px', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      ></div>

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
        <div className="sync-volume-stack">
          <div
            className={`sync-volume-control ${isAdjustingVolume ? 'adjusting' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((syncMuted ? 0 : syncVolume) * 100)}
            title={`Volume: ${Math.round((syncMuted ? 0 : syncVolume) * 100)}%`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setIsAdjustingVolume(true);
              handleVolumeKnobPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1 || event.currentTarget.hasPointerCapture(event.pointerId)) {
                setIsAdjustingVolume(true);
                handleVolumeKnobPointer(event);
              }
            }}
            onPointerUp={() => setIsAdjustingVolume(false)}
            onPointerCancel={() => setIsAdjustingVolume(false)}
            onKeyDown={handleVolumeKnobKeyDown}
            onKeyUp={() => setIsAdjustingVolume(false)}
            onBlur={() => setIsAdjustingVolume(false)}
          >
            {Array.from({ length: 25 }, (_, index) => (
              <span
                key={index}
                className={`sync-volume-dot ${index / 24 < (syncMuted ? 0 : syncVolume) ? 'active' : ''}`}
                style={{ '--dot-angle': `${-135 + (index / 24) * 270}deg` }}
              />
            ))}
            <button
              type="button"
              className="sync-volume-mute-btn"
              onClick={toggleSyncMute}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={syncMuted ? 'Unmute' : 'Mute'}
              aria-pressed={syncMuted}
              title={syncMuted ? 'Unmute' : 'Mute'}
            >
              <span className="sync-volume-center" aria-hidden="true">
                <span className="sync-volume-icon">
                  {syncMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  )}
                </span>
                <span className="sync-volume-percent">{Math.round((syncMuted ? 0 : syncVolume) * 100)}%</span>
              </span>
            </button>
          </div>
        </div>
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
/* --- src/components/Workspaces/Lyrics/LyricsDisplay.jsx --- */
import React, { useEffect, useRef, useMemo } from 'react';
import { LyricLineWrapper } from './LyricsLineRenderer';
import { FocusedAdlibsTracker } from '../Sync/FocusedAdlibsTracker';
import { parseLyrics } from '../../../utils/songHelpers';
import { getGraphemes } from '../../LyricsRenderer/textUtils';
import './LyricsDisplay.css';

// Safely injects spaces into colored segments without overriding original tags
export const injectSpacesIntoSegments = (segments, spacedText) => {
  if (!spacedText || !segments || segments.length === 0) return segments;
  const newSegments = [];
  let spacedIdx = 0;
  const spacedChars = Array.from(spacedText);
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segChars = Array.from(seg.text || '');
    let newSegText = '';
    
    let segCharIdx = 0;
    while (segCharIdx < segChars.length && spacedIdx < spacedChars.length) {
      const sChar = spacedChars[spacedIdx];
      if (/^\s+$/.test(sChar)) {
        newSegText += sChar;
        spacedIdx++;
      } else {
        newSegText += sChar;
        spacedIdx++;
        segCharIdx++;
      }
    }
    
    while (i < segments.length - 1 && spacedIdx < spacedChars.length && /^\s+$/.test(spacedChars[spacedIdx])) {
        newSegText += spacedChars[spacedIdx];
        spacedIdx++;
    }
    
    if (i === segments.length - 1) {
        while (spacedIdx < spacedChars.length) {
            newSegText += spacedChars[spacedIdx];
            spacedIdx++;
        }
    }
    
    newSegments.push({
      ...seg,
      text: newSegText
    });
  }
  return newSegments;
};

const LyricsDisplay = ({ 
    isEditing, customData, handleDataChange, hasValidSyncData, 
    lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, masterPalette, currentTrack, 
    isPlaying, settings
}) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
  const canvasRef = useRef(null);
  const eqScalesRef = useRef(Array(40).fill(0.05));

  const isPlayingCurrentSong = Boolean(currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId);

  const editParsedLyrics = useMemo(() => {
    if (!isEditing || !customData.lyrics) return [];
    return parseLyrics(customData.lyrics, selectedSong?.artistName, masterPalette);
  }, [isEditing, customData.lyrics, selectedSong?.artistName, masterPalette]);

  const renderColoredText = (item) => {
    let artists = item.artists || [];
    if (artists.length === 0 && item.singer) {
      artists = item.singer.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    }
    
    let isGradient = false;
    let gradientStyle = '';
    let activeColor = '#ffffff';

    if (artists.length > 1) {
      isGradient = true;
      const c1 = masterPalette[artists[0]] || '#ffffff';
      const c2 = masterPalette[artists[1]] || '#ffffff';
      gradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
    } else if (artists.length === 1) {
      activeColor = masterPalette[artists[0]] || item.color || '#ffffff';
    } else if (item.isGradient && item.gradient) {
      isGradient = true;
      gradientStyle = item.gradient;
    } else {
      activeColor = item.color || '#ffffff';
    }

    const chars = getGraphemes(item.text || '');
    return chars.map((char, cIdx) => {
      const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(char);
      let style = {};

      if (isPunct && char.trim() !== '') {
        style = {
          color: '#fbbf24',
          WebkitTextFillColor: '#fbbf24',
          textShadow: '0 0 10px rgba(251, 191, 36, 0.6)'
        };
      } else if (isGradient) {
        style = {
          backgroundImage: gradientStyle,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(255,255,255,0.4))'
        };
      } else {
        style = { 
          color: activeColor,
          textShadow: `0 4px 8px rgba(0,0,0,0.9), 0 0 20px ${activeColor}80`
        };
      }

      return <span key={cIdx} style={style}>{char}</span>;
    });
  };

  const renderColoredSingerHeader = (singerString) => {
    if (!singerString) {
      const defaultSinger = selectedSong?.artistName || 'Default Artist';
      return <span style={{ color: masterPalette[defaultSinger] || '#ffffff' }}>{defaultSinger}</span>;
    }
    const artists = singerString.split(/\s*(?:,)\s*/i).filter(Boolean).map(a => a.trim());
    return artists.map((artist, aIdx) => {
      const artistColor = masterPalette[artist] || '#ffffff';
      return (
        <React.Fragment key={aIdx}>
          <span style={{ color: artistColor }}>{artist}</span>
          {aIdx < artists.length - 1 && <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 4px' }}>, </span>}
        </React.Fragment>
      );
    });
  };

  const getBorderAccentColor = (line) => {
    let artists = line.artists || [];
    if (artists.length === 0 && line.singer) {
      artists = line.singer.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    }
    if (artists.length > 0) {
      return masterPalette[artists[0]] || '#ffffff';
    }
    return line.color || masterPalette[selectedSong?.artistName] || '#ffffff';
  };

  useEffect(() => {
    if (settings?.disableAnimations || isEditing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let rafId;
    const pauseDecayFactor = 16 / Math.max((settings?.eqFadeOutTime ?? 500), 16);
    let idleFrames = 0; 
    const numBars = 40;

    let cw = canvas.clientWidth;
    let ch = canvas.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        cw = entry.contentRect.width;
        ch = entry.contentRect.height;
        canvas.width = cw;
        canvas.height = ch;
      }
    });
    resizeObserver.observe(canvas);

    const renderEQ = () => {
      const displayWidth = cw;
      const displayHeight = ch;
      
      if (displayWidth === 0 || displayHeight === 0) {
        rafId = requestAnimationFrame(renderEQ);
        return;
      }

      const hasRealWebAudio = window.globalAudioAnalyser && window.globalFreqData;
      const scales = eqScalesRef.current;
      
      if (isPlaying && isPlayingCurrentSong && hasRealWebAudio) {
        idleFrames = 0;          
        window.globalAudioAnalyser.getByteFrequencyData(window.globalFreqData);
        const freqData = window.globalFreqData;
        const bufferLength = freqData.length;
        
        for (let i = 0; i < numBars; i++) {
          const percent = i / numBars;
          const dataIndex = Math.floor(Math.pow(percent, 1.2) * (bufferLength * 0.6));
          const safeIndex = Math.min(dataIndex, bufferLength - 1);
          
          const raw = freqData[safeIndex] || 0;
          const normalized = raw / 255;
          const emphasized = Math.pow(normalized, 3);
          
          const dampener = 0.6 + (percent * 0.6); 
          const targetScale = 0.05 + (emphasized * 1.2 * dampener);
          
          if (targetScale > scales[i]) {
            scales[i] += (targetScale - scales[i]) * 0.75; 
          } else {
            scales[i] += (targetScale - scales[i]) * 0.12; 
          }
        }
      } else {
        let allSettled = true;
        for (let i = 0; i < numBars; i++) {
          if (scales[i] > 0.051) {
            scales[i] += (0.05 - scales[i]) * pauseDecayFactor;
            allSettled = false;
          } else if (scales[i] !== 0.05) {
            scales[i] = 0.05;
            allSettled = false;
          }
        }
        
        if (allSettled) idleFrames++;
      }

      if (idleFrames > 5) {
        rafId = requestAnimationFrame(renderEQ);
        return; 
      }

      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.fillStyle = '#ffffff';
      
      const barSpacing = displayWidth / numBars;
      const barWidth = Math.max(1, barSpacing * 0.75);
      const startX = (barSpacing - barWidth) / 2;

      ctx.beginPath(); 
      for (let i = 0; i < numBars; i++) {
        const barHeight = scales[i] * displayHeight;
        const x = startX + (i * barSpacing);
        const y = displayHeight - barHeight;
        const radius = Math.min(4, barHeight / 2);

        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
      }
      ctx.fill();

      rafId = requestAnimationFrame(renderEQ);
    };

    rafId = requestAnimationFrame(renderEQ);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isPlaying, isPlayingCurrentSong, settings?.eqFadeOutTime, settings?.disableAnimations, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    
    const timer = setTimeout(() => {
      if (containerRef.current) {
        cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => ({
            node,
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            nextStart: parseFloat(node.dataset.nextStart),
            isActive: node.classList.contains('active')
        }));
        
        cachedAdlibsRef.current = Array.from(containerRef.current.querySelectorAll('.adlib-node')).map(node => ({
            node,
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            state: node.classList.contains('adlib-active') ? 'active' : (node.classList.contains('adlib-visible') ? 'visible' : 'hidden')
        }));

        if (isPlayingCurrentSong && typeof window.currentAudioTime === 'number') {
            handleTimeUpdate(window.currentAudioTime);
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isEditing, liveParsedLyrics, lyricsViewMode, selectedSong?.syncData]);

  const handleTimeUpdate = (time) => {
    if (isEditing || !isPlayingCurrentSong) return;

    const lines = cachedLinesRef.current;
    let newActiveIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const { start, end, nextStart } = lines[i];
        if (!isNaN(start) && time >= start) {
            const isBeforeEnd = isNaN(end) || time <= end;
            const isBeforeNext = isNaN(nextStart) || time < nextStart;
            
            if (isBeforeEnd && isBeforeNext) {
                newActiveIndex = i;
                break;
            }
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const shouldBeActive = (i === newActiveIndex);
        
        if (shouldBeActive && !item.isActive) {
            item.node.classList.add('active');
            item.isActive = true;
            
            if (lyricsViewMode === 'live' && containerRef.current) {
                const offsetTop = item.node.offsetTop;
                const scrollPos = offsetTop - (containerRef.current.clientHeight / 2) + (item.node.clientHeight / 2);
                
                containerRef.current.scrollTo({ 
                  top: scrollPos, 
                  behavior: settings?.disableAnimations ? 'auto' : 'smooth' 
                });
            }
        } else if (!shouldBeActive && item.isActive) {
            item.node.classList.remove('active');
            item.isActive = false;
        }
    }

    const adlibs = cachedAdlibsRef.current;
    for (let i = 0; i < adlibs.length; i++) {
        const item = adlibs[i];
        if (isNaN(item.start)) continue;

        let targetState = 'hidden';
        if (time >= item.start && time <= item.end) targetState = 'active';
        else if (time >= item.start) targetState = 'visible';

        if (item.state !== targetState) {
            const cl = item.node.classList;
            if (targetState === 'active') {
                cl.add('adlib-active');
                cl.remove('adlib-hidden', 'adlib-visible');
            } else if (targetState === 'visible') {
                cl.add('adlib-visible');
                cl.remove('adlib-hidden', 'adlib-active');
            } else {
                cl.add('adlib-hidden');
                cl.remove('adlib-active', 'adlib-visible');
            }
            item.state = targetState;
        }
    }
  };

  useEffect(() => {
    if (isEditing || (lyricsViewMode !== 'live' && lyricsViewMode !== 'focused')) return;

    const clearAllActive = () => {
        cachedLinesRef.current.forEach(item => {
            if (item.isActive) {
                item.node.classList.remove('active');
                item.isActive = false;
            }
        });
        cachedAdlibsRef.current.forEach(item => {
            if (item.state !== 'hidden') {
                item.node.classList.add('adlib-hidden');
                item.node.classList.remove('adlib-active', 'adlib-visible');
                item.state = 'hidden';
            }
        });
    };

    const handleTimeEvent = (e) => handleTimeUpdate(e.detail);
    const handlePlayState = (e) => {
        if (e.detail.isEnded) {
            clearAllActive();
        }
    };

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalPlayState', handlePlayState);

    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTimeUpdate(initialTime);
    } else {
        clearAllActive();
    }

    return () => {
        window.removeEventListener('globalTimeUpdate', handleTimeEvent);
        window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [isEditing, lyricsViewMode, isPlayingCurrentSong, currentTrack, settings?.disableAnimations]);

  const handlePaste = (e) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html.replace(/<o:p>&nbsp;<\/o:p>/g, '');
      
      const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\u00A0/g, ' ');
        if (node.nodeType === Node.ELEMENT_NODE) {
          let innerText = '';
          for (let child of node.childNodes) innerText += processNode(child);
          
          const tag = node.tagName.toLowerCase();
          const style = node.style || {};
          const fw = style.fontWeight || '';
          
          const isBold = tag === 'b' || tag === 'strong' || fw === 'bold' || fw === '700' || parseInt(fw) >= 600;
          const isItalic = tag === 'i' || tag === 'em' || style.fontStyle === 'italic';
          
          if (innerText.trim()) {
            const leadSpace = innerText.match(/^\s*/)[0];
            const trailSpace = innerText.match(/\s*$/)[0];
            let wrapped = innerText.trim();
            if (isItalic) wrapped = `_${wrapped}_`;
            if (isBold) wrapped = `**${wrapped}**`;
            innerText = `${leadSpace}${wrapped}${trailSpace}`;
          }
          
          if (['p', 'div', 'br', 'li', 'h1', 'h2', 'h3'].includes(tag) && !innerText.endsWith('\n')) innerText += '\n';
          return innerText;
        }
        return '';
      };
      
      let markdownText = processNode(tempDiv).replace(/\n{3,}/g, '\n\n').trim();
      
      if (document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, markdownText);
      } else {
        const textarea = e.target;
        const newVal = (customData.lyrics || '').substring(0, textarea.selectionStart) + markdownText + (customData.lyrics || '').substring(textarea.selectionEnd);
        handleDataChange({ target: { name: 'lyrics', value: newVal } });
      }
    }
  };

  return (
    <>
      {isEditing ? (
        <div className="edit-lyrics-container">
          <div className="lyrics-textarea-wrapper">
            <textarea
              name="lyrics"
              value={customData.lyrics}
              onChange={handleDataChange}
              onPaste={handlePaste}
              className="lyrics-textarea"
              placeholder="Paste your lyrics here! Format lines using [Artist Name:] tags or *italics* / **bold** formatting."
            />
          </div>
          <div className="artist-preview-pane">
            <div className="artist-preview-header">
              <span className="artist-preview-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Artist Tag Preview
              </span>
              <span className="artist-preview-badge">{editParsedLyrics.length} lines</span>
            </div>
            
            <div className="artist-preview-scroll">
              {editParsedLyrics.length > 0 ? (
                editParsedLyrics.map((line, idx) => {
                  const borderAccent = getBorderAccentColor(line);
                  return (
                    <div key={idx} className="preview-line-row" style={{ borderLeftColor: borderAccent }}>
                      <span className="preview-line-singer">
                        {renderColoredSingerHeader(line.singer)}
                      </span>
                      <div className="preview-line-text">
                        {line.segments && line.segments.length > 0 ? (
                          line.segments.map((seg, sIdx) => (
                            <React.Fragment key={sIdx}>
                              {renderColoredText(seg)}
                            </React.Fragment>
                          ))
                        ) : (
                          renderColoredText(line)
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="preview-empty-text">Type lyrics on the left to see live artist separation...</div>
              )}
            </div>
          </div>
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'live' ? (
        <div 
           className="live-lyrics-preview" 
           ref={containerRef}
          style={{
            '--dyn-live-sync-gap': `${settings?.liveSyncLineGap ?? 16}px`
          }}
        >
          {liveParsedLyrics.map((line, i) => {
            let nextStart = 'NaN';
            const syncList = selectedSong?.syncData || [];
            const savedNode = syncList[i];

            for (let j = i + 1; j < syncList.length; j++) {
                if (syncList[j]?.start != null) {
                    nextStart = syncList[j].start;
                    break;
                }
            }

            let displayLineObj = line;
            if (savedNode?.spacedText) {
                displayLineObj = {
                    ...line,
                    text: savedNode.spacedText,
                    segments: injectSpacesIntoSegments(line.segments || [{ text: line.text }], savedNode.spacedText)
                };
            }

            return (
                <LyricLineWrapper
                  key={i}
                  lineObj={displayLineObj}
                  savedNode={savedNode}
                  nextStart={nextStart}
                  viewMode="live"
                  handleLineClick={handleLineClick}
                  masterPalette={masterPalette}
                  isPlayingCurrentSong={isPlayingCurrentSong}
                />
            )
          })}
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'focused' ? (
        <div className="focused-lyrics-preview" ref={containerRef}>
          {liveParsedLyrics.map((line, i) => {
             let nextStart = 'NaN';
             const syncList = selectedSong?.syncData || [];
             const savedNode = syncList[i];
             for (let j = i + 1; j < syncList.length; j++) {
                 if (syncList[j]?.start != null) {
                     nextStart = syncList[j].start;
                     break;
                 }
             }

             let displayLineObj = line;
             if (savedNode?.spacedText) {
                 displayLineObj = {
                     ...line,
                     text: savedNode.spacedText,
                     segments: injectSpacesIntoSegments(line.segments || [{ text: line.text }], savedNode.spacedText)
                 };
             }

             return (
                 <LyricLineWrapper
                     key={i}
                     lineObj={displayLineObj}
                     savedNode={savedNode}
                     nextStart={nextStart}
                     viewMode="focused"
                     handleLineClick={handleLineClick}
                     masterPalette={masterPalette}
                     isPlayingCurrentSong={isPlayingCurrentSong}
                 />
             )
          })}
          <FocusedAdlibsTracker 
             syncData={selectedSong?.syncData} 
             handleLineClick={handleLineClick} 
             masterPalette={masterPalette} 
             isPlayingCurrentSong={isPlayingCurrentSong} 
          />
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'plain' ? (
        <div className="lyrics-display">
          {customData.lyrics || "No lyrics provided yet. Go to Edit to add lyrics!"}
        </div>
      ) : (
        <div className="no-lyrics-empty-state">
           <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
             <path d="M9 18V5l12-2v13"></path>
             <circle cx="6" cy="18" r="3"></circle>
             <circle cx="18" cy="16" r="3"></circle>
           </svg>
           <p>No timings found.</p>
        </div>
      )}

      {!isEditing && !settings?.disableAnimations && (
         <div className="lyrics-equalizer">
           <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
         </div>
      )}
    </>
  );
};

export default LyricsDisplay;
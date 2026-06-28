/* --- src/components/SyncWorkspace.jsx --- */
import React from 'react';
import { formatPreciseTime } from '../utils/songHelpers';
import { quickTransliterate } from '../transliterator';

const SyncWorkspace = ({
  syncData, activeSyncIndex, setActiveSyncIndex, syncProgress, syncDuration, setSyncDuration,
  isSyncPlaying, toggleSyncPlay, handleSyncSeek, playbackRate, handleSpeedChange,
  syncAudioRef, syncAudioSrc, handleSyncTimeUpdate, setIsSyncPlaying, activeLineRef,
  workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange, masterPalette
}) => {
  
  const handleAudioLoaded = (e) => {
    if (e.target.readyState > 0) {
      setSyncDuration(e.target.duration || 0);
    }
  };

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
      handleSplitAdlibs(lineIndex, data);
    }
  };

  const renderWorkspaceLine = (line, isMain) => {
    const pronString = line.pronunciation;
    const segments = line.segments || [{ text: line.text }];

    const pronStyle = { 
        fontSize: '0.55em', 
        color: '#ffffff', 
        opacity: 1, 
        textShadow: 'none', 
        fontWeight: '800', 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px',
        textAlign: 'center',
        marginTop: '4px'
    };

    let parsedChunks = null;
    if (typeof pronString === 'string') {
        try {
            const parsed = JSON.parse(pronString);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
                parsedChunks = parsed;
            }
        } catch (e) {
            parsedChunks = null;
        }
    }

    const chars = [];
    segments.forEach(seg => {
        const segChars = Array.from(seg.text);
        segChars.forEach(char => {
            chars.push({ char, seg });
        });
    });

    const hasTransliteration = (parsedChunks && parsedChunks.some(chunk => chunk.type === 'foreign' && chunk.trans)) || !!pronString;

    const renderColoredChar = (c, cIdx) => {
        const isParenthesis = /([()\[\]{}]+)/.test(c.char);
        
        let activeColor = '#ffffff';
        let isGradient = false;
        let gradientStyle = '';

        if (c.seg) {
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
        
        if (isMain && line.isSplit) {
          const isAdlibChar = line.adlibs?.some(a => cIdx >= a.charStart && cIdx < a.charEnd);
          if (isAdlibChar) {
             style.opacity = 0.2;
             style.textDecoration = 'line-through';
          }
        }
        
        if (isParenthesis && hasTransliteration) {
            style.display = 'inline-block';
            style.transform = 'scale(1.2) translateY(10%)';
            style.margin = '0 2px';
        }

        return <span key={cIdx} style={style}>{c.char}</span>;
    };

    if (parsedChunks) {
        let charOffset = 0;
        const renderedChunks = parsedChunks.map((chunk, chunkIdx) => {
            const chunkLen = Array.from(chunk.text).length;
            const firstCharIdx = charOffset;
            const chunkChars = chars.slice(charOffset, charOffset + chunkLen);
            charOffset += chunkLen;

            const renderedText = chunkChars.map((c, i) => renderColoredChar(c, firstCharIdx + i));
            
            if (chunk.type === 'foreign' && chunk.trans) {
                const cleanTrans = chunk.trans.replace(/[()\[\]{}]/g, '');
                return (
                    <span key={chunkIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle' }}>
                        <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{renderedText}</span>
                        <span style={pronStyle}>{cleanTrans}</span>
                    </span>
                );
            } else {
                return <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'middle' }}>{renderedText}</span>;
            }
        });

        return (
            <div style={{ textAlign: 'left', width: '100%' }}>
                <span className="sync-text" style={{ whiteSpace: 'pre-wrap', display: 'inline-block', verticalAlign: 'bottom' }}>{renderedChunks}</span>
            </div>
        );
    } else {
        const renderedChars = chars.map((c, cIdx) => renderColoredChar(c, cIdx));
        const blockPronStyle = { ...pronStyle, marginTop: '8px', display: 'block', textAlign: 'left', wordSpacing: '4px', lineHeight: '1.4' };
        
        let displayPronString = pronString;
        if (pronString) {
             displayPronString = pronString.replace(/[()\[\]{}]/g, '');
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
                <span className="sync-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', display: 'inline-block' }}>{renderedChars}</span>
                {displayPronString && <div style={blockPronStyle}>{displayPronString}</div>}
            </div>
        );
    }
  };

  return (
    <div className="sync-mode-container">
      <div className="sync-player glass-panel">
        <button className="sync-play-btn" onClick={toggleSyncPlay}>{isSyncPlaying ? '⏸' : '▶'}</button>
        <span className="precise-time">{formatPreciseTime(syncProgress)}</span>
        <input 
          type="range" className="custom-slider sync-slider" 
          min="0" max={syncDuration || 1} step="0.001" 
          value={syncProgress} onChange={handleSyncSeek} 
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
        />
        <div className="speed-ticks">
          <span>0.5x</span><span>1.0x</span><span>1.5x</span><span>2.0x</span>
        </div>
      </div>

      <div className="sync-lines-container">
        {workspaceLines.map((item, i) => {
          const isMain = item.type === 'main';
          const line = item.ref;
          const isActive = i === activeSyncIndex;
          const isRecording = line.start !== null && line.end === null;
          const isSynced = line.start !== null && line.end !== null;
          
          const hasParentheses = isMain && /\([^)]+\)/.test(line.text);
          
          let isAdlibPlaying = false;
          if (!isMain && line.start !== null) {
            const boundedEnd = line.end !== null ? line.end : (item.parentRef?.end !== null ? item.parentRef.end : Number.MAX_VALUE);
            isAdlibPlaying = syncProgress >= line.start && syncProgress <= boundedEnd;
          }
          
          return (
            <div 
              key={i}
              ref={isActive ? activeLineRef : null}
              className={`sync-line ${isActive ? 'active' : ''} ${isRecording ? 'recording' : ''} ${isSynced ? 'synced' : ''} ${!isMain ? 'nested-adlib' : ''} ${isAdlibPlaying ? 'adlib-playing' : ''}`}
              onClick={() => {
                setActiveSyncIndex(i);
                if (!isMain && (line.start === null || line.end === null)) {
                  setLoopRange({ start: item.parentRef.start, end: item.parentRef.end || (item.parentRef.start + 5) });
                  if (syncAudioRef.current) syncAudioRef.current.currentTime = item.parentRef.start;
                  if (!isSyncPlaying) toggleSyncPlay();
                } else if (line.start !== null && syncAudioRef.current) {
                  setLoopRange(null);
                  syncAudioRef.current.currentTime = line.start;
                  if (!isMain) setConstrainedEnd(item.parentRef.end || item.parentRef.start + 5);
                  else setConstrainedEnd(null);
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
        src={syncAudioSrc}
        onTimeUpdate={handleSyncTimeUpdate}
        onLoadedMetadata={handleAudioLoaded}
        onDurationChange={handleAudioLoaded}
        onEnded={() => setIsSyncPlaying(false)}
        onPlay={() => setIsSyncPlaying(true)}
        onPause={() => setIsSyncPlaying(false)}
      />
    </div>
  );
};

export default SyncWorkspace;
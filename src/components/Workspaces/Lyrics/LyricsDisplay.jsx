/* --- src/components/Workspaces/Lyrics/LyricsDisplay.jsx --- */
import React, { useEffect, useRef, useMemo } from 'react';
import { LyricLineWrapper } from './LyricsLineRenderer';
import { FocusedAdlibsTracker } from '../Sync/FocusedAdlibsTracker';
import { parseLyrics } from '../../../utils/songHelpers';
import './LyricsDisplay.css';

const LyricsDisplay = ({ 
    isEditing, customData, handleDataChange, hasValidSyncData, 
    lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, masterPalette, currentTrack, 
    isPlaying, settings }) => {

  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
  const eqBarsRef = useRef([]);

  const isPlayingCurrentSong = Boolean(currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId);

  // Parse editable lyrics in real-time for live preview calculation
  const editParsedLyrics = useMemo(() => {
    if (!isEditing || !customData.lyrics) return [];
    return parseLyrics(customData.lyrics, selectedSong?.artistName, masterPalette);
  }, [isEditing, customData.lyrics, selectedSong?.artistName, masterPalette]);

  // Primary color style resolver
  const getArtistStyle = (item) => {
    let artists = item.artists || [];
    if (artists.length === 0 && item.singer) {
      artists = item.singer.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    }
    if (artists.length > 1) {
      const c1 = masterPalette[artists[0]] || '#ffffff';
      const c2 = masterPalette[artists[1]] || '#ffffff';
      return {
        backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'inline-block'
      };
    } else if (artists.length === 1) {
      const color = masterPalette[artists[0]] || item.color || '#ffffff';
      return { color };
    }
    if (item.isGradient && item.gradient) {
      return {
        backgroundImage: item.gradient,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'inline-block'
      };
    }
    return { color: item.color || '#ffffff' };
  };

  // Helper to render artist headers in preview view
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

  // EQUALIZER
  useEffect(() => {
    let rafId;
    let lastEqDraw = 0;
    const fadeOutTime = settings?.eqFadeOutTime ?? 500;

    const renderEQ = (timestamp) => {
      const hasRealWebAudio = window.globalAudioAnalyser && window.globalFreqData;
      if (isPlaying && isPlayingCurrentSong && hasRealWebAudio) {
        if (timestamp - lastEqDraw > 33) {
          window.globalAudioAnalyser.getByteFrequencyData(window.globalFreqData);
          const freqData = window.globalFreqData;
          const bars = eqBarsRef.current;
          if (freqData && bars) {
            for (let i = 0; i < bars.length; i++) {
              if (bars[i]) {
                const raw = freqData[i % freqData.length] || 0;
                const scale = 0.05 + (raw / 255) * 0.95;
                bars[i].style.transition = 'transform 0.05s ease-out';
                bars[i].style.transform = `scaleY(${scale})`;
              }
            }
          }
          lastEqDraw = timestamp;
        }
      } else {
        const bars = eqBarsRef.current;
        for (let i = 0; i < bars.length; i++) {
          if (bars[i] && bars[i].style.transform !== 'scaleY(0.05)') {
            bars[i].style.transition = `transform ${fadeOutTime}ms ease-out`;
            bars[i].style.transform = `scaleY(0.05)`;
          }
        }
      }
      rafId = requestAnimationFrame(renderEQ);
    };

    rafId = requestAnimationFrame(renderEQ);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isPlayingCurrentSong, settings?.eqFadeOutTime]);

  // RE-QUERY DOM ELEMENTS WHENEVER EDIT MODE CLOSES OR LYRICS/VIEW-MODES CHANGE
  useEffect(() => {
    if (isEditing) return;

    // Small delay allows React to finish DOM paint after exiting edit mode
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

        // Immediately trigger sync calculation on newly cached DOM nodes
        if (isPlayingCurrentSong && typeof window.currentAudioTime === 'number') {
            handleTimeUpdate(window.currentAudioTime);
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isEditing, liveParsedLyrics, lyricsViewMode, selectedSong?.syncData]);

  // DEDICATED TIME UPDATE PROCESSOR
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
                containerRef.current.scrollTo({ top: scrollPos, behavior: 'smooth' });
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
  }, [isEditing, lyricsViewMode, isPlayingCurrentSong, currentTrack]);

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
                            <span key={sIdx} style={getArtistStyle(seg)}>
                              {seg.text}
                            </span>
                          ))
                        ) : (
                          <span style={getArtistStyle(line)}>{line.text}</span>
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
            for (let j = i + 1; j < syncList.length; j++) {
                if (syncList[j]?.start != null) {
                    nextStart = syncList[j].start;
                    break;
                }
            }
            return (
                <LyricLineWrapper
                  key={i}
                  lineObj={line}
                  savedNode={syncList[i]}
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
             for (let j = i + 1; j < syncList.length; j++) {
                 if (syncList[j]?.start != null) {
                     nextStart = syncList[j].start;
                     break;
                 }
             }
             return (
                 <LyricLineWrapper
                     key={i}
                     lineObj={line}
                     savedNode={syncList[i]}
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
      ) : (
        <div className="lyrics-display">
          {liveParsedLyrics.length > 0 ? (
            liveParsedLyrics.map((line, i) => (
              <div key={i} style={{ textAlign: 'left' }} dir="auto">
                {line.segments ? line.segments.map((seg, idx) => (
                  <span key={idx} style={getArtistStyle(seg)}>
                    {seg.text}
                  </span>
                )) : (
                  <span style={getArtistStyle(line)}>{line.text}</span>
                )}
              </div>
            ))
          ) : (
            <div className="no-lyrics-empty-state">
              <p>No lyrics found in your Vault.</p>
            </div>
          )}
        </div>
      )}

      {!isEditing && (
        <div className={`lyrics-equalizer`}>
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="eq-bar"
              ref={(el) => eqBarsRef.current[i] = el}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default LyricsDisplay;
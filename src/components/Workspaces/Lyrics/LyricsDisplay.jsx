/* --- src/components/Workspaces/Lyrics/LyricsDisplay.jsx --- */
import React, { useEffect, useRef, useMemo } from 'react';
import { LyricLineWrapper } from './LyricsLineRenderer';
import { FocusedAdlibsTracker } from '../Sync/FocusedAdlibsTracker';
import LyricsEqualizer from './LyricsEqualizer';
import { parseLyrics } from '../../../utils/songHelpers';
import { getGraphemes } from '../../LyricsRenderer/textUtils';
import './LyricsDisplay.css';

const LyricsDisplay = ({ 
   isEditing, customData, handleDataChange, hasValidSyncData, 
   lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, masterPalette, currentTrack, 
   isPlaying, settings 
}) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);

  const isPlayingCurrentSong = Boolean(currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId);

  const editParsedLyrics = useMemo(() => {
    if (!isEditing || !customData.lyrics) return [];
    return parseLyrics(customData.lyrics, selectedSong?.artistName, masterPalette);
  }, [isEditing, customData.lyrics, selectedSong?.artistName, masterPalette]);

  const getBorderAccentColor = (line) => {
    let artists = line.artists || [];
    if (artists.length === 0 && line.singer) {
      artists = line.singer.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    }
    if (artists.length > 0) {
      return masterPalette[artists[0]] || '#ffffff';
    }
    // Return white for uncredited lines instead of falling back to the main artist color
    return line.color || '#ffffff'; 
  };

  // Grouped lyrics specifically for the Edit Mode preview
  const editGroupedLyrics = useMemo(() => {
    if (!isEditing || !customData.lyrics) return [];
    const groups = [];
    let currentGroup = null;

    editParsedLyrics.forEach((line, i) => {
      // If line.singer is empty (e.g. unmapped formatted text), group it as 'Uncredited'
      const effectiveSinger = line.singer || 'Uncredited';

      if (!currentGroup || line.sectionHeader || effectiveSinger !== currentGroup.singer) {
        if (currentGroup) groups.push(currentGroup);
        
        currentGroup = {
          id: `edit-group-${i}`,
          sectionHeader: line.sectionHeader,
          singer: effectiveSinger,
          borderColor: getBorderAccentColor(line),
          lines: []
        };
      }
      currentGroup.lines.push(line);
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [editParsedLyrics, selectedSong?.artistName, masterPalette, isEditing, customData.lyrics]);

  const groupedPlainLyrics = useMemo(() => {
    if (lyricsViewMode !== 'plain') return [];
    const groups = [];
    let currentGroup = null;

    liveParsedLyrics.forEach((line, i) => {
      // If line.singer is empty (e.g. unmapped formatted text), group it as 'Uncredited'
      const effectiveSinger = line.singer || 'Uncredited';

      if (!currentGroup || line.sectionHeader || effectiveSinger !== currentGroup.singer) {
        if (currentGroup) groups.push(currentGroup);
        
        let borderColor = line.color || '#ffffff';
        if (line.isGradient) {
          const firstArtist = effectiveSinger.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean)[0]?.trim();
          borderColor = masterPalette[firstArtist] || '#ffffff';
        } else if (!line.singer) {
          borderColor = '#ffffff';
        }

        currentGroup = {
          id: `group-${i}`,
          sectionHeader: line.sectionHeader,
          singer: effectiveSinger,
          color: line.color,
          borderColor: borderColor,
          gradient: line.gradient,
          isGradient: line.isGradient,
          lines: []
        };
      }
      currentGroup.lines.push(line);
    });
    
    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [liveParsedLyrics, lyricsViewMode, selectedSong?.artistName, masterPalette]);

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

  const renderPlainColoredText = (item) => {
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
          WebkitTextFillColor: 'transparent'
        };
      } else {
        style = { color: activeColor };
      }

      return <span key={cIdx} style={style}>{char}</span>;
    });
  };

  const renderColoredSingerHeader = (singerString) => {
    if (!singerString) {
      const defaultSinger = selectedSong?.artistName || 'Default Artist';
      return <span style={{ color: masterPalette[defaultSinger] || '#ffffff' }}>{defaultSinger}</span>;
    }
    
    const artists = singerString.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    
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
              {editGroupedLyrics.length > 0 ? (
                editGroupedLyrics.map((group, idx) => {
                  let displayHeader = '';
                  if (group.sectionHeader) {
                    displayHeader = group.sectionHeader.replace(/[\[\]]/g, '');
                    if (displayHeader.includes(':')) {
                      displayHeader = displayHeader.split(':')[0].trim();
                    }
                  }

                  return (
                    <React.Fragment key={group.id}>
                      {group.sectionHeader && (
                        <div className="plain-section-header" style={{ marginTop: idx === 0 ? '0' : '24px', fontSize: '11px', paddingBottom: '4px', marginBottom: '8px' }}>
                          {displayHeader}
                        </div>
                      )}
                      <div className="preview-line-row" style={{ borderLeftColor: group.borderColor, display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                        <span className="preview-line-singer">
                          {renderColoredSingerHeader(group.singer)}
                        </span>
                        <div className="preview-line-text-group" style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                          {group.lines.map((line, lIdx) => (
                            <div key={lIdx} className="preview-line-text" dir="auto">
                              {line.segments && line.segments.length > 0 ? (
                                line.segments.map((seg, sIdx) => (
                                  <React.Fragment key={sIdx}>
                                    {renderPlainColoredText(seg)}
                                  </React.Fragment>
                                ))
                              ) : (
                                renderPlainColoredText(line)
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </React.Fragment>
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
          {groupedPlainLyrics.length > 0 ? (
            groupedPlainLyrics.map((group, gIdx) => {
              let displayHeader = '';
              if (group.sectionHeader) {
                displayHeader = group.sectionHeader.replace(/[\[\]]/g, '');
                if (displayHeader.includes(':')) {
                  displayHeader = displayHeader.split(':')[0].trim();
                }
              }

              return (
              <React.Fragment key={group.id}>
                {group.sectionHeader && (
                  <div className="plain-section-header" style={{ marginTop: gIdx === 0 ? '0' : '32px' }}>
                    {displayHeader}
                  </div>
                )}
                
                <div 
                  className="plain-artist-block"
                  style={{ borderLeftColor: group.borderColor }}
                >
                  <div className="plain-artist-name">
                    {renderColoredSingerHeader(group.singer)}
                  </div>
                  <div className="plain-block-lines">
                    {group.lines.map((line, lIdx) => (
                      <div key={lIdx} className="plain-lyric-line" dir="auto">
                        <div style={{ textAlign: 'left' }}>
                          {line.segments ? line.segments.map((seg, sIdx) => (
                            <React.Fragment key={sIdx}>
                              {renderPlainColoredText(seg)}
                            </React.Fragment>
                          )) : (
                            renderPlainColoredText(line)
                          )}
                        </div>
                        {line.translation && (
                          <span className="plain-lyric-translation" dir="ltr">{line.translation}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            )})
          ) : (
            <div className="no-lyrics-empty-state">
              <p>No lyrics found in your Vault.</p>
            </div>
          )}
        </div>
      )}

      <LyricsEqualizer 
        isPlaying={isPlaying} 
        isPlayingCurrentSong={isPlayingCurrentSong} 
        disableAnimations={settings?.disableAnimations} 
        isEditing={isEditing} 
      />
    </>
  );
};

export default LyricsDisplay;
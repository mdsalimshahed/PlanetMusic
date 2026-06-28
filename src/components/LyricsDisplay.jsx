/* --- src/components/LyricsDisplay.jsx --- */
import React, { useState, useEffect, useMemo } from 'react';

// Failsafe to identify characters that do not use spaces to break (Chinese/Japanese)
const isCJ = (char) => /[\u4e00-\u9fa5\u3040-\u30ff]/.test(char);

// Reassembles individual character spans into unbreakable "word" blocks
const groupWords = (elements, charData) => {
  const words = [];
  let currentWord = [];
  
  for (let i = 0; i < elements.length; i++) {
    if (!elements[i]) {
      if (currentWord.length > 0) {
        words.push(<span key={`w-${i}`} style={{ whiteSpace: 'nowrap' }}>{currentWord}</span>);
        currentWord = [];
      }
      words.push(elements[i]);
      continue;
    }
    
    const char = charData[i].char;
    // Break the group on spaces, tabs, newlines, or Chinese/Japanese characters
    if (/\s/.test(char) || isCJ(char)) {
      if (currentWord.length > 0) {
        words.push(<span key={`w-${i}`} style={{ whiteSpace: 'nowrap' }}>{currentWord}</span>);
        currentWord = [];
      }
      words.push(elements[i]); 
    } else {
      currentWord.push(elements[i]);
    }
  }
  
  if (currentWord.length > 0) {
    words.push(<span key="w-end" style={{ whiteSpace: 'nowrap' }}>{currentWord}</span>);
  }
  return words;
};

// Pure renderer detached from state for raw performance
const renderLine = (lineObj, savedNode, isActive, isFocused, localProgress, masterPalette) => {
  const pronString = savedNode?.pronunciation;
  const segments = lineObj.segments || [];

  const activePronStyle = { fontSize: '0.55em', color: '#ffffff', opacity: 0.9, textShadow: '0 2px 6px rgba(0,0,0,0.9)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' };
  const inactivePronStyle = { fontSize: '0.55em', color: 'rgba(255, 255, 255, 0.2)', textShadow: '0 2px 4px rgba(0,0,0,0.6)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' };

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
      if (isFocused && savedNode?.isSplit && savedNode?.adlibs?.some(a => cIdx >= a.charStart && cIdx < a.charEnd)) {
          return null;
      }

      let isAdlib = false;
      let isAdlibActive = false;

      if (savedNode?.isSplit && !isFocused) {
          const adlib = savedNode.adlibs?.find(a => cIdx >= a.charStart && cIdx < a.charEnd);
          if (adlib) {
              isAdlib = true;
              isAdlibActive = adlib.start !== null && localProgress >= adlib.start && (adlib.end !== null ? localProgress <= adlib.end : true);
          }
      }

      let isCharActive = isActive;
      let isHiddenAdlib = false;

      if (isAdlib) {
          isCharActive = isAdlibActive;
          if (isActive && !isAdlibActive) {
              isHiddenAdlib = true;
          }
      }

      const isPunct = /([.,!?;:"'()\[\]{}\-—–~¿¡«»“”‘’]+)/.test(c.char);
      
      let activeColor = isPunct ? '#fbbf24' : '#ffffff';
      let isGradient = false;
      let gradientStyle = '';

      if (!isPunct && c.seg) {
          let targetArtists = c.seg.artists;

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

      let style = { transition: 'color 0.4s ease, text-shadow 0.4s ease, opacity 0.4s ease, transform 0.4s ease' };

      if (isHiddenAdlib) {
          style.opacity = 0;
          style.transform = 'translateY(8px)';
          style.display = c.char.trim() === '' ? 'inline' : 'inline-block';
      } else if (isCharActive) {
          if (isAdlib) {
              style.opacity = 1;
              style.transform = 'translateY(0px)';
              style.display = c.char.trim() === '' ? 'inline' : 'inline-block';
          }
          if (isGradient) {
              style.backgroundImage = gradientStyle;
              style.WebkitBackgroundClip = 'text';
              style.WebkitTextFillColor = 'transparent';
              style.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 ${isFocused?'30px':'20px'} rgba(255,255,255,0.4))`;
          } else {
              style.color = activeColor;
              style.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 ${isFocused?'30px':'20px'} ${activeColor}80`;
          }
      } else {
          style.color = 'rgba(255, 255, 255, 0.2)';
          style.textShadow = '0 2px 4px rgba(0,0,0,0.6)';
          if (isAdlib) {
              style.opacity = 1;
              style.transform = 'translateY(0px)';
              style.display = c.char.trim() === '' ? 'inline' : 'inline-block';
          }
      }

      const isParenthesis = /([()\[\]{}]+)/.test(c.char);
      if (isParenthesis && hasTransliteration) {
          let scaleParenthesis = false;
          const char = c.char;
          
          if (char === '(' || char === '[' || char === '{') {
              const closing = char === '(' ? ')' : char === '[' ? ']' : '}';
              for (let i = cIdx + 1; i < chars.length; i++) {
                  if (chars[i].char === closing) break;
                  if (!/^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(chars[i].char)) {
                      scaleParenthesis = true;
                      break;
                  }
              }
          } else if (char === ')' || char === ']' || char === '}') {
              const opening = char === ')' ? '(' : char === ']' ? '[' : '{';
              for (let i = cIdx - 1; i >= 0; i--) {
                  if (chars[i].char === opening) break;
                  if (!/^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(chars[i].char)) {
                      scaleParenthesis = true;
                      break;
                  }
              }
          }

          if (scaleParenthesis) {
              style.display = 'inline-block';
              if (isHiddenAdlib) {
                  style.transform = 'scale(1.2) translateY(8px)';
              } else {
                  style.transform = 'scale(1.2) translateY(10%)';
              }
              style.margin = '0 2px';
          }
      }

      return <span key={cIdx} style={style}>{c.char}</span>;
  };

  if (parsedChunks) {
      let charOffset = 0;
      const renderedChunks = parsedChunks.map((chunk, chunkIdx) => {
          const chunkLen = Array.from(chunk.text).length;
          const firstCharIdx = charOffset;
          chunk.charStart = firstCharIdx;
          const chunkChars = chars.slice(charOffset, charOffset + chunkLen);
          charOffset += chunkLen;

          const renderedText = chunkChars.map((c, i) => renderColoredChar(c, firstCharIdx + i));
          if (renderedText.every(c => c === null)) return null;

          // Apply our word grouping failsafe
          const groupedText = groupWords(renderedText, chunkChars);

          let chunkIsActive = isActive;
          let isChunkAdlib = false;
          let isChunkAdlibActive = false;

          if (savedNode?.isSplit && !isFocused) {
             const adlib = savedNode.adlibs?.find(a => firstCharIdx >= a.charStart && firstCharIdx < a.charEnd);
             if (adlib) {
                 isChunkAdlib = true;
                 isChunkAdlibActive = adlib.start !== null && localProgress >= adlib.start && (adlib.end !== null ? localProgress <= adlib.end : true);
             }
          }

          let isHiddenChunkAdlib = false;
          if (isChunkAdlib) {
              chunkIsActive = isChunkAdlibActive;
              if (isActive && !isChunkAdlibActive) {
                  isHiddenChunkAdlib = true;
              }
          }

          let currentPronStyle = chunkIsActive ? { ...activePronStyle } : { ...inactivePronStyle };
          
          if (isHiddenChunkAdlib) {
              currentPronStyle.opacity = 0;
              currentPronStyle.transform = 'translateY(8px)';
              currentPronStyle.display = 'inline-block';
              currentPronStyle.transition = 'opacity 0.4s ease, transform 0.4s ease, color 0.4s ease';
          } else if (isChunkAdlib) {
              currentPronStyle.transform = 'translateY(0px)';
              currentPronStyle.display = 'inline-block';
              currentPronStyle.transition = 'opacity 0.4s ease, transform 0.4s ease, color 0.4s ease';
          }

          if (chunk.type === 'foreign' && chunk.trans) {
              const cleanTrans = chunk.trans.replace(/[()\[\]{}]/g, '');
              return (
                  <span key={chunkIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle' }}>
                      <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{groupedText}</span>
                      <span style={currentPronStyle}>{cleanTrans}</span>
                  </span>
              );
          } else {
              return <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'middle' }}>{groupedText}</span>;
          }
      });

      return (
          <div style={{ textAlign: isFocused ? 'center' : 'left', width: '100%' }}>
              <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'inline-block', verticalAlign: 'bottom' }}>
                  {renderedChunks}
              </span>
          </div>
      );
  } else {
      const renderedChars = chars.map((c, i) => renderColoredChar(c, i));
      
      // Apply our word grouping failsafe
      const groupedChars = groupWords(renderedChars, chars);
      
      const blockPronStyle = { ...(isActive ? activePronStyle : inactivePronStyle), marginTop: '8px', display: 'block', textAlign: isFocused ? 'center' : 'left', wordSpacing: '4px', lineHeight: '1.4' };
      let displayPronString = pronString;
      if (pronString) displayPronString = pronString.replace(/[()\[\]{}]/g, '');

      return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: isFocused ? 'center' : 'left', width: '100%' }}>
              <span className="primary-text" style={{ whiteSpace: 'pre-wrap', display: 'inline-block' }}>{groupedChars}</span>
              {displayPronString && <div style={blockPronStyle}>{displayPronString}</div>}
          </div>
      );
  }
};

// High-performance memoized wrapper isolating time updates
const LyricLineWrapper = React.memo(({ 
  lineObj, savedNode, isMainActive, viewMode, 
  activePreviewRef, handleLineClick, masterPalette 
}) => {
  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => {
      const needsUpdates = (viewMode === 'live' && savedNode?.isSplit);
      if (!needsUpdates) return;
      
      const handleTime = (e) => setLocalProgress(e.detail);
      window.addEventListener('globalTimeUpdate', handleTime);
      return () => window.removeEventListener('globalTimeUpdate', handleTime);
  }, [viewMode, savedNode?.isSplit]);

  const seekTarget = savedNode ? savedNode.start : null;

  if (viewMode === 'focused') {
      return (
          <div 
              ref={isMainActive ? activePreviewRef : null}
              className={`focused-line ${isMainActive ? 'active' : ''}`}
              onClick={() => handleLineClick(seekTarget)}
          >
              {renderLine(lineObj, savedNode, true, true, localProgress, masterPalette)}
          </div>
      );
  }

  let isVisuallyActive = isMainActive;
  if (viewMode === 'live' && savedNode?.isSplit) {
      const adlibActive = savedNode.adlibs?.some(a => localProgress >= a.start && (a.end !== null ? localProgress <= a.end : true));
      if (adlibActive) isVisuallyActive = true;
  }

  return (
      <div 
          ref={isMainActive ? activePreviewRef : null}
          className={`preview-line ${isVisuallyActive ? 'active' : ''}`}
          onClick={() => handleLineClick(seekTarget)}
          style={{ cursor: seekTarget !== null ? 'pointer' : 'default' }}
      >
          {renderLine(lineObj, savedNode, isVisuallyActive, false, localProgress, masterPalette)}
      </div>
  );
});

// Memoized container for tracking and rendering focused adlibs cleanly
const FocusedAdlibsTracker = React.memo(({ syncData, handleLineClick, masterPalette }) => {
  const [time, setTime] = useState(0);
  
  useEffect(() => {
      const handleTime = (e) => setTime(e.detail);
      window.addEventListener('globalTimeUpdate', handleTime);
      return () => window.removeEventListener('globalTimeUpdate', handleTime);
  }, []);

  // Recalculates dynamically every time the song loads for true randomization
  const adlibPlacements = useMemo(() => {
      const placements = new Map();
      if (!syncData) return placements;

      syncData.forEach((node) => {
          if (node?.isSplit && node.adlibs) {
              const parentArtists = node.singer ? node.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) : [];
              
              const parentLen = node.text ? node.text.length : 20;
              const horizontalSpread = Math.min(35, parentLen * 0.8); 
              
              const maxLeft = Math.max(10, 50 - horizontalSpread - 5); 
              const minRight = Math.min(90, 50 + horizontalSpread + 5);

              node.adlibs.forEach((adlib, j) => {
                  if (adlib.start === null) return;
                  
                  const randRot = Math.random();
                  const randX = Math.random();
                  const randY = Math.random();
                  const quadRand = Math.random();
                  
                  const rot = (randRot * 20) - 10; 
                  
                  const adlibNames = adlib.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
                  const primaryAdlibSinger = adlibNames[0];

                  let quad = Math.floor(quadRand * 4); 

                  if (parentArtists.length > 1 && primaryAdlibSinger) {
                      const idx = parentArtists.indexOf(primaryAdlibSinger);
                      if (idx !== -1) {
                          if (parentArtists.length === 2) {
                              quad = (idx === 0) ? ((quadRand > 0.5) ? 0 : 3) : ((quadRand > 0.5) ? 1 : 2);
                          } else {
                              quad = idx % 4;
                          }
                      }
                  }
                  
                  let top, left;
                  if (quad === 0) { 
                      top = 15 + (randY * 15); 
                      left = 10 + (randX * (maxLeft - 10)); 
                  } else if (quad === 1) { 
                      top = 15 + (randY * 15); 
                      left = minRight + (randX * (90 - minRight)); 
                  } else if (quad === 2) { 
                      top = 70 + (randY * 15); 
                      left = 10 + (randX * (maxLeft - 10));
                  } else { 
                      top = 65 + (randY * 10); 
                      const adjustedMinRight = Math.min(75, minRight);
                      left = adjustedMinRight + (randX * (85 - adjustedMinRight));
                  }

                  placements.set(`adlib-${adlib.start}-${j}`, { rot, top, left });
              });
          }
      });
      return placements;
  }, [syncData]);

  const visibleAdlibs = [];
  if (syncData) {
      syncData.forEach(node => {
          if (node?.isSplit && node.adlibs) {
              node.adlibs.forEach((adlib, j) => {
                  if (adlib.start === null) return;
                  const endTime = adlib.end !== null ? adlib.end : adlib.start + 5;
                  
                  const isNear = time >= (adlib.start - 0.5) && time <= (endTime + 0.5);
                  const isActive = time >= adlib.start && time <= endTime;
                  
                  if (isNear) {
                      const key = `adlib-${adlib.start}-${j}`;
                      const placement = adlibPlacements.get(key);
                      if (placement) {
                          visibleAdlibs.push({ 
                            adlib, isActive, 
                            rot: placement.rot, 
                            top: placement.top, 
                            left: placement.left, 
                            key 
                          });
                      }
                  }
              });
          }
      });
  }

  if (visibleAdlibs.length === 0) return null;

  return (
      <div className="focused-adlibs-container">
          {visibleAdlibs.map(({ adlib, isActive, rot, top, left, key }) => (
              <div 
                  key={key} 
                  className={`focused-adlib-line ${isActive ? 'active' : ''}`}
                  style={{ 
                      '--adlib-rot': `${rot}deg`,
                      '--adlib-top': `${top}%`,
                      '--adlib-left': `${left}%`
                  }}
                  onClick={(e) => { e.stopPropagation(); handleLineClick(adlib.start); }}
              >
                  {renderLine(adlib, adlib, true, true, time, masterPalette)}
              </div>
          ))}
      </div>
  );
});


const LyricsDisplay = ({
  isEditing, customData, handleDataChange, hasValidSyncData,
  lyricsViewMode, liveParsedLyrics, activePreviewIndex,
  activePreviewRef, handleLineClick, selectedSong, masterPalette
}) => {

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
      const textarea = e.target;
      const newVal = (customData.lyrics || '').substring(0, textarea.selectionStart) + markdownText + (customData.lyrics || '').substring(textarea.selectionEnd);
      handleDataChange({ target: { name: 'lyrics', value: newVal } });
    }
  };

  return (
    <>
      {isEditing ? (
        <textarea 
          name="lyrics" 
          value={customData.lyrics}
          onChange={handleDataChange} 
          onPaste={handlePaste}
          className="lyrics-textarea"
          placeholder="Paste your lyrics here! Copying directly from Word or Google Docs will automatically convert Bold & Italics into Artist Tags!" 
        />
      ) : hasValidSyncData && lyricsViewMode === 'live' ? (
        <div className="live-lyrics-preview">
          {liveParsedLyrics.map((line, i) => (
            <LyricLineWrapper
              key={i}
              lineObj={line}
              savedNode={selectedSong.syncData[i]}
              isMainActive={i === activePreviewIndex}
              viewMode="live"
              activePreviewRef={activePreviewRef}
              handleLineClick={handleLineClick}
              masterPalette={masterPalette}
            />
          ))}
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'focused' ? (
        <div className="focused-lyrics-preview">
          {liveParsedLyrics.map((line, i) => (
             <LyricLineWrapper
                key={i}
                lineObj={line}
                savedNode={selectedSong.syncData[i]}
                isMainActive={i === activePreviewIndex}
                viewMode="focused"
                activePreviewRef={activePreviewRef}
                handleLineClick={handleLineClick}
                masterPalette={masterPalette}
             />
          ))}
          
          <FocusedAdlibsTracker 
             syncData={selectedSong.syncData}
             handleLineClick={handleLineClick}
             masterPalette={masterPalette}
          />
        </div>
      ) : (
        <div className="lyrics-display">
          {liveParsedLyrics.length > 0 ? (
            liveParsedLyrics.map((line, i) => (
              <div key={i}>
                {line.segments ? line.segments.map((seg, idx) => {
                    let inlineColor = seg.color;
                    let inlineIsGradient = seg.isGradient;
                    let inlineGradient = seg.gradient;
                    
                    if (seg.artists && seg.artists.length > 0) {
                      if (seg.artists.length > 1) {
                          inlineIsGradient = true;
                          const c1 = masterPalette[seg.artists[0]] || '#ffffff';
                          const c2 = masterPalette[seg.artists[1]] || '#ffffff';
                          inlineGradient = `linear-gradient(90deg, ${c1}, ${c2})`;
                      } else {
                          inlineColor = masterPalette[seg.artists[0]] || '#ffffff';
                      }
                    }

                    return (
                      <span key={idx} style={inlineIsGradient ? { backgroundImage: inlineGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' } : { color: inlineColor }}>
                          {seg.text}
                      </span>
                    );
                }) : line.text}
              </div>
            ))
          ) : (
            <div className="no-lyrics-empty-state">
              <p>No lyrics found in your Vault.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default LyricsDisplay;
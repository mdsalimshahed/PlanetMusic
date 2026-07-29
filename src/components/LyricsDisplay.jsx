/* --- src/components/LyricsDisplay.jsx --- */
import React, { useEffect, useMemo, useRef } from 'react';

const isCJ = (char) => /[\u4e00-\u9fa5\u3040-\u30ff]/.test(char);

const normalizeTrans = (str) => {
  if (!str) return '';
  return str
    .replace(/[()\[\]{}]/g, '')
    .replace(/[\u02BE\u02BF\u02C0\u02C1]/g, "'") 
    .replace(/،/g, ',') 
    .replace(/؟/g, '?') 
    .replace(/؛/g, ';'); 
};

const isRTLLanguage = (text) => /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);

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

const renderLine = (lineObj, savedNode, isFocused, masterPalette, isPlayingCurrentSong) => {
  const pronString = savedNode?.pronunciation;
  const segments = lineObj.segments || [];
  const isRTL = isRTLLanguage(lineObj.text);

  let displayTranslation = savedNode?.translation || '';
  if (displayTranslation) {
      displayTranslation = displayTranslation.replace(/[()]/g, '');

      const englishPhrases = lineObj.text.match(/[A-Za-z0-9']+/g) || [];
      englishPhrases.forEach(phrase => {
          const cleanPhrase = phrase.trim();
          if (cleanPhrase.length > 0 && /[A-Za-z]/.test(cleanPhrase)) {
              const escaped = cleanPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
              displayTranslation = displayTranslation.replace(regex, '');
          }
      });
      
      displayTranslation = displayTranslation.replace(/^[-.,!?;:\s]+|[-.,!?;:\s]+$/g, '')
                                             .replace(/\s+/g, ' ')
                                             .trim();
      
      if (/^[^a-zA-Z0-9]*$/.test(displayTranslation)) {
          displayTranslation = '';
      }
  }

  const transClass = isFocused ? 'focused-translation' : 'live-translation';
  const basePronStyle = { 
    fontSize: 'var(--dyn-translit-font-size, 0.55em)', 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: '0.5px', 
    textAlign: 'center', 
    marginTop: 'var(--dyn-translit-bottom-padding, 4px)', 
    display: 'inline-block', 
    transition: 'opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease' 
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
          try {
              parsedChunks = JSON.parse(cleanPron);
          } catch(e) {}
      }
  }

  const chars = [];
  let gIdx = 0;
  segments.forEach(seg => {
      const segChars = Array.from(seg.text);
      segChars.forEach(char => {
          chars.push({ char, seg, globalIndex: gIdx++ });
      });
  });

  const currentTime = window.currentAudioTime || 0;

  const renderColoredChar = (c, globalIdx) => {
      if (isFocused && savedNode?.isSplit && savedNode?.adlibs?.some(a => globalIdx >= a.charStart && globalIdx < a.charEnd)) {
          return null;
      }

      let adlibProps = {};
      if (savedNode?.isSplit && !isFocused) {
          const adlib = savedNode.adlibs?.find(a => globalIdx >= a.charStart && globalIdx < a.charEnd);
          if (adlib && adlib.start !== null) {
              const start = adlib.start;
              const end = adlib.end !== null ? adlib.end : start + 5;
                             
              let initialClass = 'adlib-hidden';
              if (isPlayingCurrentSong) {
                  if (currentTime >= start && currentTime <= end) initialClass = 'adlib-active';
                  else if (currentTime > end) initialClass = 'adlib-visible';
              }
              adlibProps = {
                  className: `adlib-node ${initialClass}`,
                  'data-start': start,
                  'data-end': end
              };
          }
      }

      const isPunct = /([.,!?;:"'()\[\]{}\- ]+)/.test(c.char);
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

      let style = { transition: 'opacity 0.3s ease, transform 0.3s ease' };
      if (isGradient) {
          style.backgroundImage = gradientStyle;
          style.WebkitBackgroundClip = 'text';
          style.WebkitTextFillColor = 'transparent';
          style.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 ${isFocused?'30px':'20px'} rgba(255,255,255,0.4))`;
      } else {
          style.color = activeColor;
          style.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 ${isFocused?'30px':'20px'} ${activeColor}80`;
      }

      const isParenthesis = /([()\[\]{}]+)/.test(c.char);
      if (isParenthesis && parsedChunks) {
          let scaleParenthesis = false;
          const char = c.char;
          if (char === '(' || char === '[' || char === '{') {
              const closing = char === '(' ? ')' : char === '[' ? ']' : '}';
              for (let i = globalIdx + 1; i < chars.length; i++) {
                  if (chars[i].char === closing) break;
                  if (!/^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(chars[i].char)) {
                      scaleParenthesis = true; break;
                  }
              }
          } else if (char === ')' || char === ']' || char === '}') {
              const opening = char === ')' ? '(' : char === ']' ? '[' : '{';
              for (let i = globalIdx - 1; i >= 0; i--) {
                  if (chars[i].char === opening) break;
                  if (!/^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(chars[i].char)) {
                      scaleParenthesis = true; break;
                  }
              }
          }
          if (scaleParenthesis) {
              style.display = 'inline-block';
              style.transform = 'scale(1.2) translateY(10%)';
              style.margin = '0 2px';
          }
      }

      return <span key={globalIdx} {...adlibProps} style={style}>{c.char}</span>;
  };

  if (parsedChunks) {
      let alignedChunks = [];
      let pChunkIndex = 0;
      let currentPChunk = parsedChunks[0];
      let currentPChunkConsumed = 0;

      let i = 0;
      while (i < chars.length) {
          let adlib = savedNode?.isSplit ? savedNode.adlibs?.find(a => i >= a.charStart && i < a.charEnd) : null;
          
          if (adlib) {
              let adlibChars = [];
              while (i < adlib.charEnd && i < chars.length) {
                  adlibChars.push(chars[i]);
                  i++;
              }
              alignedChunks.push({
                  type: 'adlib',
                  chars: adlibChars,
                  adlibObj: adlib
              });
          } else {
              if (!currentPChunk) {
                  alignedChunks.push({ type: 'main', chars: [chars[i]], text: chars[i].char, trans: '' });
                  i++;
                  continue;
              }
              
              let chunkChars = [];
              const targetLen = Array.from(currentPChunk.text).length;
              
              while (currentPChunkConsumed < targetLen && i < chars.length) {
                  let isAdlibNext = savedNode?.isSplit ? savedNode.adlibs?.some(a => i >= a.charStart && i < a.charEnd) : false;
                  if (isAdlibNext) break; 
                  
                  chunkChars.push(chars[i]);
                  currentPChunkConsumed++;
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
                  currentPChunk = parsedChunks[pChunkIndex];
                  currentPChunkConsumed = 0;
              }
          }
      }

      const renderedChunks = alignedChunks.map((chunk, chunkIdx) => {
          const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex));
          if (renderedText.every(c => c === null)) return null;
          const groupedText = groupWords(renderedText, chunk.chars);

          if (isRTL) {
              return <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'middle' }}>{groupedText}</span>;
          } else {
              if (chunk.type === 'adlib') {
                  let aPron = chunk.adlibObj?.pronunciation;
                  let aTrans = '';
                  if (typeof aPron === 'string') {
                      if (aPron.startsWith('{')) {
                          try { aTrans = JSON.parse(aPron).full || ''; } catch(e){}
                      } else if (aPron.startsWith('[')) {
                          try { aTrans = JSON.parse(aPron).map(c=>c.trans||c.text).join(''); } catch(e){}
                      } else { aTrans = aPron; }
                  }

                  let adlibTranslation = chunk.adlibObj?.translation || '';
                  if (adlibTranslation) adlibTranslation = adlibTranslation.replace(/[()]/g, '').trim();
                  
                  let adlibProps = {};
                  if (savedNode?.isSplit && !isFocused && chunk.adlibObj?.start !== null) {
                      const start = chunk.adlibObj.start;
                      const end = chunk.adlibObj.end !== null ? chunk.adlibObj.end : start + 5;
                      let initialClass = 'adlib-hidden';
                      if (isPlayingCurrentSong) {
                          if (currentTime >= start && currentTime <= end) initialClass = 'adlib-active';
                          else if (currentTime > end) initialClass = 'adlib-visible';
                      }
                      adlibProps = {
                          className: `adlib-node ${initialClass}`,
                          'data-start': start,
                          'data-end': end
                      };
                  }

                  return (
                      <span key={chunkIdx} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'bottom', marginLeft: '12px', marginRight: '4px' }}>
                          {adlibTranslation && (
                              <span {...adlibProps} className={`chunk-translation ${transClass} ${adlibProps.className || ''}`.trim()} dir="ltr">
                                  {adlibTranslation}
                              </span>
                          )}
                          <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{groupedText}</span>
                          {aTrans ? <span {...adlibProps} className={`pronunciation-text ${adlibProps.className || ''}`.trim()} style={basePronStyle} dir="ltr">{normalizeTrans(aTrans)}</span> : null}
                      </span>
                  );
              }

              if (chunk.type === 'foreign' && chunk.trans) {
                  const cleanTrans = normalizeTrans(chunk.trans);
                  return (
                      <span key={chunkIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'bottom' }}>
                          <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{groupedText}</span>
                          <span className={`pronunciation-text`} style={basePronStyle} dir="ltr">{cleanTrans}</span>
                      </span>
                  );
              } else {
                  return <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'bottom' }}>{groupedText}</span>;
              }
          }
      });

      if (isRTL) {
          let displayPronString = null;
          if (fullTrans) displayPronString = normalizeTrans(fullTrans);
          else displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).join('');

          const blockPronStyle = { ...basePronStyle, marginTop: '8px', display: 'block', textAlign: isFocused ? 'center' : 'start', wordSpacing: '4px', lineHeight: '1.4' };

          return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: isFocused ? 'center' : 'start', width: '100%' }}>
                  <span className="primary-text" style={{ position: 'relative', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'inline-block', verticalAlign: 'bottom', textAlign: isFocused ? 'center' : 'start' }} dir="auto">
                      {displayTranslation && (
                          <span className={`chunk-translation ${transClass}`} dir="ltr">{displayTranslation}</span>
                      )}
                      {renderedChunks}
                  </span>
                  {displayPronString && <div className="pronunciation-text" style={blockPronStyle} dir="ltr">{displayPronString}</div>}
              </div>
          );
      } else {
          const firstForeignIdx = alignedChunks.findIndex(c => c.type === 'foreign');
          const lastForeignIdx = alignedChunks.findLastIndex(c => c.type === 'foreign');

          let finalRendered;

          if (firstForeignIdx !== -1 && displayTranslation) {
              const prefix = renderedChunks.slice(0, firstForeignIdx);
              const foreignBody = renderedChunks.slice(firstForeignIdx, lastForeignIdx + 1);
              const suffix = renderedChunks.slice(lastForeignIdx + 1);

              finalRendered = (
                  <React.Fragment>
                      {prefix}
                      <span style={{ position: 'relative', display: 'inline-block' }}>
                          <span className={`chunk-translation ${transClass}`} dir="ltr">
                              {displayTranslation}
                          </span>
                          {foreignBody}
                      </span>
                      {suffix}
                  </React.Fragment>
              );
          } else {
              finalRendered = renderedChunks;
          }

          return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: isFocused ? 'center' : 'start', width: '100%' }}>
                  <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'inline-block', verticalAlign: 'bottom', textAlign: isFocused ? 'center' : 'start' }} dir="auto">
                      {finalRendered}
                  </span>
              </div>
          );
      }
  } else {
      const renderedChars = chars.map((c) => renderColoredChar(c, c.globalIndex));
      const groupedChars = groupWords(renderedChars, chars);

      const blockPronStyle = { ...basePronStyle, marginTop: '8px', display: 'block', textAlign: isFocused ? 'center' : 'start', wordSpacing: '4px', lineHeight: '1.4' };
             
      let displayPronString = pronString ? normalizeTrans(pronString) : null;

      return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: isFocused ? 'center' : 'start', width: '100%' }}>
              <span className="primary-text" style={{ position: 'relative', display: 'inline-block', textAlign: isFocused ? 'center' : 'start' }} dir="auto">
                  {displayTranslation && (
                      <span className={`chunk-translation ${transClass}`} dir="ltr">{displayTranslation}</span>
                  )}
                  {groupedChars}
              </span>
              {displayPronString && <div className="pronunciation-text" style={blockPronStyle} dir="ltr">{displayPronString}</div>}
          </div>
      );
  }
};

const LyricLineWrapper = React.memo(({ 
  lineObj, savedNode, nextStart, viewMode, handleLineClick, masterPalette, isPlayingCurrentSong 
}) => {
  const start = savedNode?.start ?? 'NaN';
  const end = savedNode?.end ?? 'NaN';

  const renderedContent = useMemo(() => 
    renderLine(lineObj, savedNode, viewMode === 'focused', masterPalette, isPlayingCurrentSong),
    [lineObj, savedNode, viewMode, masterPalette, isPlayingCurrentSong]
  );

  return (
      <div 
          className={`lyric-line-wrapper ${viewMode === 'focused' ? 'focused-line' : 'preview-line'}`}
          data-start={start}
          data-end={end}
          data-next-start={nextStart}
          onClick={() => handleLineClick(start === 'NaN' ? null : start)}
          style={{ cursor: start !== 'NaN' ? 'pointer' : 'default' }}
      >
          {renderedContent}
      </div>
  );
});

const FocusedAdlibsTracker = React.memo(({ syncData, handleLineClick, masterPalette, isPlayingCurrentSong }) => {
  const containerRef = useRef(null);
  const cachedTrackNodesRef = useRef([]);

  const adlibsToRender = useMemo(() => {
      const items = [];
      if (!syncData) return items;
             
      const currentTime = window.currentAudioTime || 0;

      syncData.forEach((node) => {
          if (node?.isSplit && node.adlibs) {
              const lineActiveNames = node.singer?.split(/\s*(?:&|,|\band\b)\s*/i)
                  .filter(Boolean)
                  .map(s => s.trim()) || [];
                                 
              const cols = Math.max(2, lineActiveNames.length);

              node.adlibs.forEach((adlib, j) => {
                  if (adlib.start === null) return;
                                     
                  const randRot = Math.random();
                  const randX = Math.random();
                  const randY = Math.random();
                  const rot = (randRot * 20) - 10;
                                      
                  const adlibNames = adlib.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
                  const primaryAdlibSinger = adlibNames[0];
                                     
                  let col = 0;
                  const row = Math.random() > 0.5 ? 0 : 1;
                  if (lineActiveNames.length > 0 && primaryAdlibSinger) {
                      const idx = lineActiveNames.indexOf(primaryAdlibSinger);
                      if (idx !== -1) {
                          col = (idx - row + lineActiveNames.length) % lineActiveNames.length;
                      } else {
                          col = Math.floor(Math.random() * cols);
                      }
                  } else {
                      col = Math.floor(Math.random() * cols);
                  }
                                     
                  const top = row === 0 ? 12 + (randY * 15) : 68 + (randY * 15);
                  const colCenter = (col + 0.5) * (100 / cols);
                  const left = colCenter + (randX * 20 - 10); 

                  const renderAdlibPure = (adlibObj) => {
                      let aPron = adlibObj?.pronunciation;
                      let aTrans = '';
                      if (typeof aPron === 'string') {
                          if (aPron.startsWith('{')) {
                              try { aTrans = JSON.parse(aPron).full || ''; } catch(e){}
                          } else if (aPron.startsWith('[')) {
                              try { aTrans = JSON.parse(aPron).map(c=>c.trans||c.text).join(''); } catch(e){}
                          } else { aTrans = aPron; }
                      }

                      let adlibTranslation = adlibObj?.translation || '';
                      if (adlibTranslation) adlibTranslation = adlibTranslation.replace(/[()]/g, '').trim();

                      const basePronStyle = { fontSize: 'var(--dyn-translit-font-size, 0.55em)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', marginTop: 'var(--dyn-translit-bottom-padding, 4px)', display: 'inline-block' };

                      const segs = adlibObj.segments || [{ text: adlibObj.text }];
                      const renderedChars = [];
                      let charIdxCounter = 0;

                      segs.forEach((seg) => {
                          let defaultColor = seg.color || '#ffffff';
                          if (seg.artists && seg.artists.length > 0) {
                              defaultColor = masterPalette[seg.artists[0]] || defaultColor;
                          } else if (node.singer) {
                              const activeSingerName = node.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean)[0]?.trim();
                              if (activeSingerName && masterPalette[activeSingerName]) {
                                  defaultColor = masterPalette[activeSingerName];
                              }
                          }

                          Array.from(seg.text).forEach((char) => {
                              const isPunct = /([.,!?;:"'()\[\]{}\- ]+)/.test(char);
                              const activeColor = isPunct ? '#fbbf24' : defaultColor;

                              renderedChars.push(
                                  <span key={charIdxCounter++} style={{ color: activeColor }}>
                                      {char}
                                  </span>
                              );
                          });
                      });

                      return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', position: 'relative' }}>
                              {adlibTranslation && (
                                  <span className="chunk-translation focused-translation" dir="ltr">
                                      {adlibTranslation}
                                  </span>
                              )}
                              <span className="primary-text" style={{ whiteSpace: 'nowrap', display: 'inline-block' }} dir="auto">
                                  {renderedChars}
                              </span>
                              {aTrans ? <span className="pronunciation-text" style={basePronStyle} dir="ltr">{normalizeTrans(aTrans)}</span> : null}
                          </div>
                      );
                  };

                  const rendered = renderAdlibPure(adlib);

                  const start = adlib.start;
                  const end = adlib.end !== null ? adlib.end : start + 5;
                  const isActive = isPlayingCurrentSong && currentTime >= start && currentTime <= end;

                  items.push({
                     key: `adlib-${start}-${j}`,
                     start,
                     end,
                     rot, top, left, rendered, adlib,
                     initialClass: isActive ? 'active' : ''
                  });
              });
          }
      });
      return items;
  }, [syncData, masterPalette, isPlayingCurrentSong]);

  useEffect(() => {
    if (containerRef.current) {
      cachedTrackNodesRef.current = Array.from(containerRef.current.querySelectorAll('.focused-adlib-line')).map(node => ({
          node,
          start: parseFloat(node.dataset.start),
          end: parseFloat(node.dataset.end),
          isActive: node.classList.contains('active')
      }));
    }
  }, [adlibsToRender]);

  useEffect(() => {
      if (!isPlayingCurrentSong) {
          if (cachedTrackNodesRef.current.length > 0) {
              cachedTrackNodesRef.current.forEach(item => {
                  if (item.isActive) {
                      item.node.classList.remove('active');
                      item.isActive = false;
                  }
              });
          }
          return;
      }

      const handleTime = (e) => {
         const time = e.detail;
         const nodes = cachedTrackNodesRef.current;
                   
         for (let i = 0; i < nodes.length; i++) {
             const item = nodes[i];
             const shouldBeActive = time >= item.start && time <= item.end;
                           
             if (shouldBeActive && !item.isActive) {
                 item.node.classList.add('active');
                 item.isActive = true;
             } else if (!shouldBeActive && item.isActive) {
                 item.node.classList.remove('active');
                 item.isActive = false;
             }
         }
      };
             
      window.addEventListener('globalTimeUpdate', handleTime);
      return () => window.removeEventListener('globalTimeUpdate', handleTime);
  }, [isPlayingCurrentSong]);

  if (adlibsToRender.length === 0) return null;

  return (
      <div className="focused-adlibs-container" ref={containerRef}>
          {adlibsToRender.map(item => (
              <div 
                  key={item.key} 
                  className={`focused-adlib-line ${item.initialClass}`}
                  data-start={item.start}
                  data-end={item.end}
                  style={{ 
                      '--adlib-rot': `${item.rot}deg`,
                      '--adlib-top': `${item.top}%`,
                      '--adlib-left': `${item.left}%`
                  }}
                  onClick={(e) => { e.stopPropagation(); handleLineClick(item.adlib.start); }}
              >
                  {item.rendered}
              </div>
          ))}
      </div>
  );
});

const LyricsDisplay = ({
  isEditing, customData, handleDataChange, hasValidSyncData,
  lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, masterPalette, currentTrack,
  isPlaying, settings
}) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
  const eqBarsRef = useRef([]);
  
  const isPlayingCurrentSong = Boolean(currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId);

  useEffect(() => {
    let rafId;
    const fadeOutTime = settings?.eqFadeOutTime ?? 500;
    
    const renderEQ = () => {
      if (isPlaying && isPlayingCurrentSong && window.globalAudioAnalyser && window.globalFreqData) {
        window.globalAudioAnalyser.getByteFrequencyData(window.globalFreqData);
        const bars = eqBarsRef.current;
        for (let i = 0; i < bars.length; i++) {
          if (bars[i]) {
            const raw = window.globalFreqData[i];
            const scale = 0.05 + (raw / 255) * 0.95;
            
            bars[i].style.transition = 'transform 0.05s ease-out';
            bars[i].style.transform = `scaleY(${scale})`;
          }
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
    renderEQ();
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isPlayingCurrentSong, settings?.eqFadeOutTime]);

  useEffect(() => {
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
    }
  }, [liveParsedLyrics, lyricsViewMode, selectedSong?.syncData]);

  useEffect(() => {
    if (lyricsViewMode !== 'live' && lyricsViewMode !== 'focused') return;

    const handleTime = (e) => {
        if (!isPlayingCurrentSong) return;

        const time = e.detail;
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

    window.addEventListener('globalTimeUpdate', handleTime);
         
    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTime({ detail: initialTime });
    } else {
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
    }

    return () => window.removeEventListener('globalTimeUpdate', handleTime);

  }, [lyricsViewMode, isPlayingCurrentSong, currentTrack]);

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
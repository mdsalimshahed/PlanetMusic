/* --- src/components/LyricsDisplay.jsx --- */
import React, { useState, useEffect } from 'react';

const FloatingAdlib = ({ adlib, isAdlibActive, handleLineClick, renderLine, masterPalette, allPotentialSingers }) => {
  const [pos, setPos] = useState({ top: '20%', left: '50%' });
  
  const singersStr = allPotentialSingers.join('|');

  useEffect(() => {
    if (isAdlibActive) {
      const singersArray = singersStr.split('|');
      const activeNames = adlib.singer ? adlib.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) : [];
      
      let topMin = 15, topMax = 85, leftMin = 10, leftMax = 90;
      
      if (activeNames.length === 1 && singersArray.length > 1) {
          const sIndex = singersArray.indexOf(activeNames[0]);
          if (sIndex === 0) { 
              if (Math.random() > 0.5) { topMin = 15; topMax = 40; leftMin = 10; leftMax = 40; }
              else { topMin = 60; topMax = 85; leftMin = 60; leftMax = 90; }
          } else { 
              if (Math.random() > 0.5) { topMin = 15; topMax = 40; leftMin = 60; leftMax = 90; }
              else { topMin = 60; topMax = 85; leftMin = 10; leftMax = 40; }
          }
      } else {
          const quad = Math.floor(Math.random() * 4);
          if (quad === 0) { topMin = 15; topMax = 40; leftMin = 10; leftMax = 40; }
          else if (quad === 1) { topMin = 15; topMax = 40; leftMin = 60; leftMax = 90; }
          else if (quad === 2) { topMin = 60; topMax = 85; leftMin = 10; leftMax = 40; }
          else { topMin = 60; topMax = 85; leftMin = 60; leftMax = 90; }
      }
      
      const top = Math.floor(Math.random() * (topMax - topMin) + topMin);
      const left = Math.floor(Math.random() * (leftMax - leftMin) + leftMin);
      setPos({ top: `${top}%`, left: `${left}%` });
    }
  }, [isAdlibActive, adlib.singer, singersStr]);

  return (
    <div 
      className={`floating-adlib ${isAdlibActive ? 'active' : ''}`}
      style={{ 
        top: pos.top, 
        left: pos.left,
        transform: isAdlibActive ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.9)'
      }}
      onClick={(e) => { e.stopPropagation(); handleLineClick(adlib.start); }}
    >
      {renderLine(adlib, adlib, isAdlibActive, true)}
    </div>
  );
};

const LyricsDisplay = ({
  isEditing, customData, handleDataChange, hasValidSyncData,
  lyricsViewMode, liveParsedLyrics, activePreviewIndex,
  activePreviewRef, handleLineClick, selectedSong, globalProgress,
  masterPalette, allPotentialSingers
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

  const activePronStyle = { fontSize: '0.55em', color: '#ffffff', opacity: 0.9, textShadow: 'none', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' };
  const inactivePronStyle = { fontSize: '0.55em', color: 'rgba(255, 255, 255, 0.2)', textShadow: 'none', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' };

  const activeAdlibs = [];
  if (hasValidSyncData && lyricsViewMode === 'focused') {
      selectedSong.syncData.forEach(node => {
          if (node?.isSplit && node.adlibs) {
              node.adlibs.forEach(adlib => {
                  if (adlib.start !== null && globalProgress >= adlib.start && (adlib.end !== null ? globalProgress <= adlib.end : true)) {
                      activeAdlibs.push(adlib);
                  }
              });
          }
      });
  }

  const renderLine = (lineObj, savedNode, isActive, isFocused = false) => {
    const pronString = savedNode?.pronunciation;
    const segments = lineObj.segments || [];

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

        let isCharActive = isActive;
        if (savedNode?.isSplit && !isFocused) {
            const adlib = savedNode.adlibs?.find(a => cIdx >= a.charStart && cIdx < a.charEnd);
            if (adlib) {
                isCharActive = adlib.start !== null && globalProgress >= adlib.start && (adlib.end !== null ? globalProgress <= adlib.end : true);
            } else {
                isCharActive = savedNode.start !== null && globalProgress >= savedNode.start && (savedNode.end !== null ? globalProgress <= savedNode.end : true);
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

        let style = {};
        if (isCharActive) {
            if (isGradient) style = { backgroundImage: gradientStyle, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 0 ${isFocused?'30px':'20px'} rgba(255,255,255,0.4))` };
            else style = { color: activeColor, textShadow: `0 0 ${isFocused?'30px':'20px'} ${activeColor}80` };
        } else {
            style = { color: 'rgba(255, 255, 255, 0.2)', transition: 'color 0.1s ease, text-shadow 0.1s ease' };
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
                style.transform = 'scale(1.2) translateY(10%)';
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

            let chunkIsActive = isActive;
            if (savedNode?.isSplit && !isFocused) {
               const adlib = savedNode.adlibs?.find(a => firstCharIdx >= a.charStart && firstCharIdx < a.charEnd);
               if (adlib) {
                   chunkIsActive = adlib.start !== null && globalProgress >= adlib.start && (adlib.end !== null ? globalProgress <= adlib.end : true);
               } else {
                   chunkIsActive = savedNode.start !== null && globalProgress >= savedNode.start && (savedNode.end !== null ? globalProgress <= savedNode.end : true);
               }
            }

            const currentPronStyle = chunkIsActive ? activePronStyle : inactivePronStyle;

            if (chunk.type === 'foreign' && chunk.trans) {
                const cleanTrans = chunk.trans.replace(/[()\[\]{}]/g, '');
                return (
                    <span key={chunkIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle' }}>
                        <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{renderedText}</span>
                        <span style={currentPronStyle}>{cleanTrans}</span>
                    </span>
                );
            } else {
                return <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'middle' }}>{renderedText}</span>;
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
        const blockPronStyle = { ...(isActive ? activePronStyle : inactivePronStyle), marginTop: '8px', display: 'block', textAlign: isFocused ? 'center' : 'left', wordSpacing: '4px', lineHeight: '1.4' };
        
        let displayPronString = pronString;
        if (pronString) {
             displayPronString = pronString.replace(/[()\[\]{}]/g, '');
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: isFocused ? 'center' : 'left', width: '100%' }}>
                <span className="primary-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', display: 'inline-block' }}>{renderedChars}</span>
                {displayPronString && <div style={blockPronStyle}>{displayPronString}</div>}
            </div>
        );
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
          {liveParsedLyrics.map((line, i) => {
            const isActive = i === activePreviewIndex;
            const savedNode = selectedSong.syncData[i];
            const seekTarget = savedNode ? savedNode.start : null;
            
            const isLineVisuallyActive = isActive || (savedNode?.isSplit && savedNode.adlibs?.some(a => globalProgress >= a.start && (a.end !== null ? globalProgress <= a.end : true)));

            return (
              <div 
                key={i} 
                ref={isActive ? activePreviewRef : null}
                className={`preview-line ${isLineVisuallyActive ? 'active' : ''}`}
                onClick={() => handleLineClick(seekTarget)}
                style={{ cursor: seekTarget !== null ? 'pointer' : 'default' }}
              >
                {renderLine(line, savedNode, isLineVisuallyActive, false)}
              </div>
            );
          })}
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'focused' ? (
        <div className="focused-lyrics-preview">
          {liveParsedLyrics.map((line, i) => {
            const isActive = i === activePreviewIndex;
            const savedNode = selectedSong.syncData[i];
            const seekTarget = savedNode ? savedNode.start : null;

            return (
              <div 
                key={i}
                ref={isActive ? activePreviewRef : null}
                className={`focused-line ${isActive ? 'active' : ''}`}
                onClick={() => handleLineClick(seekTarget)}
              >
                {renderLine(line, savedNode, isActive, true)}
              </div>
            );
          })}
          
          <div className="focused-adlibs-container">
            {activeAdlibs.map((adlib, j) => (
              <div 
                key={`adlib-${j}`} 
                className="focused-adlib-line active"
                onClick={(e) => { e.stopPropagation(); handleLineClick(adlib.start); }}
              >
                {renderLine(adlib, adlib, true, true)}
              </div>
            ))}
          </div>
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
                      <span key={idx} style={inlineIsGradient ? { backgroundImage: inlineGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: inlineColor }}>
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
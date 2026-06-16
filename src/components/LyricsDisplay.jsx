/* --- src/components/LyricsDisplay.jsx --- */
import React from 'react';

const LyricsDisplay = ({
  isEditing, customData, handleDataChange, hasValidSyncData,
  lyricsViewMode, liveParsedLyrics, activePreviewIndex,
  activePreviewRef, handleLineClick, selectedSong, globalProgress,
  debugInfo
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

  const englishRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~‘’“”\–\—]+$/;

  const renderLine = (lineObj, savedNode, isActive, isFocused = false, isKaraoke = false) => {
    const pronString = savedNode?.pronunciation;
    const pronWords = pronString && typeof pronString === 'string' ? pronString.trim().split(/\s+/).filter(Boolean) : [];
    const segments = lineObj.segments || [];
    const wordSync = savedNode?.wordSync;

    const pronStyle = isActive 
        ? { fontSize: '0.55em', color: '#ffffff', opacity: 0.9, textShadow: 'none', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' }
        : { fontSize: '0.55em', color: 'rgba(255, 255, 255, 0.2)', textShadow: 'none', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' };

    const chars = [];
    segments.forEach(seg => {
        for (let char of seg.text) {
            chars.push({ char, seg });
        }
    });

    const renderColoredChar = (c, cIdx, isWordActive = isActive) => {
        const isPunct = /([.,!?;:"'()\[\]{}\-—–~¿¡«»“”‘’]+)/.test(c.char);
        const activeColor = isPunct ? '#fbbf24' : (c.seg.color || '#ffffff');
        const isGradient = !isPunct && c.seg.isGradient;

        let style = {};
        if (isWordActive) {
            if (isGradient) style = { backgroundImage: c.seg.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 0 ${isFocused?'30px':'20px'} rgba(255,255,255,0.4))` };
            else style = { color: activeColor, textShadow: `0 0 ${isFocused?'30px':'20px'} ${activeColor}80` };
        } else {
            style = { color: 'rgba(255, 255, 255, 0.2)', transition: 'color 0.1s ease, text-shadow 0.1s ease' };
        }
        return <span key={cIdx} style={style}>{c.char}</span>;
    };

    if (isKaraoke && wordSync && wordSync.length > 0) {
        let charOffset = 0;
        let pronIdx = 0;

        const renderedKaraokeWords = wordSync.map((wordObj, wIdx) => {
            const isWordActive = globalProgress >= wordObj.start;
            const wordLen = wordObj.text.length;
            const wordChars = chars.slice(charOffset, charOffset + wordLen);
            charOffset += wordLen;

            let splitIdx = wordChars.length;
            while (splitIdx > 0 && /\s/.test(wordChars[splitIdx - 1].char)) {
                splitIdx--;
            }
            const coreChars = wordChars.slice(0, splitIdx);
            const spaceChars = wordChars.slice(splitIdx);

            const coreTextStr = coreChars.map(c => c.char).join('');
            const isEnglishWord = coreTextStr ? englishRegex.test(coreTextStr) : true;
            
            let p = null;
            // Always increment the pointer so we stay perfectly aligned with the translation array
            if (pronIdx < pronWords.length) {
                p = pronWords[pronIdx];
                pronIdx++;
            }
            
            // Discard the translation if the word is English
            if (isEnglishWord) {
                p = null;
            }

            const renderedCore = coreChars.map((c, i) => renderColoredChar(c, i, isWordActive));
            const renderedSpaces = spaceChars.map((c, i) => renderColoredChar(c, i + coreChars.length, isWordActive));

            return (
                <React.Fragment key={wIdx}>
                    {p ? (
                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                            <span style={{ display: 'inline-block' }}>{renderedCore}</span>
                            <span style={pronStyle}>{p}</span>
                        </span>
                    ) : (
                        <span style={{ verticalAlign: 'top' }}>{renderedCore}</span>
                    )}
                    {renderedSpaces.length > 0 && <span style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{renderedSpaces}</span>}
                </React.Fragment>
            );
        });

        return (
            <div style={{ textAlign: isFocused ? 'center' : 'left', width: '100%' }}>
                <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'inline-block' }}>
                    {renderedKaraokeWords}
                </span>
            </div>
        );
    }

    // --- Standard Live/Focused View ---
    const tokens = [];
    let currentToken = [];
    let isSpace = false;
    
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const charIsSpace = /\s/.test(c.char);
        
        if (i === 0) isSpace = charIsSpace;
        
        if (charIsSpace === isSpace) {
            currentToken.push(c);
        } else {
            tokens.push({ type: isSpace ? 'space' : 'word', data: currentToken, text: currentToken.map(x=>x.char).join('') });
            currentToken = [c];
            isSpace = charIsSpace;
        }
    }
    if (currentToken.length > 0) tokens.push({ type: isSpace ? 'space' : 'word', data: currentToken, text: currentToken.map(x=>x.char).join('') });

    const actualWordsCount = tokens.filter(t => t.type === 'word').length;
    const canAlignWords = pronWords.length > 0 && pronWords.length === actualWordsCount;

    if (canAlignWords) {
        let pronIdx = 0;
        const renderedTokens = tokens.map((token, tIdx) => {
            const renderedChars = token.data.map((c, cIdx) => renderColoredChar(c, cIdx, isActive));

            if (token.type === 'space') {
                return <span key={tIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{renderedChars}</span>;
            } else {
                const isEnglishWord = englishRegex.test(token.text);
                
                let p = null;
                // Always consume the translation token to keep the arrays perfectly aligned
                if (pronIdx < pronWords.length) {
                    p = pronWords[pronIdx];
                    pronIdx++;
                }

                // But don't display it if it's an English word
                if (isEnglishWord) {
                    p = null;
                }

                if (p) {
                    return (
                        <span key={tIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                            <span style={{ display: 'inline-block' }}>{renderedChars}</span>
                            <span style={pronStyle}>{p}</span>
                        </span>
                    );
                } else {
                    return <span key={tIdx} style={{ verticalAlign: 'top' }}>{renderedChars}</span>;
                }
            }
        });

        return (
            <div style={{ textAlign: isFocused ? 'center' : 'left', width: '100%' }}>
                <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'inline-block' }}>
                    {renderedTokens}
                </span>
            </div>
        );
    } else {
        const renderedChars = chars.map((c, cIdx) => renderColoredChar(c, cIdx, isActive));
        const blockPronStyle = { ...pronStyle, marginTop: '8px', display: 'block', textAlign: isFocused ? 'center' : 'left', wordSpacing: '4px', lineHeight: '1.4' };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: isFocused ? 'center' : 'left', width: '100%' }}>
                <span className="primary-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{renderedChars}</span>
                {pronString && <div style={blockPronStyle}>{pronString}</div>}
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
      ) : hasValidSyncData && lyricsViewMode === 'debug' ? (
        <div className="debug-lyrics-preview">
          <h3 style={{ color: 'white', marginBottom: '8px' }}>
            SOURCE: <span style={{ color: '#fbbf24' }}>{debugInfo.source}</span>
          </h3>
          <h4 style={{ color: '#b388eb', marginTop: '16px', marginBottom: '8px' }}>RAW API DATA:</h4>
          <pre className="debug-json" style={{ color: '#9ca3af' }}>{JSON.stringify(debugInfo.rawData, null, 2)}</pre>
          <h4 style={{ color: '#b388eb', marginTop: '24px', marginBottom: '8px' }}>PARSED SYNCDATA OUTPUT:</h4>
          <pre className="debug-json" style={{ color: '#4ade80' }}>{JSON.stringify(selectedSong.syncData, null, 2)}</pre>
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'karaoke' ? (
        <div className="live-lyrics-preview">
          {liveParsedLyrics.map((line, i) => {
            const isActive = i === activePreviewIndex;
            const savedNode = selectedSong.syncData[i];
            const seekTarget = savedNode ? savedNode.start : null;

            return (
              <div 
                key={i} 
                ref={isActive ? activePreviewRef : null}
                className={`preview-line ${isActive ? 'active' : ''}`}
                onClick={() => handleLineClick(seekTarget)}
                style={{ cursor: seekTarget !== null ? 'pointer' : 'default' }}
              >
                {renderLine(line, savedNode, isActive, false, true)}
              </div>
            );
          })}
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'live' ? (
        <div className="live-lyrics-preview">
          {liveParsedLyrics.map((line, i) => {
            const isActive = i === activePreviewIndex;
            const savedNode = selectedSong.syncData[i];
            const seekTarget = savedNode ? savedNode.start : null;

            return (
              <div 
                key={i} 
                ref={isActive ? activePreviewRef : null}
                className={`preview-line ${isActive ? 'active' : ''}`}
                onClick={() => handleLineClick(seekTarget)}
                style={{ cursor: seekTarget !== null ? 'pointer' : 'default' }}
              >
                {renderLine(line, savedNode, isActive, false, false)}
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
                {renderLine(line, savedNode, isActive, true, false)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lyrics-display">
          {liveParsedLyrics.length > 0 ? (
            liveParsedLyrics.map((line, i) => (
              <div key={i}>
                {line.segments ? line.segments.map((seg, idx) => (
                    <span key={idx} style={seg.isGradient ? { backgroundImage: seg.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: seg.color }}>
                        {seg.text}
                    </span>
                )) : line.text}
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
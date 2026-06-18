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

  const renderLine = (lineObj, savedNode, isActive, isFocused = false, isKaraoke = false) => {
    const pronString = savedNode?.pronunciation;
    const segments = lineObj.segments || [];
    const wordSync = savedNode?.wordSync;

    const pronStyle = isActive 
        ? { fontSize: '0.55em', color: '#ffffff', opacity: 0.9, textShadow: 'none', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' }
        : { fontSize: '0.55em', color: 'rgba(255, 255, 255, 0.2)', textShadow: 'none', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.1s ease', textAlign: 'center', marginTop: '4px' };

    // Decode chunks from database
    let parsedChunks = null;
    if (typeof pronString === 'string') {
        try {
            const parsed = JSON.parse(pronString);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
                parsedChunks = parsed;
            }
        } catch (e) {
            parsedChunks = null; // Legacy string format fallback
        }
    }

    // Flatten segments into discrete character objects
    const chars = [];
    segments.forEach(seg => {
        for (let char of seg.text) {
            chars.push({ char, seg });
        }
    });

    // Handle Karaoke start timings on a per-character basis
    if (isKaraoke && wordSync && wordSync.length > 0) {
        let charOffset = 0;
        let lastStartTime = wordSync.length > 0 ? wordSync[0].start : 0;
        
        wordSync.forEach(wordObj => {
            for (let i = 0; i < wordObj.text.length; i++) {
                if (chars[charOffset]) {
                    chars[charOffset].startTime = wordObj.start;
                    lastStartTime = wordObj.start;
                }
                charOffset++;
            }
        });
        
        // Fill trailing characters (like spaces) with the last known start time
        while (charOffset < chars.length) {
            if (chars[charOffset]) chars[charOffset].startTime = lastStartTime;
            charOffset++;
        }
    }

    const renderColoredChar = (c, cIdx, isCharActive) => {
        const isPunct = /([.,!?;:"'()\[\]{}\-—–~¿¡«»“”‘’]+)/.test(c.char);
        const activeColor = isPunct ? '#fbbf24' : (c.seg.color || '#ffffff');
        const isGradient = !isPunct && c.seg.isGradient;

        let style = {};
        if (isCharActive) {
            if (isGradient) style = { backgroundImage: c.seg.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 0 ${isFocused?'30px':'20px'} rgba(255,255,255,0.4))` };
            else style = { color: activeColor, textShadow: `0 0 ${isFocused?'30px':'20px'} ${activeColor}80` };
        } else {
            style = { color: 'rgba(255, 255, 255, 0.2)', transition: 'color 0.1s ease, text-shadow 0.1s ease' };
        }
        return <span key={cIdx} style={style}>{c.char}</span>;
    };

    if (parsedChunks) {
        let charOffset = 0;
        
        const renderedChunks = parsedChunks.map((chunk, chunkIdx) => {
            const chunkLen = chunk.text.length;
            const chunkChars = chars.slice(charOffset, charOffset + chunkLen);
            charOffset += chunkLen;

            const renderedText = chunkChars.map((c, i) => {
                const isCharActive = isKaraoke ? (c.startTime !== undefined ? globalProgress >= c.startTime : isActive) : isActive;
                return renderColoredChar(c, i, isCharActive);
            });

            // If foreign chunk, stack original text on top, transliteration directly below
            if (chunk.type === 'foreign' && chunk.trans) {
                return (
                    <span key={chunkIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'bottom' }}>
                        <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{renderedText}</span>
                        <span style={pronStyle}>{chunk.trans}</span>
                    </span>
                );
            } else {
                // If English chunk, render normal text without any transliteration underlay
                return <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'bottom' }}>{renderedText}</span>;
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
        // Fallback for legacy database strings
        const renderedChars = chars.map((c, i) => {
            const isCharActive = isKaraoke ? (c.startTime !== undefined ? globalProgress >= c.startTime : isActive) : isActive;
            return renderColoredChar(c, i, isCharActive);
        });
        
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
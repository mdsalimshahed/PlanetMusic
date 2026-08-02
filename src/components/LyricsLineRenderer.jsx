/* --- src/components/LyricsLineRenderer.jsx --- */
import React, { useMemo } from 'react';

const isCJ = (char) => /[\u4e00-\u9fa5\u3040-\u30ff]/.test(char);
const isPunctuationChar = (char) => /^[\p{P}\p{S}\s]+$/u.test(char);

const getGraphemes = (str) => {
  if (!str) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), s => s.segment);
  }
  return str.match(/[\u0900-\u097F][\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963]*|./gu) || Array.from(str);
};

export const normalizeTrans = (str) => {
  if (!str) return '';
  return str
    .replace(/[()\[\]{}]/g, '')
    .replace(/[\u02BE\u02BF\u02C0\u02C1]/g, "'")
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanTranslationText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/[()]/g, '')
    .trim()
    .replace(/[\p{P}\p{S}]+$/gu, '')
    .trim();
};

export const renderFormattedTranslation = (text) => {
  if (!text) return null;
  const parts = text.split(/([\p{P}\p{S}\s]+)/u);
  return parts.map((part, pIdx) => {
    if (!part) return null;
    const isPunct = /^[\p{P}\p{S}\s]+$/u.test(part);
    if (isPunct && part.trim() !== '') {
      return (
        <span key={pIdx} style={{ color: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.6)' }}>
          {part}
        </span>
      );
    }
    return <span key={pIdx}>{part}</span>;
  });
};

const isRTLLanguage = (text) => /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);

const groupWords = (elements, charData, isFocused) => {
  const words = [];
  let currentWord = [];
  
  for (let i = 0; i < elements.length; i++) {
    if (!elements[i]) {
      if (currentWord.length > 0) {
        words.push(
          <span key={`w-${i}`} style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
            {currentWord}
          </span>
        );
        currentWord = [];
      }
      words.push(elements[i]);
      continue;
    }
    
    const char = charData[i].char;
    
    if (/\s/.test(char) || isCJ(char)) {
      if (currentWord.length > 0) {
        words.push(
          <span key={`w-${i}`} style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
            {currentWord}
          </span>
        );
        currentWord = [];
      }
      words.push(
        <span key={`s-${i}`} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      );
    } else {
      currentWord.push(elements[i]);
    }
  }
  
  if (currentWord.length > 0) {
    words.push(
      <span key="w-end" style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
        {currentWord}
      </span>
    );
  }
  
  return words;
};

const alignChunksWithTransliteration = (chars, parsedChunks, fullTrans, renderColoredChar, basePronStyle, isRTL, isFocused) => {
  let alignedChunks = [];
  if (parsedChunks && Array.isArray(parsedChunks)) {
    let charIdxPointer = 0;
    parsedChunks.forEach((chunk) => {
      const chunkText = chunk.text || '';
      const chunkGraphemeCount = getGraphemes(chunkText).length;
      const chunkChars = chars.slice(charIdxPointer, charIdxPointer + chunkGraphemeCount);
      charIdxPointer += chunkGraphemeCount;
      if (chunkChars.length > 0) {
        alignedChunks.push({
          type: chunk.type,
          trans: chunk.trans,
          chars: chunkChars
        });
      }
    });
    if (charIdxPointer < chars.length) {
      alignedChunks.push({
        type: 'main',
        trans: '',
        chars: chars.slice(charIdxPointer)
      });
    }
  } else {
    alignedChunks = [{
      type: 'main',
      trans: fullTrans || '',
      chars: chars
    }];
  }

  return alignedChunks.map((chunk, chunkIdx) => {
    const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex));
    if (renderedText.every(c => c === null)) return null;
    
    const groupedText = groupWords(renderedText, chunk.chars, isFocused);
    if (isRTL) {
      return (
        <span key={chunkIdx} style={{ whiteSpace: isFocused ? 'normal' : 'pre-wrap', verticalAlign: 'middle', maxWidth: '100%' }}>
          {groupedText}
        </span>
      );
    } else {
      if (chunk.trans && chunk.trans.trim()) {
        const cleanTrans = normalizeTrans(chunk.trans);
        return (
          <span
            key={chunkIdx}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              verticalAlign: 'bottom',
              margin: '0 2px',
              maxWidth: '100%'
            }}
          >
            <span style={{ display: 'inline-block', whiteSpace: isFocused ? 'normal' : 'pre-wrap', maxWidth: '100%' }}>{groupedText}</span>
            {cleanTrans ? (
              <span className="pronunciation-text" style={basePronStyle} dir="ltr">
                {renderFormattedTranslation(cleanTrans)}
              </span>
            ) : null}
          </span>
        );
      } else {
        return (
          <span key={chunkIdx} style={{ whiteSpace: isFocused ? 'normal' : 'pre-wrap', verticalAlign: 'bottom', display: 'inline-block', maxWidth: '100%' }}>
            {groupedText}
          </span>
        );
      }
    }
  }).filter(Boolean);
};

const renderLine = (lineObj, savedNode, isFocused, masterPalette, isPlayingCurrentSong) => {
  const pronString = savedNode?.pronunciation || lineObj?.pronunciation;
  const segments = lineObj.segments || [];
  const isRTL = isRTLLanguage(lineObj.text || '');
  let rawTranslation = cleanTranslationText(savedNode?.translation || lineObj?.translation);
  
  const normalizeForMatch = (str) =>
    String(str || '')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]/gu, '')
      .trim();

  const cleanMainText = normalizeForMatch(lineObj?.text);
  const cleanTransText = normalizeForMatch(rawTranslation);
  const displayTranslation = (cleanMainText && cleanMainText === cleanTransText) ? '' : rawTranslation;
  const transClass = isFocused ? 'focused-translation' : 'live-translation';
  
  const basePronStyle = {
    fontSize: 'var(--dyn-translit-font-size, 0.55em)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'center',
    marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
    display: 'inline-block'
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
      } catch (e) {}
    } else if (cleanPron.startsWith('[')) {
      try {
        parsedChunks = JSON.parse(cleanPron);
      } catch (e) {}
    }
  }

  const chars = [];
  let gIdx = 0;
  segments.forEach(seg => {
    const segChars = getGraphemes(seg.text);
    segChars.forEach(char => {
      chars.push({ char, seg, globalIndex: gIdx++ });
    });
  });

  const currentTime = window.currentAudioTime || 0;

  // --- SPLIT LINE PATH FOR LIVE MODE (MAIN + ADLIBS IN SEPARATE CONTAINERS) ---
  if (!isFocused && savedNode?.isSplit && savedNode?.adlibs?.length > 0) {
    const blocks = [];
    let currentBlock = null;
    chars.forEach((c) => {
      const adlibIndex = savedNode.adlibs.findIndex(a => c.globalIndex >= a.charStart && c.globalIndex < a.charEnd);
      const isAdlibChar = adlibIndex !== -1;
      const adlibObj = isAdlibChar ? savedNode.adlibs[adlibIndex] : null;
      if (!currentBlock) {
        currentBlock = { isAdlib: isAdlibChar, adlibObj, chars: [c] };
      } else if (currentBlock.isAdlib === isAdlibChar && currentBlock.adlibObj === adlibObj) {
        currentBlock.chars.push(c);
      } else {
        blocks.push(currentBlock);
        currentBlock = { isAdlib: isAdlibChar, adlibObj, chars: [c] };
      }
    });
    if (currentBlock) blocks.push(currentBlock);

    const renderColoredCharForSplit = (c, globalIdx) => {
      const isPunct = isPunctuationChar(c.char);
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
        style.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`;
      } else {
        style.color = activeColor;
        style.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 20px ${activeColor}80`;
      }
      return <span key={globalIdx} style={style}>{c.char === ' ' ? '\u00A0' : c.char}</span>;
    };

    const renderedBlocks = blocks.map((blk, bIdx) => {
      if (blk.isAdlib && blk.adlibObj) {
        const adlib = blk.adlibObj;
        const start = adlib.start;
        const end = adlib.end !== null ? adlib.end : (start !== null ? start + 5 : null);
        let initialClass = 'adlib-hidden';
        if (isPlayingCurrentSong && start !== null) {
          if (currentTime >= start && currentTime <= end) initialClass = 'adlib-active';
          else if (currentTime > end) initialClass = 'adlib-visible';
        }
        
        let aParsedChunks = null;
        let aFullTrans = null;
        if (adlib.pronunciation) {
          if (typeof adlib.pronunciation === 'string') {
            if (adlib.pronunciation.startsWith('{')) {
              try {
                const p = JSON.parse(adlib.pronunciation);
                aParsedChunks = p.chunks;
                aFullTrans = p.full;
              } catch (e) {}
            } else if (adlib.pronunciation.startsWith('[')) {
              try { aParsedChunks = JSON.parse(adlib.pronunciation); } catch (e) {}
            } else {
              aFullTrans = adlib.pronunciation;
            }
          }
        }
        const adlibTranslation = cleanTranslationText(adlib.translation);
        
        const alignedAdlibJSX = alignChunksWithTransliteration(
          blk.chars,
          aParsedChunks,
          aFullTrans,
          renderColoredCharForSplit,
          basePronStyle,
          isRTL,
          isFocused
        );

        return (
          <span
            key={`adlib-block-${bIdx}`}
            className={`adlib-container adlib-node ${initialClass}`}
            data-start={start !== null ? start : 'NaN'}
            data-end={end !== null ? end : 'NaN'}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              margin: '0 6px',
              verticalAlign: 'bottom'
            }}
          >
            {adlibTranslation ? (
              <span className={`chunk-translation ${transClass}`} dir="ltr">
                {renderFormattedTranslation(adlibTranslation)}
              </span>
            ) : null}
            <span
              className="primary-text"
              style={{
                whiteSpace: 'pre-wrap',
                display: 'inline-flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                verticalAlign: 'bottom'
              }}
              dir="auto"
            >
              {alignedAdlibJSX}
            </span>
          </span>
        );
      } else {
        const alignedMainJSX = alignChunksWithTransliteration(
          blk.chars,
          parsedChunks,
          fullTrans,
          renderColoredCharForSplit,
          basePronStyle,
          isRTL,
          isFocused
        );

        return (
          <span
            key={`main-block-${bIdx}`}
            className="main-container"
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              margin: '0 4px',
              verticalAlign: 'bottom'
            }}
          >
            {displayTranslation && bIdx === 0 ? (
              <span className={`chunk-translation ${transClass}`} dir="ltr">
                {renderFormattedTranslation(displayTranslation)}
              </span>
            ) : null}
            <span
              className="primary-text"
              style={{
                whiteSpace: 'pre-wrap',
                display: 'inline-flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                verticalAlign: 'bottom'
              }}
              dir="auto"
            >
              {alignedMainJSX}
            </span>
          </span>
        );
      }
    });

    let displayPronString = null;
    if (isRTL) {
      if (fullTrans) {
        displayPronString = normalizeTrans(fullTrans);
      } else if (parsedChunks) {
        displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).filter(Boolean).join(' ');
      } else if (pronString && !pronString.startsWith('{') && !pronString.startsWith('[')) {
        displayPronString = normalizeTrans(pronString);
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
        <span
          className="primary-text"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '8px',
            position: 'relative',
            textAlign: 'left',
            direction: 'ltr',
            width: '100%'
          }}
        >
          {renderedBlocks}
        </span>
        {displayPronString && (
          <div className="pronunciation-text" style={{ ...basePronStyle, marginTop: '8px', display: 'block', textAlign: 'left' }} dir="ltr">
            {renderFormattedTranslation(displayPronString)}
          </div>
        )}
      </div>
    );
  }

  // --- STANDARD PATH (UNSPLIT / FOCUSED VIEW) ---
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
    
    const isPunct = isPunctuationChar(c.char);
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
      style.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 ${isFocused ? '30px' : '20px'} rgba(255,255,255,0.4))`;
    } else {
      style.color = activeColor;
      style.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 ${isFocused ? '30px' : '20px'} ${activeColor}80`;
    }
    return <span key={globalIdx} {...adlibProps} style={style}>{c.char === ' ' ? '\u00A0' : c.char}</span>;
  };

  const alignedJSX = alignChunksWithTransliteration(
    chars,
    parsedChunks,
    fullTrans,
    renderColoredChar,
    basePronStyle,
    isRTL,
    isFocused
  );

  let shouldRenderBlockPron = false;
  let displayPronString = null;
  if (isRTL) {
    if (fullTrans) {
      displayPronString = normalizeTrans(fullTrans);
      shouldRenderBlockPron = true;
    } else if (parsedChunks) {
      displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).filter(Boolean).join(' ');
      shouldRenderBlockPron = true;
    } else if (pronString && !pronString.startsWith('{') && !pronString.startsWith('[')) {
      displayPronString = normalizeTrans(pronString);
      shouldRenderBlockPron = true;
    }
  }

  const lineTextAlign = isFocused ? 'center' : 'left';
  const blockPronStyle = {
    ...basePronStyle,
    marginTop: '8px',
    display: 'block',
    textAlign: lineTextAlign,
    wordSpacing: '4px',
    lineHeight: '1.4'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: lineTextAlign, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <span className="primary-text" style={{ whiteSpace: isFocused ? 'normal' : 'pre-wrap', wordBreak: 'normal', overflowWrap: 'break-word', display: 'inline-block', position: 'relative', textAlign: lineTextAlign, direction: isRTL ? 'rtl' : 'ltr', width: '100%', maxWidth: '100%', textWrap: isFocused ? 'balance' : 'normal', boxSizing: 'border-box' }}>
        <span
          className="core-chunks"
          style={{
            position: 'relative',
            display: 'inline-flex',
            flexDirection: isFocused ? 'column' : 'row',
            justifyContent: isFocused ? 'center' : 'flex-start',
            alignItems: isFocused ? 'center' : 'flex-end',
            flexWrap: 'wrap',
            verticalAlign: 'bottom',
            margin: '0',
            width: 'auto',
            maxWidth: '100%',
            textAlign: lineTextAlign,
            textWrap: isFocused ? 'balance' : 'normal',
            boxSizing: 'border-box'
          }}
        >
          {displayTranslation ? (
            <span className={`chunk-translation ${transClass}`} dir="ltr">
              {renderFormattedTranslation(displayTranslation)}
            </span>
          ) : null}
          <span
            className="main-lyrics-layer"
            style={{
              display: 'inline-flex',
              flexDirection: 'row',
              justifyContent: isFocused ? 'center' : 'flex-start',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              width: 'auto',
              maxWidth: '100%',
              textAlign: lineTextAlign,
              textWrap: isFocused ? 'balance' : 'normal',
              boxSizing: 'border-box'
            }}
            dir="auto"
          >
            {alignedJSX}
          </span>
        </span>
      </span>
      {shouldRenderBlockPron && displayPronString && (
        <div className="pronunciation-text" style={blockPronStyle} dir="ltr">
          {renderFormattedTranslation(displayPronString)}
        </div>
      )}
    </div>
  );
};

export const LyricLineWrapper = React.memo(({
  lineObj, savedNode, nextStart, viewMode, handleLineClick, masterPalette, isPlayingCurrentSong }) => {
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
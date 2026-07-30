/* --- src/components/LyricsLineRenderer.jsx --- */
import React, { useMemo } from 'react';

const isCJ = (char) => /[\u4e00-\u9fa5\u3040-\u30ff]/.test(char);
const isPunctuationChar = (char) => /^[\p{P}\p{S}\s]+$/u.test(char);

// Helper to safely split a string into grapheme clusters (preventing combining marks like ो from detaching)
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
    marginTop: 'var(--dyn-transliterationBottomPadding, 4px)',
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

    return <span key={globalIdx} {...adlibProps} style={style}>{c.char}</span>;
  };

  let activeParsedChunks = parsedChunks;
  if (!activeParsedChunks) {
    activeParsedChunks = [{ type: 'main', trans: '', text: lineObj.text }];
  }

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
          chars: chunkChars,
          isMain: true
        });
      }
    });

    if (charIdxPointer < chars.length) {
      alignedChunks.push({
        type: 'main',
        trans: '',
        chars: chars.slice(charIdxPointer),
        isMain: true
      });
    }
  } else {
    alignedChunks = [{
      type: 'main',
      trans: fullTrans || '',
      chars: chars,
      isMain: true
    }];
  }

  const renderedAllChunks = alignedChunks.map((chunk, chunkIdx) => {
    const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex));
    if (renderedText.every(c => c === null)) return { type: chunk.type, jsx: null };
    const groupedText = groupWords(renderedText, chunk.chars);

    if (isRTL) {
      return {
        type: chunk.type,
        jsx: <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'middle' }}>{groupedText}</span>
      };
    } else {
      if (chunk.type === 'foreign' && chunk.trans && chunk.trans.trim()) {
        const cleanTrans = normalizeTrans(chunk.trans);
        return {
          type: chunk.type,
          jsx: (
            <span key={chunkIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'bottom', margin: '0 4px' }}>
              <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>{groupedText}</span>
              {cleanTrans ? (
                <span className="pronunciation-text" style={basePronStyle} dir="ltr">{cleanTrans}</span>
              ) : null}
            </span>
          )
        };
      } else {
        return {
          type: chunk.type,
          jsx: <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'bottom', display: 'inline-block' }}>{groupedText}</span>
        };
      }
    }
  });

  let firstMainIdx = -1;
  let lastMainIdx = -1;
  for (let j = 0; j < alignedChunks.length; j++) {
    if (alignedChunks[j].type !== 'adlib') {
      if (firstMainIdx === -1) firstMainIdx = j;
      lastMainIdx = j;
    }
  }

  let leadingJsx = [];
  let coreJsx = [];
  let trailingJsx = [];

  if (firstMainIdx === -1) {
    coreJsx = renderedAllChunks.map(c => c.jsx).filter(Boolean);
  } else {
    leadingJsx = renderedAllChunks.slice(0, firstMainIdx).map(c => c.jsx).filter(Boolean);
    coreJsx = renderedAllChunks.slice(firstMainIdx, lastMainIdx + 1).map(c => c.jsx).filter(Boolean);
    trailingJsx = renderedAllChunks.slice(lastMainIdx + 1).map(c => c.jsx).filter(Boolean);
  }

  let shouldRenderBlockPron = false;
  let displayPronString = null;

  if (fullTrans) {
    displayPronString = normalizeTrans(fullTrans);
    shouldRenderBlockPron = isRTL;
  } else if (parsedChunks) {
    if (isRTL) {
      displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).filter(Boolean).join(' ');
      shouldRenderBlockPron = true;
    }
  } else if (pronString && !pronString.startsWith('{') && !pronString.startsWith('[')) {
    displayPronString = normalizeTrans(pronString);
    shouldRenderBlockPron = true;
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: lineTextAlign, width: '100%' }}>
      <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'inline-block', position: 'relative', textAlign: lineTextAlign, direction: isRTL ? 'rtl' : 'ltr', width: '100%' }}>
        {leadingJsx.length > 0 && <span className="leading-adlibs">{leadingJsx}</span>}
        <span 
          className="core-chunks" 
          style={{ 
            position: 'relative', 
            display: 'inline-flex', 
            flexDirection: 'row', 
            justifyContent: isFocused ? 'center' : 'flex-start',
            alignItems: 'flex-end', 
            flexWrap: 'wrap', 
            verticalAlign: 'bottom', 
            margin: '0 4px',
            width: isFocused ? '100%' : 'auto',
            textAlign: lineTextAlign
          }}
        >
          {/* FLOATING TRANSLATION */}
          {displayTranslation ? (
            <span className={`chunk-translation ${transClass}`} dir="ltr">
                {displayTranslation}
            </span>
          ) : null}
          {/* MAIN LYRICS TEXT LINE */}
          <span 
            className="main-lyrics-layer" 
            style={{ 
              display: 'inline-flex', 
              flexDirection: 'row', 
              justifyContent: isFocused ? 'center' : 'flex-start',
              alignItems: 'flex-end', 
              flexWrap: 'wrap',
              width: '100%',
              textAlign: lineTextAlign
            }} 
            dir="auto"
          >
            {coreJsx}
          </span>
        </span>
        {trailingJsx.length > 0 && <span className="trailing-adlibs">{trailingJsx}</span>}
      </span>
      {/* RTL BLOCK PRONUNCIATION */}
      {shouldRenderBlockPron && displayPronString && (
        <div className="pronunciation-text" style={blockPronStyle} dir="ltr">
          {displayPronString}
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
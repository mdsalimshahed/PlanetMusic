/* --- src/components/LyricsRenderer/SplitLine.jsx --- */
import React from 'react';
import { isPunctuationChar, normalizeTrans, cleanTranslationText, isCJ, getGraphemes } from './textUtils';
import { alignChunksWithTransliteration, renderFormattedTranslation } from './Formatters';

const SplitLine = ({
  lineObj,
  savedNode,
  masterPalette,
  isPlayingCurrentSong,
  chars,
  parsedChunks,
  fullTrans,
  isRTL,
  transClass,
  basePronStyle,
  displayTranslation,
  pronString,
  hasSpacingText
}) => {
  const currentTime = window.currentAudioTime || 0;

  const blocks = [];
  let currentBlock = null;

  chars.forEach((c) => {
    const adlibIndex = savedNode.adlibs?.findIndex(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd);
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

  const mainBlocks = blocks.filter(b => !b.isAdlib);
  let mainChars = [];
  mainBlocks.forEach(b => mainChars.push(...b.chars));
  while(mainChars.length > 0 && /\s/.test(mainChars[0].char)) mainChars.shift();
  while(mainChars.length > 0 && /\s/.test(mainChars[mainChars.length - 1].char)) mainChars.pop();

  const protectedPronStyle = {
    ...basePronStyle,
    WebkitTextFillColor: 'currentcolor',
    backgroundImage: 'none'
  };

  const getSegmentStyle = (seg) => {
    let targetArtists = seg?.artists;
    let isGrad = false;
    let gradStyle = '';

    if (targetArtists && targetArtists.length > 1) {
      isGrad = true;
      const gradientColors = targetArtists.map(artist => masterPalette[artist] || '#ffffff').join(', ');
      gradStyle = `linear-gradient(90deg, ${gradientColors})`;
    } else if (seg?.isGradient && seg?.gradient) {
      isGrad = true;
      gradStyle = seg.gradient;
    }

    if (isGrad) {
      return {
        backgroundImage: gradStyle,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        WebkitBoxDecorationBreak: 'clone',
        display: 'inline',
        paddingBottom: '1.2em',
        paddingTop: '0.2em',
        filter: `drop-shadow(0 4px 12px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`
      };
    }
    return {
        display: 'inline',
        paddingBottom: '1.2em',
        paddingTop: '0.2em'
    };
  };

  const renderColoredCharForSplit = (c, globalIdx) => {
    const isPunct = isPunctuationChar(c.char);
    let style = { transition: 'opacity 0.3s ease, transform 0.3s ease' };
    
    if (isPunct && c.char.trim() !== '') {
      style = {
        ...style,
        color: '#fbbf24',
        WebkitTextFillColor: '#fbbf24',
        textShadow: '0 4px 12px rgba(0,0,0,0.95), 0 0 15px rgba(251, 191, 36, 0.6)',
        backgroundImage: 'none',
        filter: 'none'
      };
    } else {
      let targetArtists = c.seg?.artists;
      let isGrad = (targetArtists && targetArtists.length > 1) || c.seg?.isGradient;
      
      if (!isGrad) {
        let activeColor = '#ffffff';
        if (targetArtists && targetArtists.length === 1) {
          activeColor = masterPalette[targetArtists[0]] || '#ffffff';
        } else if (c.seg?.color) {
          activeColor = c.seg.color;
        }
        style.color = activeColor;
        style.WebkitTextFillColor = activeColor;
        style.textShadow = `0 4px 12px rgba(0,0,0,0.95), 0 0 20px ${activeColor}80`;
      }
    }
    return <span key={globalIdx} style={style}>{c.char}</span>;
  };

  let effectiveFullTrans = fullTrans;
  let effectiveParsedChunks = parsedChunks;
  let finalMainHasSpacing = hasSpacingText;

  if (pronString && !pronString.startsWith('{') && !pronString.startsWith('[')) {
    effectiveFullTrans = pronString;
    effectiveParsedChunks = null;
  }

  if (hasSpacingText && effectiveFullTrans) {
      const safeTextStr = mainChars.map(c => c.char).join('').replace(/([()\uff08\uff09])/g, ' $1 ');
      const textWords = safeTextStr.split(/\s+/).filter(Boolean);
      const safePronStr = effectiveFullTrans.replace(/([()\uff08\uff09])/g, ' $1 ');
      const pronWords = safePronStr.split(/\s+/).filter(Boolean);
      
      if (textWords.length > 0 && textWords.length === pronWords.length) {
          effectiveParsedChunks = textWords.map((tw, i) => ({
              type: 'foreign',
              text: tw,
              trans: pronWords[i] || ''
          }));
          finalMainHasSpacing = false;
      } else {
          effectiveParsedChunks = null;
          finalMainHasSpacing = false;
      }
  }

  let alignedMainJSX_Gradient = null;
  let alignedMainJSX_Solid = null;

  if (mainChars.length > 0) {
    const isOnlyPunct = mainChars.every(c => isPunctuationChar(c.char) || /\s/.test(c.char));
    
    alignedMainJSX_Gradient = alignChunksWithTransliteration(
      mainChars, isOnlyPunct ? null : effectiveParsedChunks, isOnlyPunct ? '' : effectiveFullTrans,
      renderColoredCharForSplit, protectedPronStyle, isRTL, false, finalMainHasSpacing, getSegmentStyle, false
    );
    alignedMainJSX_Solid = alignChunksWithTransliteration(
      mainChars, isOnlyPunct ? null : effectiveParsedChunks, isOnlyPunct ? '' : effectiveFullTrans,
      renderColoredCharForSplit, protectedPronStyle, isRTL, false, finalMainHasSpacing, getSegmentStyle, true
    );
  }

  const renderedAdlibElements = savedNode?.adlibs?.map((adlib, bIdx) => {
    const start = adlib.start;
    const end = adlib.end !== null ? adlib.end : (start !== null ? start + 5 : null);
    
    let initialClass = 'adlib-hidden';
    if (isPlayingCurrentSong && start !== null) {
      if (currentTime >= start && currentTime <= end) initialClass = 'adlib-active';
      else if (currentTime > end) initialClass = 'adlib-visible';
    } else if (!isPlayingCurrentSong) {
      initialClass = 'adlib-visible';
    }

    let displayTrans = cleanTranslationText(adlib.translation);
    if (displayTrans) displayTrans = displayTrans.replace(/[()\uff08\uff09]/g, '').trim();

    const aActiveSpacingText = adlib.spacingText || '';
    const aUseSpacingText = Boolean(aActiveSpacingText && aActiveSpacingText.trim());
    const activeDisplayText = aUseSpacingText ? aActiveSpacingText : (adlib.text || '');

    let adlibChars = [];
    let segmentPointer = 0;
    let charPointerInSegment = 0;
    const segs = adlib.segments || [{ text: adlib.text }];

    if (aUseSpacingText) {
      const spacedGraphemes = getGraphemes(activeDisplayText);
      const origGraphemes = getGraphemes(adlib.text || '');
      let origPointer = 0;
      spacedGraphemes.forEach((char, idx) => {
        let currentSeg = segs[segmentPointer] || segs[segs.length - 1] || {};
        let isOrigChar = false;
        if (origPointer < origGraphemes.length && char === origGraphemes[origPointer]) {
            isOrigChar = true;
        } else if (/\s/.test(char) && origPointer < origGraphemes.length && !/\s/.test(origGraphemes[origPointer])) {
            isOrigChar = false;
        } else {
            isOrigChar = !/\s/.test(char);
        }
        adlibChars.push({ char, seg: currentSeg, globalIndex: idx });
        if (isOrigChar) {
          origPointer++;
          charPointerInSegment += getGraphemes(char).length;
          if (currentSeg && charPointerInSegment >= getGraphemes(currentSeg.text || '').length) {
            segmentPointer++;
            charPointerInSegment = 0;
          }
        }
      });
    } else {
      const graphemes = getGraphemes(activeDisplayText);
      graphemes.forEach((char, idx) => {
        let currentSeg = segs[segmentPointer] || segs[segs.length - 1] || {};
        adlibChars.push({ char, seg: currentSeg, globalIndex: idx });
        charPointerInSegment += getGraphemes(char).length;
        if (currentSeg && charPointerInSegment >= getGraphemes(currentSeg.text || '').length) {
          segmentPointer++;
          charPointerInSegment = 0;
        }
      });
    }

    let aParsedChunks = null;
    let aFullTrans = null;
    let aPron = adlib.pronunciation;
    
    if (typeof aPron === 'string') {
      if (aPron.startsWith('{')) {
        try {
          const p = JSON.parse(aPron);
          aParsedChunks = p.chunks;
          aFullTrans = p.full;
        } catch (e) {}
      } else if (aPron.startsWith('[')) {
        try { aParsedChunks = JSON.parse(aPron); } catch (e) {}
      } else {
        aFullTrans = aPron;
      }
    }

    const alignedAdlibJSX_Gradient = alignChunksWithTransliteration(
      adlibChars, aParsedChunks, aFullTrans, renderColoredCharForSplit, protectedPronStyle, false, false, aUseSpacingText, getSegmentStyle, false
    );
    const alignedAdlibJSX_Solid = alignChunksWithTransliteration(
      adlibChars, aParsedChunks, aFullTrans, renderColoredCharForSplit, protectedPronStyle, false, false, aUseSpacingText, getSegmentStyle, true
    );

    let displayPronString = null;
    const isCJKLine = adlibChars.some(c => isCJ(c.char));
    
    if (aPron && !aPron.startsWith('{') && !aPron.startsWith('[')) {
      if (!isCJKLine && !aParsedChunks) {
        displayPronString = normalizeTrans(aPron);
      }
    }

    return (
      <React.Fragment key={`simple-adlib-${bIdx}`}>
        <span className="adlib-spacer" style={{ whiteSpace: 'pre' }}> </span>
        
        <span 
          className={`adlib-container adlib-node ${initialClass}`}
          data-start={start !== null ? start : 'NaN'}
          data-end={end !== null ? end : 'NaN'}
          style={{ 
            display: 'inline-flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            position: 'relative', 
            verticalAlign: 'baseline',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          {displayTrans ? (
            <span 
                className={`chunk-translation ${transClass}`} 
                dir="ltr" 
                style={{ maxWidth: '100%' }}
            >
              {renderFormattedTranslation(displayTrans, false)}
            </span>
          ) : null}

          <span className="primary-text dual-layer-container" style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'normal', width: '100%' }} dir="auto">
            <span className="layer-gradient" aria-hidden="true" style={{ display: 'inline' }}>
              {alignedAdlibJSX_Gradient}
            </span>
            <span className="layer-solid" style={{ position: 'absolute', inset: 0, display: 'inline', pointerEvents: 'none' }}>
              {alignedAdlibJSX_Solid}
            </span>
          </span>

          {displayPronString ? (
            <span className="pronunciation-text" style={{...protectedPronStyle, display: 'block', marginTop: 'var(--dyn-translit-bottom-padding, 4px)'}} dir="ltr">
              {renderFormattedTranslation(displayPronString, false)}
            </span>
          ) : null}
        </span>
      </React.Fragment>
    );
  });

  let displayPronString = null;
  let shouldRenderBlockPron = false;
  const isCJKLine = chars.some(c => isCJ(c.char));

  if (isRTL) {
    if (fullTrans) {
      displayPronString = normalizeTrans(fullTrans);
      shouldRenderBlockPron = true;
    } else if (parsedChunks) {
      displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).filter(Boolean).join(' ');
      shouldRenderBlockPron = true;
    }
  } else if (pronString && !pronString.startsWith('{') && !pronString.startsWith('[')) {
    if (!isCJKLine && !parsedChunks) {
      const cleanOrig = lineObj.text.toLowerCase().replace(/[\W_]+/g, '');
      const cleanPron = pronString.toLowerCase().replace(/[\W_]+/g, '');
      if (cleanOrig !== cleanPron) {
        displayPronString = normalizeTrans(pronString);
        shouldRenderBlockPron = true;
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <span 
          className="primary-text" 
          style={{ 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'normal', 
            overflowWrap: 'normal', 
            display: 'inline-block', 
            position: 'relative', 
            textAlign: 'left', 
            direction: isRTL ? 'rtl' : 'ltr',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
      >
        <span 
            className="core-chunks" 
          style={{ 
            position: 'relative', 
            display: 'inline-block', 
            margin: '0', 
            width: 'auto', 
            maxWidth: '100%', 
            textAlign: 'left', 
            boxSizing: 'border-box' 
          }}
        >
          {displayTranslation ? (
            <span 
                className={`chunk-translation ${transClass}`} 
                dir="ltr" 
                style={{ maxWidth: '100%' }}
            >
              {renderFormattedTranslation(displayTranslation, false)}
            </span>
          ) : null}

          <span className="dual-layer-container" style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <span 
                className="main-lyrics-layer layer-gradient" 
              style={{ display: 'inline', width: '100%', textAlign: 'left', boxSizing: 'border-box' }} 
              dir="auto"
              aria-hidden="true"
            >
              {alignedMainJSX_Gradient}
            </span>
            <span 
                className="main-lyrics-layer layer-solid" 
              style={{ position: 'absolute', inset: 0, display: 'inline', width: '100%', textAlign: 'left', boxSizing: 'border-box', pointerEvents: 'none' }} 
              dir="auto"
            >
              {alignedMainJSX_Solid}
            </span>
          </span>
        </span>
        
        {renderedAdlibElements}
      </span>
      
      {shouldRenderBlockPron && displayPronString && (
        <span 
             className="pronunciation-text" 
             style={{ 
            ...protectedPronStyle, 
            marginTop: 'var(--dyn-translit-bottom-padding, 4px)', 
            display: 'block', 
            textAlign: 'left', 
            wordSpacing: '4px', 
            lineHeight: '1.4' 
          }} 
             dir="ltr"
        >
          {renderFormattedTranslation(displayPronString, false)}
        </span>
      )}
    </div>
  );
};

export default SplitLine;
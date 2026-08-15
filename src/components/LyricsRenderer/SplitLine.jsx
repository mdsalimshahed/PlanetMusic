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
  
  // 1. EXTRACT MAIN CHARACTERS (Filter out ad-lib characters from the main line)
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
  const adlibBlocks = blocks.filter(b => b.isAdlib);
  
  let mainChars = [];
  mainBlocks.forEach(b => mainChars.push(...b.chars));

  // Gently trim orphaned leading/trailing spaces from the main line
  while(mainChars.length > 0 && /\s/.test(mainChars[0].char)) mainChars.shift();
  while(mainChars.length > 0 && /\s/.test(mainChars[mainChars.length - 1].char)) mainChars.pop();

  // 2. MAIN LINE CHARACTER RENDERER
  const renderColoredCharForSplit = (c, globalIdx) => {
    const isPunct = isPunctuationChar(c.char);
    let activeColor = isPunct ? '#fbbf24' : '#ffffff';
    let isGradient = false;
    let gradientStyle = '';

    if (!isPunct && c.seg) {
      let targetArtists = c.seg.artists;
      
      // FIXED: Removed the toxic fallback to lineObj.singer. 
      // If a segment explicitly has an empty artist array (e.g. unmapped markdown), it MUST remain white.
      if (targetArtists && targetArtists.length > 1) {
        isGradient = true;
        const c1 = masterPalette[targetArtists[0]] || '#ffffff';
        const c2 = masterPalette[targetArtists[1]] || '#ffffff';
        gradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
      } else if (targetArtists && targetArtists.length === 1) {
        activeColor = masterPalette[targetArtists[0]] || '#ffffff';
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

  // 3. RENDER MAIN TEXT (Using strict chunk alignment)
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

  let renderedMainElements = null;
  if (mainChars.length > 0) {
    const isOnlyPunct = mainChars.every(c => isPunctuationChar(c.char) || /\s/.test(c.char));
    
    const alignedMainJSX = alignChunksWithTransliteration(
      mainChars,
      isOnlyPunct ? null : effectiveParsedChunks,
      isOnlyPunct ? '' : effectiveFullTrans,
      renderColoredCharForSplit,
      basePronStyle,
      isRTL,
      false,
      finalMainHasSpacing
    );

    renderedMainElements = (
      <span
        className="main-container"
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          position: 'relative',
          verticalAlign: 'baseline',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        <span
          className="primary-text"
          style={{
            whiteSpace: 'pre-wrap',
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            verticalAlign: 'bottom',
            flexWrap: 'wrap',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
          dir="auto"
        >
          {alignedMainJSX}
        </span>
      </span>
    );
  }

  // 4. DEDICATED AD-LIB RENDERER (Extracts color directly from live Markdown segments)
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

    // Determine Pronunciation
    let displayPron = '';
    if (adlib.pronunciation) {
        try {
            const p = JSON.parse(adlib.pronunciation);
            displayPron = p.full || '';
        } catch(e) {
            displayPron = adlib.pronunciation;
        }
    }
    if (displayPron) displayPron = displayPron.replace(/[()\uff08\uff09]/g, '').trim();

    // Determine Translation
    let displayTrans = cleanTranslationText(adlib.translation);
    if (displayTrans) displayTrans = displayTrans.replace(/[()\uff08\uff09]/g, '').trim();

    const aActiveSpacingText = adlib.spacingText || '';
    const aUseSpacingText = Boolean(aActiveSpacingText && aActiveSpacingText.trim());
    
    // Extrapolate LIVE characters from the active Editor State instead of stale DB values
    const blk = adlibBlocks[bIdx];
    let adlibChars = [];
    
    if (blk && blk.chars) {
      if (aUseSpacingText) {
        const spacedGraphemes = getGraphemes(aActiveSpacingText);
        const origCharsList = blk.chars;
        let origPointer = 0;
        
        spacedGraphemes.forEach((char, idx) => {
          let currentSeg = origCharsList[origPointer]?.seg || origCharsList[origCharsList.length - 1]?.seg;
          let isOrigChar = false;
          
          if (origPointer < origCharsList.length && char === origCharsList[origPointer].char) {
              isOrigChar = true;
          } else if (/\s/.test(char) && origPointer < origCharsList.length && !/\s/.test(origCharsList[origPointer].char)) {
              isOrigChar = false;
          } else {
              isOrigChar = !/\s/.test(char);
          }
          
          adlibChars.push({ char, seg: currentSeg });
          if (isOrigChar) origPointer++;
        });
      } else {
        adlibChars = blk.chars;
      }
    } else {
      // Fallback if parsing disconnects
      const fallbackText = aUseSpacingText ? aActiveSpacingText : (adlib.text || '');
      adlibChars = getGraphemes(fallbackText).map(char => ({ char, seg: null }));
    }

    // Map the text with individual character coloring strictly derived from the Markdown segments
    const renderedAdlibText = adlibChars.map((c, idx) => {
      const isPunct = isPunctuationChar(c.char);
      let charColor = '#ffffff';
      let charIsGradient = false;
      let charGradientStyle = '';

      if (!isPunct && c.seg) {
          let segArtists = c.seg.artists;

          // FIXED: Removed lineObj.singer fallback here as well.
          if (segArtists && segArtists.length > 1) {
              charIsGradient = true;
              const c1 = masterPalette[segArtists[0]] || '#ffffff';
              const c2 = masterPalette[segArtists[1]] || '#ffffff';
              charGradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
          } else if (segArtists && segArtists.length === 1) {
              charColor = masterPalette[segArtists[0]] || '#ffffff';
          } else {
              charColor = c.seg.color || '#ffffff';
              charIsGradient = c.seg.isGradient || false;
              charGradientStyle = c.seg.gradient || '';
          }
      } else if (!isPunct && !c.seg) {
          // If there is NO segment mapping at all (e.g. adlib text mismatch)
          // Fallback to the saved adlib.singer from DB
          let fbArtists = adlib.singer ? adlib.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s=>s.trim()) : [];
          if (fbArtists.length > 1) {
              charIsGradient = true;
              const c1 = masterPalette[fbArtists[0]] || '#ffffff';
              const c2 = masterPalette[fbArtists[1]] || '#ffffff';
              charGradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
          } else if (fbArtists.length === 1) {
              charColor = masterPalette[fbArtists[0]] || '#ffffff';
          }
      }

      let charStyle = { transition: 'opacity 0.3s ease, transform 0.3s ease', fontWeight: 'bold' };

      if (isPunct && c.char.trim() !== '') {
          charStyle = {
              ...charStyle,
              color: '#fbbf24',
              WebkitTextFillColor: '#fbbf24',
              textShadow: '0 4px 8px rgba(0,0,0,0.9), 0 0 20px rgba(251, 191, 36, 0.6)',
              backgroundImage: 'none',
              filter: 'none'
          };
      } else if (charIsGradient) {
          charStyle.backgroundImage = charGradientStyle;
          charStyle.WebkitBackgroundClip = 'text';
          charStyle.WebkitTextFillColor = 'transparent';
          charStyle.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`;
      } else {
          charStyle.color = charColor;
          charStyle.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 20px ${charColor}80`;
      }

      return <span key={idx} style={charStyle}>{c.char === ' ' ? '\u00A0' : c.char}</span>;
    });

    return (
      <span
        key={`simple-adlib-${bIdx}`}
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
          <span className={`chunk-translation ${transClass}`} dir="ltr" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -100%)', maxWidth: '90vw', width: 'max-content', textAlign: 'center', textWrap: 'balance' }}>
            {renderFormattedTranslation(displayTrans)}
          </span>
        ) : null}
        <span className="primary-text" style={{ whiteSpace: 'pre-wrap' }} dir="auto">
          {renderedAdlibText}
        </span>
        {displayPron ? (
          <span className="pronunciation-text" style={basePronStyle} dir="ltr">
            {renderFormattedTranslation(displayPron)}
          </span>
        ) : null}
      </span>
    );
  });

  // 5. GLOBAL FALLBACK PRONUNCIATION (For Main Line)
  let displayPronString = null;

  if (isRTL) {
    if (fullTrans) {
      displayPronString = normalizeTrans(fullTrans);
    } else if (parsedChunks) {
      displayPronString = parsedChunks.map(c => normalizeTrans(c.trans || c.text)).filter(Boolean).join(' ');
    }
  } else if (effectiveFullTrans) {
    if (!effectiveParsedChunks) {
       const cleanOrig = (lineObj.text || '').toLowerCase().replace(/[\W_]+/g, '');
       const cleanPron = effectiveFullTrans.toLowerCase().replace(/[\W_]+/g, '');
       if (cleanOrig !== cleanPron) {
           displayPronString = normalizeTrans(effectiveFullTrans);
       }
    }
  }

  const hasMainTranslation = !!displayTranslation;
  const hasAdlibTranslation = savedNode?.adlibs?.some(a => {
    let t = cleanTranslationText(a.translation);
    return t && t.replace(/[()\uff08\uff09]/g, '').trim().length > 0;
  });

  const requiresTranslationSpace = hasMainTranslation || hasAdlibTranslation;
  const translationSpaceCalc = 'calc(var(--dyn-trans-font-size, 0.55em) + var(--dyn-trans-font-size, 0.55em) + var(--dyn-trans-top-padding, 8px) + 0.5vh)';

  return (
    <div
        style={{
         display: 'flex',
         flexDirection: 'column',
         alignItems: 'flex-start',
         textAlign: 'left',
         width: '100%',
         maxWidth: '100%',
         boxSizing: 'border-box',
         paddingTop: requiresTranslationSpace ? translationSpaceCalc : '0',
         position: 'relative'
       }}
    >
      <span
        className="primary-text"
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          display: 'inline-flex',
          flexDirection: 'row',
          alignItems: 'baseline', 
          flexWrap: 'wrap',
          columnGap: '12px',
          rowGap: requiresTranslationSpace ? translationSpaceCalc : '0', 
          position: 'relative',
          textAlign: 'left',
          direction: 'ltr',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        <span
          className="main-text-group"
          style={{
            position: 'relative',
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          {displayTranslation ? (
            <span
                className={`chunk-translation ${transClass}`}
                dir="ltr"
               style={{
                 position: 'absolute',
                 top: 0,
                 left: 0,
                 right: 0,
                 transform: 'translateY(-100%)',
                 maxWidth: '100%',
                 width: '100%',
                 whiteSpace: 'normal',
                 wordBreak: 'break-word',
                 overflowWrap: 'break-word',
                 textAlign: 'center',
                 textWrap: 'balance'
               }}
            >
              {renderFormattedTranslation(displayTranslation)}
            </span>
          ) : null}
          {renderedMainElements}
        </span>
        {renderedAdlibElements}
      </span>
      {displayPronString && (
        <div className="pronunciation-text" style={{ ...basePronStyle, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word', marginTop: '8px', display: 'block', textAlign: 'left', maxWidth: '100%' }} dir="ltr">
          {renderFormattedTranslation(displayPronString)}
        </div>
      )}
    </div>
  );
};

export default SplitLine;
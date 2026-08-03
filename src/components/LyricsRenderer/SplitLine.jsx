/* --- src/components/LyricsRenderer/SplitLine.jsx --- */
import React from 'react';
import { isPunctuationChar, normalizeTrans, cleanTranslationText } from './textUtils';
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
  pronString
}) => {
  const currentTime = window.currentAudioTime || 0;
  const blocks = [];
  let currentBlock = null;

  chars.forEach((c) => {
    const adlibIndex = savedNode.adlibs.findIndex(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd);
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
      if (!targetArtists && lineObj.singer) {
        targetArtists = lineObj.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim());
      }

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

  // Separate main blocks and ad-lib blocks so main text can be cleanly grouped together
  const mainBlocks = blocks.filter(b => !b.isAdlib);
  const adlibBlocks = blocks.filter(b => b.isAdlib);

  // Render Main Lyrics Group
  const renderedMainElements = mainBlocks.map((blk, bIdx) => {
    const alignedMainJSX = alignChunksWithTransliteration(
      blk.chars,
      parsedChunks,
      fullTrans,
      renderColoredCharForSplit,
      basePronStyle,
      isRTL,
      false
    );

    return (
      <span
        key={`main-block-${bIdx}`}
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
  });

  // Render Ad-lib Blocks
  const renderedAdlibElements = adlibBlocks.map((blk, bIdx) => {
    const adlib = blk.adlibObj;
    if (!adlib) return null;

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
      false
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
          verticalAlign: 'baseline',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        {adlibTranslation ? (
          <span
             className={`chunk-translation ${transClass}`}
             dir="ltr"
             style={{
               position: 'absolute',
               top: 0,
               left: '50%',
               transform: 'translate(-50%, -100%)',
               maxWidth: '90vw',
               width: 'max-content',
               whiteSpace: 'normal',
               wordBreak: 'break-word',
               overflowWrap: 'break-word',
               textAlign: 'center',
               textWrap: 'balance'
             }}
          >
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
            verticalAlign: 'bottom',
            flexWrap: 'wrap',
            maxWidth: '100%',
            boxSizing: 'border-box',
            justifyContent: 'center'
          }}
          dir="auto"
        >
          {alignedAdlibJSX}
        </span>
      </span>
    );
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

  const hasMainTranslation = !!displayTranslation;
  const hasAdlibTranslation = savedNode?.adlibs?.some(a => cleanTranslationText(a.translation));
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
        {/* Strictly group the main lyrics together so main translation is bound ONLY to them */}
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

        {/* Ad-lib elements rendered completely separately */}
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
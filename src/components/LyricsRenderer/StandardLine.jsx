/* --- src/components/LyricsRenderer/StandardLine.jsx --- */
import React from 'react';
import { isPunctuationChar, normalizeTrans, isCJ } from './textUtils';
import { alignChunksWithTransliteration, renderFormattedTranslation } from './Formatters';

const StandardLine = ({
  lineObj,
  savedNode,
  isFocused,
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
  const hasSpacingText = Boolean(savedNode?.spacingText?.trim() || lineObj?.spacingText?.trim());

  let displayChars = chars;
  if (isFocused && savedNode?.isSplit && savedNode?.adlibs?.length > 0) {
    displayChars = chars.filter(c => !savedNode.adlibs.some(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd));
  }

  const renderColoredChar = (c, globalIdx) => {
    let adlibProps = {};
    if (savedNode?.isSplit && !isFocused) {
      const adlib = savedNode.adlibs?.find(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd);
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
      style.filter = isFocused 
          ? `drop-shadow(0 0 12px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(255,255,255,0.4))` 
          : `drop-shadow(0 4px 12px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`;
    } else {
      style.color = activeColor;
      style.textShadow = isFocused 
          ? `0 0 12px rgba(0,0,0,0.95), 0 0 20px ${activeColor}80` 
          : `0 4px 12px rgba(0,0,0,0.95), 0 0 20px ${activeColor}80`;
    }

    return <span key={globalIdx} {...adlibProps} style={style}>{c.char}</span>;
  };

  const alignedJSX = alignChunksWithTransliteration(
    displayChars,
    parsedChunks,
    fullTrans,
    renderColoredChar,
    basePronStyle,
    isRTL,
    isFocused,
    hasSpacingText
  );

  let shouldRenderBlockPron = false;
  let displayPronString = null;
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
      <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'normal', display: 'inline-block', position: 'relative', textAlign: lineTextAlign, direction: isRTL ? 'rtl' : 'ltr', width: '100%', maxWidth: '100%', textWrap: isFocused ? 'balance' : 'normal', boxSizing: 'border-box' }}>
        <span
          className="core-chunks"
          style={{
            position: 'relative',
            display: 'inline-flex',
            flexDirection: isFocused ? 'column' : 'row',
            justifyContent: isFocused ? 'center' : 'flex-start',
            alignItems: isFocused ? 'center' : 'baseline',
            flexWrap: 'wrap',
            verticalAlign: 'baseline',
            margin: '0',
            width: 'auto',
            maxWidth: '100%',
            textAlign: lineTextAlign,
            textWrap: isFocused ? 'balance' : 'normal',
            boxSizing: 'border-box'
          }}
        >
          {displayTranslation ? (
            <span
                className={`chunk-translation ${transClass}`}
               dir="ltr"
              style={{
                textWrap: 'balance',
                textAlign: 'center'
              }}
            >
              {renderFormattedTranslation(displayTranslation, isFocused)}
            </span>
          ) : null}
          <span
            className="main-lyrics-layer"
            style={{
              display: 'inline', // Critical CSS Fix: Allows standard inline text wrapping instead of rigid flexboxes
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
        <span className="pronunciation-text" style={blockPronStyle} dir="ltr">
          {renderFormattedTranslation(displayPronString, isFocused)}
        </span>
      )}
    </div>
  );
};

export default StandardLine;
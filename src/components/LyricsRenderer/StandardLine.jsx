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
        display: 'inline', // Pure inline prevents CSS layout clipping
        paddingBottom: '1.2em', // Safe margin prevents descenders from clipping
        paddingTop: '0.2em',
        filter: isFocused
            ? `drop-shadow(0 0 12px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`
           : `drop-shadow(0 4px 12px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`
      };
    }
    return {
        display: 'inline',
        paddingBottom: '1.2em',
        paddingTop: '0.2em'
    };
  };

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
    let style = { transition: 'opacity 0.3s ease, transform 0.3s ease' };
    
    if (isPunct && c.char.trim() !== '') {
      style = {
        ...style,
        color: '#fbbf24',
        WebkitTextFillColor: '#fbbf24',
        textShadow: isFocused ? '0 0 12px rgba(0,0,0,0.95), 0 0 15px rgba(251, 191, 36, 0.6)' : '0 4px 12px rgba(0,0,0,0.95), 0 0 15px rgba(251, 191, 36, 0.6)',
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
        style.textShadow = isFocused ? `0 0 12px rgba(0,0,0,0.95), 0 0 20px ${activeColor}80` : `0 4px 12px rgba(0,0,0,0.95), 0 0 20px ${activeColor}80`;
      }
    }
    return <span key={globalIdx} {...adlibProps} style={style}>{c.char}</span>;
  };

  const alignedJSX_Gradient = alignChunksWithTransliteration(
    displayChars, parsedChunks, fullTrans, renderColoredChar, protectedPronStyle,
    isRTL, isFocused, hasSpacingText, getSegmentStyle, false 
  );

  const alignedJSX_Solid = alignChunksWithTransliteration(
    displayChars, parsedChunks, fullTrans, renderColoredChar, protectedPronStyle,
    isRTL, isFocused, hasSpacingText, getSegmentStyle, true 
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
    ...protectedPronStyle,
    marginTop: 'var(--dyn-translit-bottom-padding, 4px)', // Inherits your setting exactly
    display: 'block',
    width: '100%',
    textAlign: 'center',
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
            display: 'inline-block', 
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
                style={{ maxWidth: '100%' }}
            >
              {renderFormattedTranslation(displayTranslation, isFocused)}
            </span>
          ) : null}
          
          <span className="dual-layer-container" style={{ position: 'relative', display: 'inline-block', width: '100%', textAlign: lineTextAlign }}>
             <span 
               className="main-lyrics-layer layer-gradient" 
               style={{ display: 'inline', width: '100%', textAlign: lineTextAlign, boxSizing: 'border-box' }} 
               dir="auto" 
               aria-hidden="true"
             >
               {alignedJSX_Gradient}
             </span>

             <span 
               className="main-lyrics-layer layer-solid" 
               style={{ position: 'absolute', inset: 0, display: 'inline', width: '100%', textAlign: lineTextAlign, boxSizing: 'border-box', pointerEvents: 'none' }} 
               dir="auto"
             >
               {alignedJSX_Solid}
             </span>
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
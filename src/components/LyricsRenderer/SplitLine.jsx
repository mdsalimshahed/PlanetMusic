/* --- src/components/LyricsRenderer/SplitLine.jsx --- */
import React from 'react';
import EngineRouter from './LanguageEngines/EngineRouter';
import { extractCharsAndSegments } from './LanguageEngines/EngineUtils';
import { isRTLLanguage } from './textUtils';

const SplitLine = ({
  lineObj,
  savedNode,
  masterPalette,
  isPlayingCurrentSong,
  chars,
  lang,
  translation,
  pronunciation,
  hasSpacingText
}) => {
  const currentTime = window.currentAudioTime || 0;
  const isRTL = isRTLLanguage(lineObj.text || '');

  // Uniform translation block styling
  const relativeTransStyle = {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    transform: 'none',
    marginTop: 0,
    marginBottom: 'var(--dyn-trans-top-padding, 8px)',
    width: 'auto',
    minWidth: '100%',
    textAlign: 'center',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'normal',
    display: 'block'
  };

  // Uniform pronunciation block styling
  const blockPronStyle = {
    position: 'relative',
    fontSize: 'var(--dyn-translit-font-size, 0.55em)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'center',
    marginTop: 'var(--dyn-translit-bottom-padding, 8px)',
    display: 'inline-block',
    whiteSpace: 'nowrap',
    WebkitTextFillColor: 'currentcolor',
    backgroundImage: 'none',
    color: 'rgba(255,255,255,0.7)',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
    wordSpacing: '4px',
    lineHeight: '1.4'
  };

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

  const isOnlyPunct = mainChars.length > 0 && mainChars.every(c => /^[\p{P}\p{S}\s]+$/u.test(c.char));

  const { mainJSX: alignedMainJSX, translationJSX: mainTranslationJSX, pronunciationJSX: mainPronunciationJSX } = EngineRouter({
    chars: mainChars,
    lang,
    translation,
    pronunciation,
    hasSpacingText,
    isFocused: false,
    masterPalette,
    originalText: lineObj.text,
    isOnlyPunct,
    isAdlib: false
  });

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

    const { chars: extractedAdlibChars, hasSpacingText: extractedHasSpacing } = extractCharsAndSegments(
        { text: adlib.text, segments: adlib.segments }, 
        adlib
    );

    const cleanedAdlibTrans = adlib.translation ? adlib.translation.replace(/[()\uff08\uff09]/g, '').trim() : '';

    const { mainJSX: adlibMainJSX, translationJSX: adlibTransJSX, pronunciationJSX: adlibPronJSX } = EngineRouter({
       chars: extractedAdlibChars,
       lang: adlib.lang || lang,
       translation: cleanedAdlibTrans,
       pronunciation: adlib.pronunciation,
       hasSpacingText: extractedHasSpacing,
       isFocused: false,
       masterPalette,
       originalText: adlib.text,
       isOnlyPunct: extractedAdlibChars.length > 0 && extractedAdlibChars.every(c => /^[\p{P}\p{S}\s]+$/u.test(c.char)),
       isAdlib: true
    });

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
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          {adlibTransJSX ? (
            <span className="chunk-translation live-translation" dir="ltr" style={relativeTransStyle}>
              {adlibTransJSX}
            </span>
          ) : null}
          <span className="primary-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'normal', display: 'inline-block', marginTop: 'auto', marginBottom: 'auto' }} dir="auto">
            {adlibMainJSX}
          </span>
          {adlibPronJSX ? (
            <span className="pronunciation-text" style={blockPronStyle} dir="ltr">
              {adlibPronJSX}
            </span>
          ) : null}
        </span>
      </React.Fragment>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <span
        className="primary-text"
        style={{
          display: 'inline-flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'flex-start',
          whiteSpace: 'pre-wrap',
          wordBreak: 'normal',
          overflowWrap: 'normal',
          position: 'relative',
          textAlign: 'left',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        <span
          className="core-chunks"
          style={{
            position: 'relative',
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '0',
            width: 'auto',
            maxWidth: '100%',
            textAlign: 'left',
            boxSizing: 'border-box'
          }}
        >
          {mainTranslationJSX ? (
            <span className="chunk-translation live-translation" dir="ltr" style={relativeTransStyle}>
              {mainTranslationJSX}
            </span>
          ) : null}
          
          <span
            className="main-lyrics-layer"
            style={{
              display: 'inline-block',
              width: 'auto',
              maxWidth: '100%',
              textAlign: 'left',
              boxSizing: 'border-box',
              marginTop: 'auto',
              marginBottom: 'auto'
            }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {alignedMainJSX}
          </span>

          {mainPronunciationJSX && (
            <span
              className="pronunciation-text"
              style={blockPronStyle}
              dir="ltr"
            >
              {mainPronunciationJSX}
            </span>
          )}
        </span>
        
        {renderedAdlibElements}
      </span>
    </div>
  );
};

export default SplitLine;
/* --- src/components/LyricsRenderer/SplitLine.jsx --- */
import React from 'react';
import EngineRouter from './LanguageEngines/EngineRouter.jsx';
import { extractCharsAndSegments } from './LanguageEngines/EngineUtils.jsx';
import { isRTLLanguage, usesCjkWordSpacing } from './textUtils.js';
import { renderTranslationOriginalText } from './TranslationOriginalText.jsx';
import { renderPlainLyricsText } from './PlainLyricsText.jsx';

const SplitLine = ({
  lineObj,
  savedNode,
  masterPalette,
  isPlayingCurrentSong,
  chars,
  lang,
  translation,
  pronunciation,
  hasSpacingText,
  useTranslationFormatting = false,
  renderSyncChunks = false,
  focusedMainLyrics = false,
  autoLiveLayout = false
}) => {
  const currentTime = window.currentAudioTime || 0;
  const isRTL = isRTLLanguage(lineObj.text || '');

  // Uniform pronunciation block styling (Used for both main parent and adlib blocks)
  const blockPronStyle = {
    fontSize: 'var(--dyn-translit-font-size, 0.55em)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'center',
    marginTop: 'var(--dyn-translit-bottom-padding, 8px)',
    display: 'block',
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
  const { mainJSX: alignedMainJSX, focusedMainJSX: engineFocusedMainJSX, translationJSX: mainTranslationJSX, pronunciationJSX: mainPronunciationJSX } = EngineRouter({
    chars: mainChars,
    lang,
    translation,
    pronunciation,
    hasSpacingText,
    isFocused: false,
    masterPalette,
    originalText: lineObj.text,
    isOnlyPunct,
    isAdlib: false,
    includeFocusedMain: focusedMainLyrics
  });
  const preserveEngineOutput = useTranslationFormatting &&
    (renderSyncChunks || Boolean(pronunciation));
  const displayMainPronunciation = mainPronunciationJSX;
  const focusedMainJSX = focusedMainLyrics
    ? engineFocusedMainJSX || EngineRouter({
      chars: mainChars,
      lang,
      translation,
      pronunciation,
      hasSpacingText,
      isFocused: true,
      masterPalette,
      originalText: lineObj.text,
      isOnlyPunct,
      isAdlib: false
    }).mainJSX
    : alignedMainJSX;

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

    const cleanedAdlibTrans = adlib.translation ? adlib.translation.replace(/[()\uff08\uff09]/g, '').trim() : '';
    const renderAdlibChunks = renderSyncChunks &&
      usesCjkWordSpacing(adlib.lang || lang, adlib.text) &&
      Boolean(adlib.spacingText?.trim());
    const { chars: extractedAdlibChars, hasSpacingText: extractedHasSpacing } = extractCharsAndSegments(
        { text: adlib.text, segments: adlib.segments },
        adlib,
        { useParsedSegments: useTranslationFormatting && !renderAdlibChunks }
    );
    const { translationJSX: adlibTransJSX, pronunciationJSX: adlibPronJSX } = EngineRouter({
       chars: extractedAdlibChars,
       lang: adlib.lang || lang,
       translation: cleanedAdlibTrans,
       pronunciation: adlib.pronunciation,
       hasSpacingText: extractedHasSpacing,
       isFocused: false,
       masterPalette,
       originalText: adlib.text,
       isOnlyPunct: extractedAdlibChars.length > 0 && extractedAdlibChars.every(c => /^[\p{P}\p{S}\s]+$/u.test(c.char)),
       isAdlib: true // Flags isolated ad-lib so parens are omitted in engine processing
    });

    return (
      <React.Fragment key={`simple-adlib-${bIdx}`}>
        <span
          className={`adlib-container adlib-node ${initialClass}${adlibTransJSX || adlibPronJSX ? ' has-secondary' : ''}`}
          data-start={start !== null ? start : 'NaN'}
          data-end={end !== null ? end : 'NaN'}
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            verticalAlign: 'middle',
            position: 'relative',
            width: 'fit-content',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            padding: 0,
            marginInlineStart: '0.25em'
          }}
        >
            <span className="primary-text" style={{ display: 'inline', whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'normal', margin: 0, padding: 0 }} dir="auto"          >
              {renderPlainLyricsText(adlib, masterPalette)}
            </span>
          {adlibTransJSX ? (
            <span className="chunk-translation live-translation adlib-live-translation" dir="ltr">
              {adlibTransJSX}
            </span>
          ) : null}
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
      {mainTranslationJSX && !(focusedMainLyrics && autoLiveLayout) ? (
        <span className="chunk-translation live-translation main-live-translation" dir="ltr">
          {mainTranslationJSX}
        </span>
      ) : null}
      <span
          className={`primary-text${focusedMainLyrics ? ' live-split-line' : ''}`}
          dir={focusedMainLyrics && autoLiveLayout ? (isRTL ? 'rtl' : 'ltr') : undefined}
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            rowGap: 0,
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
              verticalAlign: 'middle',
              margin: '0',
              width: 'fit-content',
              maxWidth: '100%',
              minWidth: 0,
              textAlign: 'left',
              boxSizing: 'border-box'
            }}
        >
          {focusedMainLyrics && autoLiveLayout && mainTranslationJSX ? (
            <span className="chunk-translation live-translation main-live-translation" dir="ltr">
              {mainTranslationJSX}
            </span>
          ) : null}
          <span
              className="main-lyrics-layer"
              style={{
                display: 'inline',
                width: 'auto',
                maxWidth: '100%',
                textAlign: 'left',
                boxSizing: 'border-box'
              }}
              dir={isRTL ? 'rtl' : 'ltr'}
          >
            {useTranslationFormatting && !preserveEngineOutput
              ? renderTranslationOriginalText(lineObj, masterPalette, {
                savedNode,
                excludeAdlibs: true
              })
              : focusedMainJSX}
          </span>
          {displayMainPronunciation && (
            <span
                className="pronunciation-text"
                style={blockPronStyle}
                dir="ltr"
            >
              {displayMainPronunciation}
            </span>
          )}
        </span>
        
        {focusedMainLyrics && autoLiveLayout ? (
          <span className="live-adlib-group">{renderedAdlibElements}</span>
        ) : renderedAdlibElements}
      </span>
    </div>
  );
};

export default SplitLine;
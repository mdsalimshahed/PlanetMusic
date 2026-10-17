/* --- src/components/LyricsRenderer/StandardLine.jsx --- */
import EngineRouter from './LanguageEngines/EngineRouter.jsx';
import { isRTLLanguage } from './textUtils.js';
import { renderTranslationOriginalText } from './TranslationOriginalText.jsx';

const StandardLine = ({
  lineObj,
  savedNode,
  isFocused,
  masterPalette,
  chars,
  lang,
  translation,
  pronunciation,
  hasSpacingText,
  useTranslationFormatting = false,
  focusedMainLyrics = false,
  excludeAdlibs = false,
  isAdlib = false
}) => {
  const isRTL = isRTLLanguage(lineObj.text || '');

  let displayChars = chars;
  if (
    (isFocused || excludeAdlibs) &&
    savedNode?.isSplit &&
    savedNode?.adlibs?.length > 0
  ) {
    displayChars = chars.filter(c => !savedNode.adlibs.some(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd));
  }

  const isOnlyPunct = displayChars.length > 0 && displayChars.every(c => /^[\p{P}\p{S}\s]+$/u.test(c.char));

  const { mainJSX, focusedMainJSX: engineFocusedMainJSX, translationJSX, pronunciationJSX } = EngineRouter({
    chars: displayChars,
    lang,
    translation,
    pronunciation,
    hasSpacingText,
    isFocused,
    masterPalette,
    originalText: lineObj.text,
    isOnlyPunct,
    isAdlib,
    includeFocusedMain: focusedMainLyrics
  });
  const focusedMainJSX = focusedMainLyrics && !isFocused
    ? engineFocusedMainJSX || EngineRouter({
      chars: displayChars,
      lang,
      translation,
      pronunciation,
      hasSpacingText,
      isFocused: true,
      masterPalette,
      originalText: lineObj.text,
      isOnlyPunct,
      isAdlib
    }).mainJSX
    : mainJSX;

  const lineTextAlign = isFocused ? 'center' : 'left';
  const transClass = isFocused ? 'focused-translation' : 'live-translation';

  const relativeTransStyle = isFocused
    ? {
      position: 'relative',
      top: 'auto',
      left: 'auto',
      transform: 'none',
      marginTop: 0,
      marginBottom: 'var(--dyn-trans-top-padding, 8px)',
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      textAlign: 'center',
      wordBreak: 'normal',
      overflowWrap: 'normal',
      whiteSpace: 'normal',
      textWrap: 'balance'
    }
    : {
      position: 'absolute',
      top: 0,
      left: 0,
      transform: 'none',
      margin: 0,
      width: 'max-content',
      minWidth: 0,
      maxWidth: 'none',
      textAlign: 'center',
      wordBreak: 'normal',
      overflowWrap: 'normal',
      whiteSpace: 'normal'
    };

  const blockPronStyle = {
    fontSize: 'var(--dyn-translit-font-size, 0.55em)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    WebkitTextFillColor: 'currentcolor',
    backgroundImage: 'none',
    color: 'rgba(255,255,255,0.7)',
    textShadow: 'none',
    marginTop: '8px',
    display: 'block',
    textAlign: 'center',
    wordSpacing: '4px',
    lineHeight: '1.4'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isFocused ? 'center' : 'flex-start', textAlign: lineTextAlign, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <span className="primary-text" style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: isFocused ? 'center' : 'flex-start', 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'normal', 
        overflowWrap: 'normal', 
        position: 'relative', 
        textAlign: lineTextAlign, 
        width: '100%', 
        maxWidth: '100%', 
        textWrap: isFocused ? 'balance' : 'normal', 
        boxSizing: 'border-box' 
      }}>
        <span
          className="core-chunks"
          style={{
            position: 'relative',
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: isFocused ? 'center' : 'flex-end',
            alignItems: 'center',
            verticalAlign: 'baseline',
            margin: '0',
            width: 'auto',
            maxWidth: '100%',
            textAlign: lineTextAlign,
            textWrap: isFocused ? 'balance' : 'normal',
            boxSizing: 'border-box'
          }}
        >
          {translationJSX ? (
            <span className={`chunk-translation ${transClass}`} dir="ltr" style={relativeTransStyle}>
              {translationJSX}
            </span>
          ) : null}

          <span
            className="main-lyrics-layer"
            style={{
              display: 'inline', 
              width: 'auto',
              maxWidth: '100%',
              textAlign: lineTextAlign,
              textWrap: isFocused ? 'balance' : 'normal',
              boxSizing: 'border-box'
            }}
            dir={isRTL ? 'rtl' : 'ltr'} 
          >
            {useTranslationFormatting
              ? renderTranslationOriginalText(lineObj, masterPalette, {
                savedNode,
                excludeAdlibs
              })
              : focusedMainJSX}
          </span>

          {pronunciationJSX && (
            <span className="pronunciation-text" style={blockPronStyle} dir="ltr">
              {pronunciationJSX}
            </span>
          )}
        </span>
      </span>
    </div>
  );
};

export default StandardLine;
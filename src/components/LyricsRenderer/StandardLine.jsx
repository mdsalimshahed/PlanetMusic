/* --- src/components/LyricsRenderer/StandardLine.jsx --- */
import React from 'react';
import EngineRouter from './LanguageEngines/EngineRouter';
import { isRTLLanguage } from './textUtils';

const StandardLine = ({
  lineObj,
  savedNode,
  isFocused,
  masterPalette,
  chars,
  lang,
  translation,
  pronunciation,
  hasSpacingText
}) => {
  const isRTL = isRTLLanguage(lineObj.text || '');

  let displayChars = chars;
  if (isFocused && savedNode?.isSplit && savedNode?.adlibs?.length > 0) {
    displayChars = chars.filter(c => !savedNode.adlibs.some(a => c.cpStart >= a.charStart && c.cpStart < a.charEnd));
  }

  const isOnlyPunct = displayChars.length > 0 && displayChars.every(c => /^[\p{P}\p{S}\s]+$/u.test(c.char));

  const { mainJSX, translationJSX, pronunciationJSX } = EngineRouter({
    chars: displayChars,
    lang,
    translation,
    pronunciation,
    hasSpacingText,
    isFocused,
    masterPalette,
    originalText: lineObj.text,
    isOnlyPunct,
    isAdlib: false // Flags this as a main line, instructing RTL to keep parens
  });

  const lineTextAlign = isFocused ? 'center' : 'left';
  const transClass = isFocused ? 'focused-translation' : 'live-translation';

  const relativeTransStyle = {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    transform: 'none',
    marginTop: 0,
    marginBottom: 'var(--dyn-trans-top-padding, 8px)',
    width: 0,
    minWidth: '100%',
    textAlign: 'center',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
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
            {mainJSX}
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
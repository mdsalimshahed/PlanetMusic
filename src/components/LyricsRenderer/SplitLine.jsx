/* --- src/components/LyricsRenderer/SplitLine.jsx --- */
import React, { useRef, useLayoutEffect } from 'react';
import EngineRouter from './LanguageEngines/EngineRouter.jsx';
import { extractCharsAndSegments } from './LanguageEngines/EngineUtils.jsx';
import { isRTLLanguage } from './textUtils.js';
import { renderTranslationOriginalText } from './TranslationOriginalText.jsx';

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
  focusedMainLyrics = false
}) => {
  const currentTime = window.currentAudioTime || 0;
  const isRTL = isRTLLanguage(lineObj.text || '');

  const parentMainRef = useRef(null);
  const parentPronRef = useRef(null);
  const adlibRefs = useRef([]);

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
  const focusedMainJSX = focusedMainLyrics
    ? EngineRouter({
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

  useLayoutEffect(() => {
    const readTextBounds = (elements, excludePronunciation = false) => elements.flatMap(element => {
      if (!element) return [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const bounds = [];
      let node;
      while ((node = walker.nextNode())) {
        if (
          !node.textContent.trim() ||
          (excludePronunciation && node.parentElement?.closest('.pronunciation-text'))
        ) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        [...range.getClientRects()].forEach(rect => {
          if (rect.width && rect.height) bounds.push({
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom
          });
        });
      }
      return bounds;
    });
    const groupTextRows = bounds => bounds.reduce((rows, bound) => {
      const row = rows.find(candidate => (
        Math.min(candidate.bottom, bound.bottom) -
          Math.max(candidate.top, bound.top) >
        Math.min(candidate.bottom - candidate.top, bound.bottom - bound.top) * 0.5
      ));
      if (row) {
        row.left = Math.min(row.left, bound.left);
        row.right = Math.max(row.right, bound.right);
        row.top = Math.min(row.top, bound.top);
        row.bottom = Math.max(row.bottom, bound.bottom);
      } else {
        rows.push({ ...bound });
      }
      return rows;
    }, []);
    const readElementBounds = element => {
      if (!element) return [];
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height
        ? [{ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }]
        : [];
    };

    const positionAdlibTranslations = () => {
      const mainGlyphRows = groupTextRows(readTextBounds([
        parentMainRef.current?.querySelector('.main-lyrics-layer')
      ], true));
      const mainGlyphRow = mainGlyphRows.length === 1 ? mainGlyphRows[0] : null;
      const mainObstacles = [
        ...readElementBounds(parentMainRef.current?.querySelector('.chunk-translation')),
        ...readTextBounds([
          parentMainRef.current?.querySelector('.main-lyrics-layer')
        ]),
        ...readElementBounds(parentPronRef.current)
      ];
      const minimumGap = 1 / Math.max(window.devicePixelRatio || 1, 1);

      adlibRefs.current.forEach(ref => {
        const translation = ref?.querySelector('.chunk-translation');
        const translationBounds = translation?.getBoundingClientRect();
        if (!ref) return;
        const adlibGlyphs = ref.querySelector('.primary-text');
        if (!focusedMainLyrics || !mainGlyphRow || !adlibGlyphs) {
          adlibGlyphs?.style.removeProperty('--live-adlib-glyph-offset-y');
        } else {
          const previousOffset = parseFloat(
            adlibGlyphs.style.getPropertyValue('--live-adlib-glyph-offset-y')
          ) || 0;
          const glyphBounds = readTextBounds([adlibGlyphs], true).map(bound => ({
            ...bound,
            top: bound.top - previousOffset,
            bottom: bound.bottom - previousOffset
          }));
          const glyphRows = groupTextRows(glyphBounds);
          const glyphRow = glyphRows.length === 1 ? glyphRows[0] : null;
          const isBesideMainGlyph = glyphRow && (
            Math.min(mainGlyphRow.bottom, glyphRow.bottom) -
              Math.max(mainGlyphRow.top, glyphRow.top) >
            Math.min(
              mainGlyphRow.bottom - mainGlyphRow.top,
              glyphRow.bottom - glyphRow.top
            ) * 0.5
          );
          if (isBesideMainGlyph) {
            const offset = mainGlyphRow.bottom - glyphRow.bottom;
            adlibGlyphs.style.setProperty(
              '--live-adlib-glyph-offset-y',
              `${offset}px`
            );
          } else {
            adlibGlyphs.style.removeProperty('--live-adlib-glyph-offset-y');
          }
        }

        if (!translationBounds?.width || !translationBounds.height) {
          if (ref.style.marginTop) ref.style.marginTop = '';
          return;
        }

        const appliedOffset = parseFloat(ref.style.marginTop) || 0;
        const unshiftedTop = translationBounds.top - appliedOffset;
        const translationBoxHeight = translationBounds.height;
        const unshiftedBottom = unshiftedTop + translationBoxHeight;
        const requiredOffset = mainObstacles.reduce((offset, obstacle) => {
          const overlapsHorizontally =
            translationBounds.left < obstacle.right &&
            translationBounds.right > obstacle.left;
          const touchesOrOverlapsVertically =
            unshiftedTop <= obstacle.bottom &&
            unshiftedBottom >= obstacle.top;
          if (!overlapsHorizontally || !touchesOrOverlapsVertically) return offset;
          return Math.max(offset, obstacle.bottom + minimumGap - unshiftedTop);
        }, 0);
        const nextOffset = `${Math.max(0, requiredOffset)}px`;
        if (ref.style.marginTop !== nextOffset) ref.style.marginTop = nextOffset;
      });
    };

    positionAdlibTranslations();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const resizeObserver = new ResizeObserver(positionAdlibTranslations);
    [
      parentMainRef.current,
      parentPronRef.current,
      ...adlibRefs.current,
      ...adlibRefs.current.map(ref => ref?.querySelector('.chunk-translation'))
    ].filter(Boolean).forEach(element => resizeObserver.observe(element));
    return () => resizeObserver.disconnect();
  }, [savedNode?.adlibs, mainPronunciationJSX, mainTranslationJSX, focusedMainLyrics]);

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
       isAdlib: true // Flags isolated ad-lib so parens are omitted in engine processing
    });

    return (
      <React.Fragment key={`simple-adlib-${bIdx}`}>
        <span
          ref={el => adlibRefs.current[bIdx] = el}
          className={`adlib-container adlib-node ${initialClass}`}
          data-start={start !== null ? start : 'NaN'}
          data-end={end !== null ? end : 'NaN'}
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            verticalAlign: 'middle',
            position: 'relative',
            maxWidth: '100%',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
            marginInlineStart: '0.25em'
          }}
        >
          {adlibTransJSX ? (
            <span className="chunk-translation live-translation" dir="ltr">
              {adlibTransJSX}
            </span>
          ) : null}
          <span className="primary-text" style={{ display: 'inline', whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'normal', margin: 0, padding: 0 }} dir="auto">
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
            ref={parentMainRef}
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              verticalAlign: 'middle',
              margin: '0',
              width: 'auto',
              maxWidth: '100%',
              textAlign: 'left',
              boxSizing: 'border-box'
            }}
        >
          {mainTranslationJSX ? (
            <span className="chunk-translation live-translation" dir="ltr">
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
            {useTranslationFormatting
              ? renderTranslationOriginalText(lineObj, masterPalette, {
                savedNode,
                excludeAdlibs: true
              })
              : focusedMainJSX}
          </span>
          {mainPronunciationJSX && (
            <span
                ref={parentPronRef}
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
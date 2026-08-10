/* --- src/components/Workspaces/Translation/TranslationRow.jsx --- */
import React from 'react';
import { getGraphemes } from '../../LyricsRenderer/textUtils';

const TranslationRow = ({
  line,
  idx,
  masterPalette,
  activeTranslatingId,
  isTranslatingAll,
  activeRowRef,
  handleChange,
  handleRefetch
}) => {
  const isAdlib = line._meta.isAdlib;
  const isTranslating = activeTranslatingId === line.rowId;
  
  // Detect if the line is explicitly tagged as Japanese or Chinese
  const isCJK = line.lang === 'ja' || line.lang?.startsWith('zh');

  const renderTextWithYellowPunctuation = (text, baseStyle = {}, isAdlibChar = false) => {
    if (!text) return null;
    const chars = getGraphemes(text);
    return chars.map((char, pIdx) => {
      const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(char);
      let style = { ...baseStyle };
      if (isPunct && char.trim() !== '' && !isAdlibChar) {
        style.color = '#fbbf24';
        style.WebkitTextFillColor = '#fbbf24';
        style.textShadow = '0 0 10px rgba(251, 191, 36, 0.6)';
      }
      return <span key={pIdx} style={style}>{char}</span>;
    });
  };

  const renderColoredOriginalText = () => {
    const isMainAndSplit = !line._meta.isAdlib && line.isSplit && line.adlibs;
    if (line.segments && line.segments.length > 0) {
      let globalCharIndex = 0;
      let cpIdx = 0;
      return line.segments.map((seg, idxSeg) => {
        let inlineColor = seg.color || '#ffffff';
        let inlineIsGradient = seg.isGradient || false;
        let inlineGradient = seg.gradient || '';

        if (seg.artists && seg.artists.length > 0) {
          if (seg.artists.length > 1) {
            inlineIsGradient = true;
            const c1 = masterPalette[seg.artists[0]] || '#ffffff';
            const c2 = masterPalette[seg.artists[1]] || '#ffffff';
            inlineGradient = `linear-gradient(90deg, ${c1}, ${c2})`;
          } else {
            inlineColor = masterPalette[seg.artists[0]] || inlineColor;
          }
        }

        const segChars = getGraphemes(seg.text);
        const charElements = segChars.map((char) => {
          const cIdx = globalCharIndex++;
          const cpLen = Array.from(char).length;
          const currentCpStart = cpIdx;
          cpIdx += cpLen;

          const isAdlibChar = isMainAndSplit && line.adlibs.some(a => currentCpStart >= a.charStart && currentCpStart < a.charEnd);

          let segStyle = inlineIsGradient ? {
            backgroundImage: inlineGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          } : {
            color: inlineColor
          };

          if (isAdlibChar) {
            segStyle = {
              ...segStyle,
              opacity: 0.35,
              textDecoration: 'line-through 2px white',
              textDecorationColor: '#ffffff'
            };
          }

          return (
            <React.Fragment key={cIdx}>
              {renderTextWithYellowPunctuation(char, segStyle, isAdlibChar)}
            </React.Fragment>
          );
        });

        return <React.Fragment key={idxSeg}>{charElements}</React.Fragment>;
      });
    }

    const defaultColor = line.singer ? masterPalette[line.singer.split(/\s*(?:&|,|\band\b)\s*/i)[0]?.trim()] || '#ffffff' : '#ffffff';
    if (isMainAndSplit) {
      const chars = getGraphemes(line.displayText);
      let cpIdx = 0;
      return chars.map((char, cIdx) => {
        const cpLen = Array.from(char).length;
        const currentCpStart = cpIdx;
        cpIdx += cpLen;
        const isAdlibChar = line.adlibs.some(a => currentCpStart >= a.charStart && currentCpStart < a.charEnd);
        let baseStyle = { color: defaultColor };
        
        if (isAdlibChar) {
          baseStyle = {
            ...baseStyle,
            opacity: 0.35,
            textDecoration: 'line-through 2px white',
            textDecorationColor: '#ffffff'
          };
        }
        return (
          <React.Fragment key={cIdx}>
            {renderTextWithYellowPunctuation(char, baseStyle, isAdlibChar)}
          </React.Fragment>
        );
      });
    }

    return renderTextWithYellowPunctuation(line.displayText, { color: defaultColor }, false);
  };

  return (
    <div
      ref={isTranslating ? activeRowRef : null}
      className={`tw-row ${isAdlib ? 'tw-row-adlib' : ''} ${isTranslating ? 'tw-row-active' : ''}`}
    >
      <div className="tw-col tw-col-left">
        <div className="tw-original-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            className="tw-lang-tag-input"
            value={line.lang || 'auto'}
            onChange={(e) => handleChange(idx, 'lang', e.target.value.toLowerCase().trim())}
            title="Language Tag (e.g. auto, ko, ja, en, es)"
          />
          <div className="tw-original-text" dir="ltr" style={{ textAlign: 'left', flex: 1 }}>
            {renderColoredOriginalText()}
          </div>
        </div>

        {/* NEW SPACING FIELD FOR CJK */}
        {isCJK && (
          <input
            className="tw-input tw-spacing-input"
            value={line.spacingText || ''}
            onChange={(e) => handleChange(idx, 'spacingText', e.target.value)}
            placeholder="Spacing Field (Leave empty for Legacy Format)..."
            dir="ltr"
            style={{ textAlign: 'left', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
            title="Define custom spacing. Leave empty to use the Legacy Format of Japanese and Chinese."
          />
        )}

        <input
          className="tw-input tw-translit-input"
          value={line.displayPron || ''}
          onChange={(e) => handleChange(idx, 'displayPron', e.target.value)}
          placeholder="Transliteration..."
          dir="ltr"
          style={{ textAlign: 'left' }}
        />
      </div>

      <div className="tw-col tw-col-right">
        <textarea
          className="tw-input tw-translation-input"
          value={line.translation || ''}
          onChange={(e) => handleChange(idx, 'translation', e.target.value)}
          placeholder="English Translation..."
          dir="ltr"
          style={{ textAlign: 'left' }}
        />
      </div>

      <div className="tw-col-actions">
        <button
          className={`tw-refetch-btn ${isTranslating ? 'tw-refetch-active' : ''}`}
          onClick={() => handleRefetch(idx)}
          disabled={isTranslatingAll}
          title="Re-fetch from Google Translate"
        >
          {isTranslating ? (
            <span className="tw-spinner"></span>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default TranslationRow;
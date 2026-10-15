/* --- src/components/Workspaces/Translation/TranslationRow.jsx --- */
import React from 'react';
import TranslationOriginalText from '../../../../components/LyricsRenderer/TranslationOriginalText.jsx';

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
            <TranslationOriginalText line={line} masterPalette={masterPalette} />
          </div>
        </div>

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
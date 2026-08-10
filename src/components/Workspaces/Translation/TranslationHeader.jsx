/* --- src/components/Workspaces/Translation/TranslationHeader.jsx --- */
import React, { useRef } from 'react';

const TranslationHeader = ({
  isTranslatingAll,
  isAutoSpacing,
  translateProgress,
  handleAutoSpacing,
  handleTranslateAll,
  handleTranslateWithContext,
  handleRefreshWorkspace,
  handleExport,
  handleImportText,
  handleCancel,
  handleSave,
  cancelTranslationRef
}) => {
  const importFileInputRef = useRef(null);

  return (
    <div className="tw-header glass-panel">
      <div className="tw-header-actions full-width-actions">
        <button
          className={`tw-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
          onClick={handleTranslateAll}
          disabled={isAutoSpacing}
        >
          {isTranslatingAll ? (
            <>
              <span className="tw-spinner"></span>
              <span>Stop Translation</span>
            </>
          ) : (
            'Translate All'
          )}
        </button>
        
        <button
          className={`tw-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
          onClick={handleTranslateWithContext}
          style={{ background: 'rgba(179, 136, 235, 0.2)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
          disabled={isAutoSpacing}
        >
          Translate with Context
        </button>

        <button
          className={`tw-btn ${isAutoSpacing ? 'tw-btn-loading' : ''}`}
          onClick={handleAutoSpacing}
          style={{ background: 'rgba(56, 189, 248, 0.2)', borderColor: '#38bdf8', color: '#38bdf8' }}
          disabled={isTranslatingAll || isAutoSpacing}
          title="Reverse-engineer API transliteration payloads to automatically inject proper sentence spacing for Japanese and Chinese lines"
        >
          {isAutoSpacing ? (
            <>
              <span className="tw-spinner" style={{ borderTopColor: '#38bdf8' }}></span>
              <span>Spacing...</span>
            </>
          ) : (
            'Auto Spacing'
          )}
        </button>
        
        <button
          className="tw-btn"
          onClick={handleRefreshWorkspace}
          disabled={isTranslatingAll || isAutoSpacing}
          title="Wipe all translation, spacing and transliteration fields"
          style={{ background: 'rgba(250, 36, 60, 0.15)', borderColor: 'rgba(250, 36, 60, 0.3)', color: '#FA243C' }}
        >
          Refresh Lyrics
        </button>
        
        <button className="tw-btn" onClick={handleExport} disabled={isTranslatingAll || isAutoSpacing}>
          Export Text
        </button>
        
        <input
          type="file"
          accept=".txt,text/plain"
          ref={importFileInputRef}
          style={{ display: 'none' }}
          onChange={handleImportText}
        />
        <button className="tw-btn" onClick={() => importFileInputRef.current?.click()} disabled={isTranslatingAll || isAutoSpacing}>
          Import Text
        </button>
        
        <div className="tw-header-spacer"></div>
        
        <button className="tw-btn tw-btn-cancel" onClick={handleCancel}>Cancel</button>
        <button
          className="tw-btn tw-btn-save"
          onClick={() => handleSave(cancelTranslationRef)}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default TranslationHeader;
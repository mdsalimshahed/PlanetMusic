/* --- src/components/Workspaces/Translation/TranslationHeader.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  handleSave,
  cancelTranslationRef,
  onCloseEditor
}) => {
  const importFileInputRef = useRef(null);
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(document.querySelector('.translation-workspace-controls-slot'));
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <div className="tw-header-actions full-width-actions">
      <div className="tw-header-primary-actions">
        <button
          className={`edit-links-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
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
          className={`edit-links-btn ${isTranslatingAll ? 'tw-btn-loading' : ''}`}
          onClick={handleTranslateWithContext}
          disabled={isAutoSpacing}
        >
          Translate with Context
        </button>

        <button
          className={`edit-links-btn ${isAutoSpacing ? 'tw-btn-loading' : ''}`}
          onClick={handleAutoSpacing}
          disabled={isTranslatingAll || isAutoSpacing}
          title="Reverse-engineer API transliteration payloads to automatically inject proper sentence spacing for Japanese and Chinese lines"
        >
          {isAutoSpacing ? (
            <>
              <span className="tw-spinner"></span>
              <span>Spacing...</span>
            </>
          ) : (
            'Auto Spacing'
          )}
        </button>
      </div>

      <div className="tw-header-tools">
        <button
          className="edit-links-btn"
          onClick={handleRefreshWorkspace}
          disabled={isTranslatingAll || isAutoSpacing}
          title="Wipe all translation, spacing and transliteration fields"
        >
          Refresh Lyrics
        </button>
        
        <button className="edit-links-btn" onClick={handleExport} disabled={isTranslatingAll || isAutoSpacing}>
          Export Text
        </button>
        
        <input
          type="file"
          accept=".txt,text/plain"
          ref={importFileInputRef}
          style={{ display: 'none' }}
          onChange={handleImportText}
        />
        <button className="edit-links-btn" onClick={() => importFileInputRef.current?.click()} disabled={isTranslatingAll || isAutoSpacing}>
          Import Text
        </button>
      </div>

      <div className="tw-header-footer">
        <button className="edit-links-btn close-editor-btn" onClick={() => onCloseEditor?.()}>
          Close Editor
        </button>
        <button
          className="edit-links-btn save-mode"
          onClick={() => handleSave(cancelTranslationRef)}
        >
          Save Changes
        </button>
      </div>
    </div>,
    portalTarget
  );
};

export default TranslationHeader;
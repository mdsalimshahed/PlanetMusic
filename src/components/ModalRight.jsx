/* --- src/components/ModalRight.jsx --- */
import React from 'react';
import DynamicBackground from './DynamicBackground';
import ImageManager from './ImageManager';
import { SyncWorkspace } from './SyncWorkspace';
import LyricsDisplay from './LyricsDisplay';
import TranslationWorkspace from './TranslationWorkspace';
import AdlibDebugOverlay from './AdlibDebug/AdlibDebugOverlay';
import './ModalRight.css';

const ModalRight = (props) => {
  if (props.isTranslationManagerOpen) {
      return (
          <div className="modal-right-col glass-panel-light">
              <TranslationWorkspace {...props} />
          </div>
      );
  }

  return (
    <div className="modal-right-col glass-panel-light">
      {props.isImageManagerOpen && <ImageManager {...props} />}
      
      {/* Background Layers */}
      {props.lyricsViewMode !== 'plain' && !props.isSyncMode && !props.isEditing && !props.isImageManagerOpen && (
        <DynamicBackground {...props} />
      )}

      {/* Main Core Workspaces */}
      {props.isSyncMode && !props.isImageManagerOpen ? (
        <SyncWorkspace {...props} />
      ) : !props.isImageManagerOpen && (
        <LyricsDisplay {...props} />
      )}

      {/* Experimental Debug Layers */}
      {props.showAdlibDebug && props.lyricsViewMode === 'focused' && !props.isSyncMode && !props.isEditing && (
        <AdlibDebugOverlay {...props} />
      )}
    </div>
  );
};

export default ModalRight;
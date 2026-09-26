/* --- src/components/Modals/ModalRight.jsx --- */
import DynamicBackground from '../../../Application/components/Core/DynamicBackground.jsx';
import ImageManager from '../../../Studio/components/Workspaces/Lyrics/ImageManager.jsx';
import { SyncWorkspace } from '../../../Studio/components/Workspaces/Sync/SyncWorkspace.jsx';
import LyricsDisplay from '../../../Studio/components/Workspaces/Lyrics/LyricsDisplay.jsx';
import TranslationWorkspace from '../../../Studio/components/Workspaces/Translation/TranslationWorkspace.jsx';
import AdlibDebugOverlay from '../AdlibDebug/AdlibDebugOverlay.jsx';
import LiveDebugOverlay from '../LiveDebug/LiveDebugOverlay.jsx';
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
        <LyricsDisplay
          isEditing={props.isEditing}
          customData={props.customData}
          handleDataChange={props.handleDataChange}
          hasValidSyncData={props.hasValidSyncData}
          lyricsViewMode={props.lyricsViewMode}
          liveParsedLyrics={props.liveParsedLyrics}
          handleLineClick={props.handleLineClick}
          selectedSong={props.selectedSong}
          masterPalette={props.masterPalette}
          currentTrack={props.currentTrack}
          isPlaying={props.isPlaying}
          settings={props.settings}
        />
      )}

      {/* Experimental Debug Layers */}
      {props.showAdlibDebug && props.lyricsViewMode === 'focused' && !props.isSyncMode && !props.isEditing && (
        <AdlibDebugOverlay {...props} />
      )}
      
      {props.showLiveDebug && props.lyricsViewMode === 'live' && !props.isSyncMode && !props.isEditing && (
        <LiveDebugOverlay {...props} />
      )}

    </div>
  );
};

export default ModalRight;
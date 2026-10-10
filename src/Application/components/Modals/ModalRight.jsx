/* --- src/components/Modals/ModalRight.jsx --- */
import { useEffect, useRef, useState } from 'react';
import DynamicBackground from '../../../Application/components/Core/DynamicBackground.jsx';
import ImageManager from '../../../Studio/components/Workspaces/Lyrics/ImageManager.jsx';
import { SyncWorkspace } from '../../../Studio/components/Workspaces/Sync/SyncWorkspace.jsx';
import LyricsDisplay from '../../../Studio/components/Workspaces/Lyrics/LyricsDisplay.jsx';
import TranslationWorkspace from '../../../Studio/components/Workspaces/Translation/TranslationWorkspace.jsx';
import AdlibDebugOverlay from '../AdlibDebug/AdlibDebugOverlay.jsx';
import LiveDebugOverlay from '../LiveDebug/LiveDebugOverlay.jsx';
import './ModalRight.css';

const ModalRight = (props) => {
  const canvasRef = useRef(null);
  const [isMobileCanvas, setIsMobileCanvas] = useState(false);
  const [isCanvasActive, setIsCanvasActive] = useState(false);
  const isCanvasInactive = isMobileCanvas && !isCanvasActive;

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    const updateMobileCanvas = () => {
      setIsMobileCanvas(mobileQuery.matches);
      setIsCanvasActive(false);
      if (!mobileQuery.matches) canvasRef.current?.blur();
    };

    updateMobileCanvas();
    mobileQuery.addEventListener('change', updateMobileCanvas);
    return () => mobileQuery.removeEventListener('change', updateMobileCanvas);
  }, []);

  const activateCanvas = () => {
    setIsCanvasActive(true);
    canvasRef.current?.focus();
  };

  const handleCanvasBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsCanvasActive(false);
    }
  };

  return (
    <div
      ref={canvasRef}
      className={`modal-right-col glass-panel-light${isMobileCanvas && isCanvasActive ? ' is-canvas-active' : ''}`}
      tabIndex={isMobileCanvas ? (isCanvasActive ? 0 : -1) : undefined}
      role="region"
      aria-label="Song canvas"
      onBlur={isMobileCanvas ? handleCanvasBlur : undefined}
      onClick={isCanvasInactive ? activateCanvas : undefined}
    >
      {props.lyricsViewMode !== 'plain' && !props.isSyncMode && !props.isEditing && !props.isImageManagerOpen && !props.isTranslationManagerOpen && (
        <DynamicBackground {...props} />
      )}

      <div className="modal-canvas-content" inert={isCanvasInactive} aria-hidden={isCanvasInactive}>
        {props.isTranslationManagerOpen ? (
          <TranslationWorkspace {...props} />
        ) : (
          <>
            {props.isImageManagerOpen && <ImageManager {...props} />}

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
                singerImages={props.singerImages}
                globalArtistData={props.globalArtistData}
                currentTrack={props.currentTrack}
                isPlaying={props.isPlaying}
                settings={props.settings}
                lyricsPlaybackOffsetSeconds={props.lyricsPlaybackOffsetSeconds}
                showGroupChatDebug={props.showGroupChatDebug}
              />
            )}

            {/* Experimental Debug Layers */}
            {props.showAdlibDebug && props.lyricsViewMode === 'focused' && !props.isSyncMode && !props.isEditing && (
              <AdlibDebugOverlay {...props} />
            )}

            {props.showLiveDebug && props.lyricsViewMode === 'live' && !props.isSyncMode && !props.isEditing && (
              <LiveDebugOverlay {...props} />
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default ModalRight;
/* --- src/components/Modals/ModalRight.jsx --- */
import { useEffect, useRef, useState } from 'react';
import DynamicBackground from '../../../Application/components/Core/DynamicBackground.jsx';
import ImageManager from '../../../Studio/components/Workspaces/Lyrics/ImageManager.jsx';
import { SyncWorkspace } from '../../../Studio/components/Workspaces/Sync/SyncWorkspace.jsx';
import LyricsDisplay from '../../../Studio/components/Workspaces/Lyrics/LyricsDisplay.jsx';
import TranslationWorkspace from '../../../Studio/components/Workspaces/Translation/TranslationWorkspace.jsx';
import AutomatedTranslationRunner from '../../../Studio/components/Workspaces/Translation/AutomatedTranslationRunner.jsx';
import AdlibDebugOverlay from '../AdlibDebug/AdlibDebugOverlay.jsx';
import LiveDebugOverlay from '../LiveDebug/LiveDebugOverlay.jsx';
import './ModalRight.css';

const ModalRight = (props) => {
  const canvasRef = useRef(null);
  const [isMobileCanvas, setIsMobileCanvas] = useState(false);
  const [isCanvasActive, setIsCanvasActive] = useState(false);
  const isCanvasInactive = isMobileCanvas && !isCanvasActive;
  const canvasProps = {
    ...props,
    settings: props.settings?.disableAnimations
      ? { ...props.settings, disableAnimations: false }
      : props.settings
  };

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
        <DynamicBackground {...canvasProps} />
      )}

      <div className="modal-canvas-content" inert={isCanvasInactive} aria-hidden={isCanvasInactive}>
        {props.isTranslationManagerOpen ? (
          <TranslationWorkspace {...canvasProps} />
        ) : (
          <>
            {props.isImageManagerOpen && <ImageManager {...canvasProps} />}

            {/* Main Core Workspaces */}
            {props.isSyncMode && !props.isImageManagerOpen ? (
              <SyncWorkspace {...canvasProps} />
            ) : !props.isImageManagerOpen && (
              <LyricsDisplay
                isEditing={canvasProps.isEditing}
                customData={canvasProps.customData}
                handleDataChange={canvasProps.handleDataChange}
                setIsEditing={canvasProps.setIsEditing}
                handleAutoSyncDatabases={canvasProps.handleAutoSyncDatabases}
                isLrcFetching={canvasProps.isLrcFetching}
                hasValidSyncData={canvasProps.hasValidSyncData}
                lyricsViewMode={canvasProps.lyricsViewMode}
                liveParsedLyrics={canvasProps.liveParsedLyrics}
                handleLineClick={canvasProps.handleLineClick}
                selectedSong={canvasProps.selectedSong}
                isSaved={canvasProps.isSaved}
                masterPalette={canvasProps.masterPalette}
                singerImages={canvasProps.singerImages}
                globalArtistData={canvasProps.globalArtistData}
                currentTrack={canvasProps.currentTrack}
                isPlaying={canvasProps.isPlaying}
                settings={canvasProps.settings}
                lyricsPlaybackOffsetSeconds={canvasProps.lyricsPlaybackOffsetSeconds}
                showGroupChatDebug={canvasProps.showGroupChatDebug}
              />
            )}

            {/* Experimental Debug Layers */}
            {canvasProps.showAdlibDebug && canvasProps.lyricsViewMode === 'focused' && !canvasProps.isSyncMode && !canvasProps.isEditing && (
              <AdlibDebugOverlay {...canvasProps} />
            )}

            {canvasProps.showLiveDebug && canvasProps.lyricsViewMode === 'live' && !canvasProps.isSyncMode && !canvasProps.isEditing && (
              <LiveDebugOverlay {...canvasProps} />
            )}
          </>
        )}
      </div>
      {props.automatedTranslationRequest && (
        <div aria-hidden="true" style={{ display: 'none' }}>
          <AutomatedTranslationRunner
            key={props.automatedTranslationRequest.id}
            request={props.automatedTranslationRequest}
            customData={props.automatedTranslationRequest.customData}
            masterPalette={canvasProps.masterPalette}
            updateSongInLibrary={canvasProps.updateSongInLibrary}
            setNotification={canvasProps.setNotification}
            onComplete={props.onAutomatedTranslationComplete}
          />
        </div>
      )}

    </div>
  );
};

export default ModalRight;
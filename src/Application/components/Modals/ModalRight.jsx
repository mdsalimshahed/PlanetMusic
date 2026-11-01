/* --- src/components/Modals/ModalRight.jsx --- */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import DynamicBackground from '../../../Application/components/Core/DynamicBackground.jsx';
import LyricsDisplay from '../../../Studio/components/Workspaces/Lyrics/LyricsDisplay.jsx';
import './ModalRight.css';

const ImageManager = lazy(() => import('../../../Studio/components/Workspaces/Lyrics/ImageManager.jsx'));
const SyncWorkspace = lazy(() => import('../../../Studio/components/Workspaces/Sync/SyncWorkspace.jsx').then(module => ({
  default: module.SyncWorkspace
})));
const TranslationWorkspace = lazy(() => import('../../../Studio/components/Workspaces/Translation/TranslationWorkspace.jsx'));
const AutomatedTranslationRunner = lazy(() => import('../../../Studio/components/Workspaces/Translation/AutomatedTranslationRunner.jsx'));
const AdlibDebugOverlay = lazy(() => import('../AdlibDebug/AdlibDebugOverlay.jsx'));
const LiveDebugOverlay = lazy(() => import('../LiveDebug/LiveDebugOverlay.jsx'));

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
        <Suspense fallback={<div className="empty-message glass-panel" role="status">Loading workspace…</div>}>
          {props.isTranslationManagerOpen ? (
            <TranslationWorkspace {...canvasProps} />
          ) : (
            <>
              {props.isImageManagerOpen && <ImageManager {...canvasProps} />}

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
                  shouldAnimateLiveEntrance={canvasProps.shouldAnimateLiveEntrance}
                />
              )}

              {canvasProps.showAdlibDebug && canvasProps.lyricsViewMode === 'focused' && !canvasProps.isSyncMode && !canvasProps.isEditing && (
                <AdlibDebugOverlay {...canvasProps} />
              )}

              {canvasProps.showLiveDebug && canvasProps.lyricsViewMode === 'live' && !canvasProps.isSyncMode && !canvasProps.isEditing && (
                <LiveDebugOverlay {...canvasProps} />
              )}
            </>
          )}
        </Suspense>
      </div>
      {props.automatedTranslationRequest && (
        <div aria-hidden="true" style={{ display: 'none' }}>
          <Suspense fallback={null}>
            <AutomatedTranslationRunner
              key={props.automatedTranslationRequest.id}
              request={props.automatedTranslationRequest}
              customData={props.automatedTranslationRequest.customData}
              masterPalette={canvasProps.masterPalette}
              updateSongInLibrary={canvasProps.updateSongInLibrary}
              setNotification={canvasProps.setNotification}
              onComplete={props.onAutomatedTranslationComplete}
            />
          </Suspense>
        </div>
      )}

    </div>
  );
};

export default ModalRight;
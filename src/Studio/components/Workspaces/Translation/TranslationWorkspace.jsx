/* --- src/components/Workspaces/Translation/TranslationWorkspace.jsx --- */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConfirmModal from '../../../../Application/components/Modals/ConfirmModal.jsx';
import TranslationHeader from './TranslationHeader.jsx';
import TranslationRow from './TranslationRow.jsx';
import WorkspaceTip from '../WorkspaceTip.jsx';
import { useTranslationWorkspaceData } from '../../../hooks/translation/useTranslationWorkspaceData.js';
import { useTranslationProcess } from '../../../hooks/translation/useTranslationProcess.js';
import './TranslationWorkspace.css';

const TranslationWorkspace = ({
  selectedSong,
  realSelectedSong,
  isSaved,
  customData,
  masterPalette,
  updateSongInLibrary,
  setIsTranslationManagerOpen,
  setNotification,
  registerTranslationCancelHandler,
  closeTranslationWorkspace
}) => {
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Discard Changes',
    cancelText: 'Cancel',
    onConfirm: () => {}
  });

  const {
    workspaceData,
    setWorkspaceData,
    isLoading,
    hasUnsavedChanges,
    listContainerRef,
    handleChange,
    handleSave,
    handleExport,
    handleImportText
  } = useTranslationWorkspaceData({
    selectedSong,
    realSelectedSong,
    isSaved,
    customData,
    masterPalette,
    updateSongInLibrary,
    setIsTranslationManagerOpen,
    setNotification,
    setConfirmModalState
  });

  const {
    isTranslatingAll,
    isAutoSpacing,
    activeTranslatingId,
    showSuccessBanner,
    translateProgress,
    activeRowRef,
    cancelTranslationRef,
    handleAutoSpacing,
    handleRefreshWorkspace,
    handleSpaceNonSpacedLanguages,
    handleTranslateAll,
    handleTranslateWithContext,
    handleRefetch,
    handleCancel
  } = useTranslationProcess({
    workspaceData,
    setWorkspaceData,
    listContainerRef,
    setNotification,
    setConfirmModalState,
    setIsTranslationManagerOpen,
    hasUnsavedChanges
  });

  useEffect(() => {
    registerTranslationCancelHandler?.(handleCancel);
    return () => registerTranslationCancelHandler?.(null);
  }, [handleCancel, registerTranslationCancelHandler]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleGlobalCaptureClick = (e) => {
      const workspaceContainer = document.querySelector('.tw-container');
      const workspaceControls = document.querySelector('.workspace-controls');
      const modalOverlay = document.querySelector('.confirm-modal-overlay');
      if (modalOverlay && modalOverlay.contains(e.target)) return;
      if (workspaceControls && workspaceControls.contains(e.target)) return;

      if (workspaceContainer && !workspaceContainer.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const pendingTarget = e.target;
        setConfirmModalState({
          isOpen: true,
          title: "Unsaved Changes",
          message: "You have unsaved translation changes. Are you sure you want to navigate away and discard them?",
          confirmText: "Discard & Continue",
          cancelText: "Keep Editing",
          onConfirm: () => {
            setConfirmModalState(prev => ({ ...prev, isOpen: false }));
            cancelTranslationRef.current = true;
            setIsTranslationManagerOpen(false);
            setTimeout(() => {
              if (pendingTarget && typeof pendingTarget.click === 'function') {
                pendingTarget.click();
              }
            }, 50);
          }
        });
      }
    };

    window.addEventListener('click', handleGlobalCaptureClick, true);
    return () => {
      window.removeEventListener('click', handleGlobalCaptureClick, true);
    };
  }, [hasUnsavedChanges, setIsTranslationManagerOpen, cancelTranslationRef]);

  if (isLoading) return <div className="tw-container"><p>Loading workspace...</p></div>;

  return (
    <div className="tw-container">
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        cancelText={confirmModalState.cancelText}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
      />
      <WorkspaceTip
        title="Translate and refine your lyrics"
        guideTo="/docs/dev-blog/post/complete-guide-to-the-translation-workspace"
        guideLabel="Translation Workspace guide"
      >
        <ul>
          <li>
            <svg className="workspace-tip-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 8 4 4-4 4M12 16h7" />
              <path d="M3 3h18v18H3z" />
            </svg>
            <span>Use <strong className="workspace-tip-action workspace-tip-action--translate">Translate All</strong> for each line, or <strong className="workspace-tip-action workspace-tip-action--context">Translate with Context</strong> when nearby lyrics help explain meaning. Read the <Link to="/docs/dev-blog/post/complete-guide-to-the-translation-workspace">translation workflow guide</Link>.</span>
          </li>
          <li>
            <svg className="workspace-tip-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M4 12h10M4 17h7" />
              <path d="m17 15 3 3-3 3" />
            </svg>
            <span>For Chinese or Japanese, use <strong className="workspace-tip-action workspace-tip-action--spacing">Auto Spacing</strong> to add readable word breaks. See the <Link to="/docs/dev-blog/post/understanding-autospacing-engine-cjk">CJK Auto Spacing guide</Link>.</span>
          </li>
          <li>
            <svg className="workspace-tip-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m-5-5 5 5 5-5" />
              <path d="M5 17v4h14v-4" />
            </svg>
            <span>Review each translation and pronunciation, then <strong className="workspace-tip-action workspace-tip-action--save">Save Changes</strong>; use <strong className="workspace-tip-action workspace-tip-action--file">Import/Export Text</strong> to transfer a draft.</span>
          </li>
        </ul>
      </WorkspaceTip>
      <TranslationHeader
        isTranslatingAll={isTranslatingAll}
        isAutoSpacing={isAutoSpacing}
        translateProgress={translateProgress}
        handleAutoSpacing={handleAutoSpacing}
        handleTranslateAll={handleTranslateAll}
        handleTranslateWithContext={handleTranslateWithContext}
        handleSpaceNonSpacedLanguages={handleSpaceNonSpacedLanguages}
        handleRefreshWorkspace={handleRefreshWorkspace}
        handleExport={handleExport}
        handleImportText={handleImportText}
        handleSave={handleSave}
        cancelTranslationRef={cancelTranslationRef}
        onCloseEditor={closeTranslationWorkspace}
      />
      {showSuccessBanner && (
        <div className="tw-success-banner">
          <span className="tw-success-icon"> </span>
          <span>All lines translated successfully! Click <strong>Save Changes</strong> to apply to lyrics.</span>
        </div>
      )}
      <div className="tw-list glass-panel-light" ref={listContainerRef}>
        {workspaceData.map((line, idx) => (
          <TranslationRow
            key={line.rowId}
            line={line}
            idx={idx}
            masterPalette={masterPalette}
            activeTranslatingId={activeTranslatingId}
            isTranslatingAll={isTranslatingAll}
            activeRowRef={activeRowRef}
            handleChange={handleChange}
            handleRefetch={handleRefetch}
          />
        ))}
      </div>
    </div>
  );
};

export default TranslationWorkspace;
/* --- src/components/Workspaces/Translation/TranslationWorkspace.jsx --- */
import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../../../Application/components/Modals/ConfirmModal.jsx';
import TranslationHeader from './TranslationHeader.jsx';
import TranslationRow from './TranslationRow.jsx';
import { useTranslationWorkspaceData } from '../../../hooks/translation/useTranslationWorkspaceData.js';
import { useTranslationProcess } from '../../../hooks/translation/useTranslationProcess.js';
import './TranslationWorkspace.css';

const TranslationWorkspace = ({
  selectedSong,
  customData,
  masterPalette,
  updateSongInLibrary,
  setIsTranslationManagerOpen,
  setNotification
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
    if (!hasUnsavedChanges) return;
    const handleGlobalCaptureClick = (e) => {
      const workspaceContainer = document.querySelector('.tw-container');
      const modalOverlay = document.querySelector('.confirm-modal-overlay');
      if (modalOverlay && modalOverlay.contains(e.target)) return;

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
        handleCancel={handleCancel}
        handleSave={handleSave}
        cancelTranslationRef={cancelTranslationRef}
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
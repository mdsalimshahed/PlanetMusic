/* --- src/hooks/translation/useTranslationProcess.js --- */
import { useState, useRef, useEffect } from 'react';
import { useAutoSpacing } from './useAutoSpacing';
import { useTranslationBatch } from './useTranslationBatch';

export const useTranslationProcess = ({
  workspaceData,
  setWorkspaceData,
  listContainerRef,
  setNotification,
  setConfirmModalState,
  setIsTranslationManagerOpen,
  hasUnsavedChanges
}) => {
  const [activeTranslatingId, setActiveTranslatingId] = useState(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0 });

  const activeRowRef = useRef(null);
  const cancelTranslationRef = useRef(false);

  useEffect(() => {
    if (activeTranslatingId !== null && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeTranslatingId]);

  useEffect(() => {
    return () => {
      cancelTranslationRef.current = true;
    };
  }, []);

  // 1. Initialize Batch Translation Module
  const {
    isTranslatingAll,
    stopTranslationProcess,
    handleTranslateAll,
    handleTranslateWithContext,
    handleRefetch
  } = useTranslationBatch({
    workspaceData,
    setWorkspaceData,
    listContainerRef,
    cancelTranslationRef,
    setTranslateProgress,
    setNotification,
    setActiveTranslatingId,
    setShowSuccessBanner
  });

  // 2. Initialize Auto Spacing Module
  const {
    isAutoSpacing,
    handleAutoSpacing
  } = useAutoSpacing({
    workspaceData,
    setWorkspaceData,
    isTranslatingAll,
    cancelTranslationRef,
    setTranslateProgress,
    setNotification,
    setActiveTranslatingId
  });

  const handleRefreshWorkspace = () => {
    setConfirmModalState({
      isOpen: true,
      title: "Wipe All Translations",
      message: "Are you sure you want to refresh lyrics? This will wipe out all translation, transliteration, spacing fields, and reset language tags to auto.",
      confirmText: "Wipe Fields",
      cancelText: "Cancel",
      onConfirm: () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        cancelTranslationRef.current = true;
        setActiveTranslatingId(null);
        
        setWorkspaceData(prev => prev.map(line => ({
          ...line,
          translation: '',
          displayPron: '',
          pronunciation: '',
          spacingText: '', 
          lang: 'auto'
        })));
        
        if (listContainerRef.current) listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        
        setNotification({ show: true, message: 'Wiped all translation and transliteration fields!', progress: 100 });
        setTimeout(() => setNotification({ show: false }), 2000);
      }
    });
  };

  const handleCancel = () => {
    if (isTranslatingAll || isAutoSpacing) {
      stopTranslationProcess();
      return;
    }

    if (hasUnsavedChanges) {
      setConfirmModalState({
        isOpen: true,
        title: "Discard Translation Changes?",
        message: "You have unsaved translation changes. Are you sure you want to discard them and close?",
        confirmText: "Discard & Close",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
          cancelTranslationRef.current = true;
          setIsTranslationManagerOpen(false);
        }
      });
      return;
    }
    
    cancelTranslationRef.current = true;
    setIsTranslationManagerOpen(false);
  };

  return {
    isTranslatingAll,
    isAutoSpacing,
    activeTranslatingId,
    showSuccessBanner,
    translateProgress,
    activeRowRef,
    cancelTranslationRef,
    handleAutoSpacing,
    handleRefreshWorkspace,
    handleTranslateAll,
    handleTranslateWithContext,
    handleRefetch,
    handleCancel
  };
};
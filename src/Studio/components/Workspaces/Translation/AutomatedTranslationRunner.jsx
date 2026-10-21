import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslationWorkspaceData } from '../../../hooks/translation/useTranslationWorkspaceData.js';
import { useTranslationProcess } from '../../../hooks/translation/useTranslationProcess.js';
import { getDetectedForeignLanguageNames } from '../../../utils/automatedTranslationUtils.js';

const noop = () => {};

const AutomatedTranslationRunner = ({
  request,
  customData,
  masterPalette,
  updateSongInLibrary,
  setNotification,
  onComplete
}) => {
  const [stage, setStage] = useState('waiting');
  const listContainerRef = useRef(null);
  const cancelTranslationRef = useRef(false);
  const actionsRef = useRef(null);
  const setConfirmModalState = noop;
  const setPipelineNotification = useCallback(notification => {
    if (notification.show === false) return;
    setNotification(notification);
  }, [setNotification]);

  const {
    workspaceData,
    setWorkspaceData,
    isLoading,
    handleSave
  } = useTranslationWorkspaceData({
    selectedSong: request.song,
    customData,
    masterPalette,
    updateSongInLibrary,
    setIsTranslationManagerOpen: noop,
    setNotification: setPipelineNotification,
    setConfirmModalState
  });
  const process = useTranslationProcess({
    workspaceData,
    setWorkspaceData,
    listContainerRef,
    setNotification: setPipelineNotification,
    setConfirmModalState,
    setIsTranslationManagerOpen: noop,
    hasUnsavedChanges: false
  });
  useEffect(() => {
    actionsRef.current = {
      ...process,
      handleSave,
      workspaceData
    };
  }, [handleSave, process, workspaceData]);

  useEffect(() => {
    if (!request?.id || isLoading || stage === 'complete' || stage === 'failed') return undefined;
    let cancelled = false;
    const runStage = async () => {
      try {
        if (stage === 'waiting') {
          setPipelineNotification({
            show: true,
            message: 'Translating lyrics and detecting languages...',
            progress: 15
          });
          await actionsRef.current.handleTranslateAll();
          if (!cancelled) setStage('context');
          return;
        }

        if (stage === 'context') {
          const latestWorkspaceData = actionsRef.current.workspaceData;
          const languages = getDetectedForeignLanguageNames(latestWorkspaceData);
          setPipelineNotification({
            show: true,
            message: languages.length
              ? `Detected ${languages.join(', ')}. Running context translation...`
              : 'No foreign-language lyrics detected. Checking line context...',
            progress: 60
          });
          await actionsRef.current.handleTranslateWithContext();
          if (!cancelled) setStage('spacing');
          return;
        }

        if (stage === 'spacing') {
          const latestWorkspaceData = actionsRef.current.workspaceData;
          const hasCjkLines = latestWorkspaceData.some(line =>
            line.lang === 'ja' || line.lang?.startsWith('zh')
          );
          if (hasCjkLines) {
            setPipelineNotification({
              show: true,
              message: 'Running automatic spacing for Chinese and Japanese lyrics...',
              progress: 85
            });
            await actionsRef.current.handleAutoSpacing();
          }
          if (!cancelled) setStage('save');
          return;
        }

        if (stage === 'save') {
          const latestWorkspaceData = actionsRef.current.workspaceData;
          const detectedLanguages = getDetectedForeignLanguageNames(latestWorkspaceData);
          const updatedSong = actionsRef.current.handleSave(cancelTranslationRef, { quiet: true });
          const spacingMessage = latestWorkspaceData.some(line =>
            (line.lang === 'ja' || line.lang?.startsWith('zh')) &&
            Boolean(line.spacingText?.trim())
          )
            ? ' Auto spacing is ready.'
            : '';
          setPipelineNotification({
            show: true,
            message: `Lyrics and sync data loaded.${detectedLanguages.length
              ? ` Translations prepared for ${detectedLanguages.join(', ')}.`
              : ''}${spacingMessage}`,
            progress: 100
          });
          setStage('complete');
          onComplete?.(updatedSong);
        }
      } catch (error) {
        console.error('Automated translation preparation failed.', error);
        setPipelineNotification({
          show: true,
          message: 'Lyrics and sync data loaded, but automatic translation preparation failed. You can retry from Translation Workspace.',
          progress: 100
        });
        setStage('failed');
        onComplete?.(null);
      }
    };

    runStage();
    return () => {
      cancelled = true;
    };
  }, [
    onComplete,
    isLoading,
    request?.id,
    setPipelineNotification,
    stage
  ]);

  return null;
};

export default AutomatedTranslationRunner;

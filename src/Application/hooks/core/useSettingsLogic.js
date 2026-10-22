/* --- src/hooks/useSettingsLogic.js --- */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { getProceduralColor, getProceduralGradient } from '../../../utils/proceduralColors.js';
import { fetchDeezerApi } from '../../services/deezerBackend.js';
import {
  cacheArlVerification,
  getCachedArlVerification
} from '../../services/deezerArlVerificationCache.js';
import { packVault, unpackVault } from '../../services/vaultCodec.js';

export const useSettingsLogic = (settings, setSettings, dismissSampleMode) => {
  const [showArl, setShowArl] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(
    settings.deezerArlValid === true ? 'success' : null
  );
  const [verifyErrorMessage, setVerifyErrorMessage] = useState('');
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const verificationRequestRef = useRef(null);
  const verificationSequenceRef = useRef(0);
  const arlInputRef = useRef(settings.deezerArl?.trim() || '');

  const authGradient = useMemo(() => {
    return getProceduralGradient('settings:auth');
  }, []);

  const sliderGradients = useMemo(() => {
    const keys = [
      'cardWidth', 'cardPadding', 'cardGap', 'cardFontSize', 'borderRadius',
      'cosmosSplitRatio', 'liveSyncLineGap', 'liveSyncFontSize', 'focusedSyncFontSize', 'focusedAdlibFontSize',
      'artistNameFontSize', 'bgPreemptionTime', 'artistTransitionTime', 'bgImageOpacity',
      'modalSplitRatio', 'modalPaddingY', 'modalFontSize', 'eqFadeOutTime',
      'groupChatActiveAvatarSize', 'groupChatInactiveAvatarSize',
      'groupChatBubbleAvatarSize', 'groupChatArtistNameSize',
      'groupChatTimestampSize', 'groupChatNotificationSize',
      'groupChatAvatarRingThickness',
      'groupChatLyricFontSize', 'groupChatLineWrapWidth',
      'groupChatTypingFontSize', 'groupChatTypingAvatarSize',
      'translationOpacity', 'translationFontSize', 'translationTopPadding',
      'transliterationOpacity', 'transliterationFontSize', 'transliterationBottomPadding'
    ];
    
    const gradMap = {};
    keys.forEach((key) => {
      gradMap[key] = [
        getProceduralColor(`settings:slider:${key}:start`),
        getProceduralColor(`settings:slider:${key}:end`)
      ];
    });
    return gradMap;
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (dismissSampleMode) dismissSampleMode();

    if (name === 'deezerArl') {
      const arl = value.trim();
      arlInputRef.current = arl;
      verificationRequestRef.current?.controller.abort();
      verificationRequestRef.current = null;
      setIsVerifying(false);
      setVerifyResult(null);
      setSettings(prev => ({
        ...prev,
        deezerArl: value,
        deezerArlValid: false,
        rememberDeezerArl: Boolean(arl)
      }));
      return;
    }
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? checked 
        : (type === 'color' || type === 'text' || type === 'password' ? value : Number(value))
    }));
  };

  const verifyArl = useCallback((arlValue) => {
    const arl = arlValue?.trim() || '';
    if (!arl) return Promise.resolve(null);

    const cachedResult = getCachedArlVerification(arl);
    if (cachedResult) {
      setVerifyResult(cachedResult);
      setVerifyErrorMessage('');
      if (
        settings.deezerArlValid !== (cachedResult === 'success') ||
        (cachedResult === 'success' && settings.rememberDeezerArl !== true)
      ) {
        setSettings(prev => ({
          ...prev,
          deezerArlValid: cachedResult === 'success',
          rememberDeezerArl: cachedResult === 'success' ? true : prev.rememberDeezerArl
        }));
      }
      return Promise.resolve(cachedResult);
    }

    const existingRequest = verificationRequestRef.current;
    if (existingRequest?.arl === arl) return existingRequest.promise;
    existingRequest?.controller.abort();

    const controller = new AbortController();
    const requestId = ++verificationSequenceRef.current;
    setIsVerifying(true);
    setVerifyResult('checking');
    setVerifyErrorMessage('');

    const promise = (async () => {
      let result = null;
      let isCurrentRequest;
      try {
        const formData = new FormData();
        formData.append('session_id', `test_${Date.now()}`);
        formData.append('url', 'https://www.deezer.com/track/3135556');
        formData.append('arl_token', arl);
        formData.append('quality', '1');
        formData.append('action', 'stream');
        formData.append('local_dir', '');
        formData.append('obfuscate', 'true');
        const response = await fetchDeezerApi('/download-deezer', {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/octet-stream' },
          cache: 'no-store',
          signal: controller.signal
        });

        if (response.ok) {
          if (response.headers.get('content-type')?.includes('application/json')) {
            const verification = await response.json();
            result = verification.success ? 'success' : 'error';
          } else {
            const reader = response.body?.getReader();
            if (reader) {
              await reader.read();
              await reader.cancel();
            } else {
              await response.body?.cancel();
            }
            result = 'success';
          }
        } else {
          result = response.status === 400 ? 'error' : 'unavailable';
          if (result === 'unavailable') {
            const responseData = await response.clone().json().catch(() => null);
            setVerifyErrorMessage(
              response.status === 503 && responseData?.error
                ? `${responseData.error} Check the Cloudflare Pages Preview backend configuration.`
                : `The backend could not verify this ARL (HTTP ${response.status}). Please retry later.`
            );
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('ARL verification request failed.', error);
          result = 'unavailable';
          setVerifyErrorMessage(
            'The backend could not be reached to verify this ARL. Please retry later.'
          );
        }
      } finally {
        const request = verificationRequestRef.current;
        isCurrentRequest = request?.id === requestId && !controller.signal.aborted;
        if (request?.id === requestId) {
          verificationRequestRef.current = null;
          setIsVerifying(false);
        }
      }

      if (isCurrentRequest && result) {
        cacheArlVerification(arl, result);
      }

      if (isCurrentRequest && arlInputRef.current === arl && result) {
        setVerifyResult(result);
        if (result !== 'unavailable') {
          setSettings(prev => {
            const isValid = result === 'success';
            if (
              prev.deezerArlValid === isValid &&
              (result !== 'success' || prev.rememberDeezerArl === true)
            ) return prev;
            return prev.deezerArl?.trim() === arl
              ? {
                ...prev,
                deezerArlValid: isValid,
                rememberDeezerArl: isValid ? true : prev.rememberDeezerArl
              }
              : prev;
          });
        }
      }
      return result;
    })();

    verificationRequestRef.current = { id: requestId, arl, controller, promise };
    return promise;
  }, [setSettings, settings.deezerArlValid, settings.rememberDeezerArl]);

  useEffect(() => {
    const arl = settings.deezerArl?.trim() || '';
    arlInputRef.current = arl;
    if (!arl || settings.deezerArlValid === true) return undefined;

    const timeout = setTimeout(() => {
      verifyArl(arl);
    }, 350);
    return () => clearTimeout(timeout);
  }, [settings.deezerArl, settings.deezerArlValid, verifyArl]);

  useEffect(() => () => {
    const request = verificationRequestRef.current;
    verificationRequestRef.current = null;
    request?.controller.abort();
  }, []);

  const handleVerifyArl = useCallback(() => verifyArl(settings.deezerArl), [
    settings.deezerArl,
    verifyArl
  ]);

  const handlePurgeAllData = () => {
    const scrollTop = document.querySelector('.content-scroll-area')?.scrollTop ?? 0;
    try {
      sessionStorage.setItem('planetmusic.purgeScrollTop', String(scrollTop));
    } catch (error) {
      console.error('Could not preserve the page position during purge.', error);
    }

    try {
      const rawLibrary = localStorage.getItem('songLibrary');
      const parsedLibrary = rawLibrary ? unpackVault(JSON.parse(rawLibrary)).library : [];
      const optimizedLibrary = parsedLibrary.map(song => {
        const optimizedSong = { ...song, lyrics: song.lyrics || "", syncData: song.syncData || [] };
        delete optimizedSong.artworkUrl30;
        delete optimizedSong.artworkUrl60;
        delete optimizedSong.trackCensoredName;
        delete optimizedSong.collectionCensoredName;
        delete optimizedSong.artistViewUrl;
        delete optimizedSong.trackViewUrl;
        return optimizedSong;
      });
      
      const exportSettings = { ...settings };
      delete exportSettings.deezerArl;
      delete exportSettings.rememberDeezerArl;
      const jsonString = JSON.stringify(packVault({ library: optimizedLibrary, settings: exportSettings }));
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `PlanetMusic_Purge_Backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Backup trigger failed before purge:", e);
    }
    localStorage.clear();
    try {
      sessionStorage.removeItem('planetmusic.deezerArl');
    } catch {
      // Continue clearing other app data if session storage is unavailable.
    }
    localStorage.setItem('hasVisitedBefore', 'true');
    localStorage.setItem('isSampleVaultActive', 'false');
    
    if (window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('PlanetMusicDB');
      } catch (err) {
        console.error("Failed to delete IndexedDB:", err);
      }
    }
    window.location.reload();
  };

  const getSliderStyle = (key, progressPct) => {
    const [c1, c2] = sliderGradients[key] || ['#00f5d4', '#00bbf9'];
    return {
      backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`,
      '--progress': `${progressPct}%`
    };
  };

  return {
    showArl, setShowArl,
    isVerifying,
    verifyResult, setVerifyResult, verifyErrorMessage,
    showPurgeConfirm, setShowPurgeConfirm,
    authGradient,
    handleChange,
    handleVerifyArl,
    handlePurgeAllData,
    getSliderStyle
  };
};
/* --- src/hooks/useSettingsLogic.js --- */
import { useState, useMemo } from 'react';
import { getProceduralColor, getProceduralGradient } from '../../../utils/proceduralColors.js';
import { fetchDeezerApi } from '../../services/deezerBackend.js';

export const useSettingsLogic = (settings, setSettings, dismissSampleMode) => {
  const [showArl, setShowArl] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const authGradient = useMemo(() => {
    return getProceduralGradient('settings:auth');
  }, []);

  const sliderGradients = useMemo(() => {
    const keys = [
      'cardWidth', 'cardPadding', 'cardGap', 'cardFontSize', 'borderRadius',
      'cosmosSplitRatio', 'liveSyncLineGap', 'liveSyncFontSize', 'focusedSyncFontSize', 'focusedAdlibFontSize',
      'artistNameFontSize', 'bgPreemptionTime', 'artistTransitionTime', 'bgImageOpacity',
      'modalSplitRatio', 'modalPaddingY', 'modalFontSize', 'eqFadeOutTime',
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
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? checked 
        : (type === 'color' || type === 'text' || type === 'password' ? value : Number(value))
    }));
  };

  const handleVerifyArl = async () => {
    if (!settings.deezerArl) {
      setVerifyResult('error');
      return;
    }
    
    setIsVerifying(true);
    setVerifyResult(null);
    
    try {
      const formData = new FormData();
      formData.append('session_id', `test_${Date.now()}`);
      formData.append('url', 'https://www.deezer.com/track/3135556');
      formData.append('arl_token', settings.deezerArl);
      formData.append('quality', '1');
      formData.append('action', 'stream');
      formData.append('local_dir', '');
      formData.append('obfuscate', 'true');
      const response = await fetchDeezerApi('/download-deezer', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/octet-stream' },
        cache: 'no-store'
      });
      
      if (response.ok) {
        if (response.headers.get('content-type')?.includes('application/json')) {
          const result = await response.json();
          setVerifyResult(result.success ? 'success' : 'error');
          return;
        }
        // Verification only needs the server response; never consume a full MP3 in settings.
        const reader = response.body?.getReader();
        if (reader) {
          await reader.read();
          await reader.cancel();
        } else {
          await response.body?.cancel();
        }
        setVerifyResult('success');
      } else {
        setVerifyResult('error');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setVerifyResult('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePurgeAllData = () => {
    try {
      const rawLibrary = localStorage.getItem('songLibrary');
      const parsedLibrary = rawLibrary ? JSON.parse(rawLibrary) : [];
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
      
      const exportData = { 
        library: optimizedLibrary, 
        settings: { ...settings } 
      };
      delete exportData.settings.deezerArl;
      const jsonString = JSON.stringify(exportData, null, 2);
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
    localStorage.setItem('hasVisitedBefore', 'true');
    localStorage.setItem('isSampleVaultActive', 'false');
    
    if (window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('PlanetMusicDB');
      } catch (err) {
        console.error("Failed to delete IndexedDB:", err);
      }
    }
    window.location.href = '/';
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
    verifyResult, setVerifyResult,
    showPurgeConfirm, setShowPurgeConfirm,
    authGradient,
    handleChange,
    handleVerifyArl,
    handlePurgeAllData,
    getSliderStyle
  };
};
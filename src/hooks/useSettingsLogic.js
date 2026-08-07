/* --- src/hooks/useSettingsLogic.js --- */
import { useState, useMemo } from 'react';

const DUAL_GRADIENT_PALETTE = [
  ['#00f5d4', '#00bbf9'],
  ['#38b000', '#00f5d4'],
  ['#ffc300', '#ff7000'],
  ['#ff7000', '#f15bb5'],
  ['#f15bb5', '#e0aaff'],
  ['#00bbf9', '#e0aaff'],
  ['#e0aaff', '#ff99c8'],
  ['#ff99c8', '#ffc300'],
  ['#00f5d4', '#ffc300'],
  ['#38b000', '#f15bb5'],
  ['#00bbf9', '#ff7000'],
  ['#e0aaff', '#38b000']
];

export const useSettingsLogic = (settings, setSettings, dismissSampleMode) => {
  const [showArl, setShowArl] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const authGradient = useMemo(() => {
    const palette = DUAL_GRADIENT_PALETTE[Math.floor(Math.random() * DUAL_GRADIENT_PALETTE.length)];
    return `linear-gradient(90deg, ${palette[0]}, ${palette[1]})`;
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
    
    const palettePool = [...DUAL_GRADIENT_PALETTE];
    
    for (let i = palettePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.sin(i * 9999) * 10000) % (i + 1);
      const positiveJ = Math.abs(j);
      [palettePool[i], palettePool[positiveJ]] = [palettePool[positiveJ], palettePool[i]];
    }
    const gradMap = {};
    let lastPair = null;
    keys.forEach((key, index) => {
      let candidatePair = palettePool[index % palettePool.length];
      if (lastPair && candidatePair[0] === lastPair[0] && candidatePair[1] === lastPair[1]) {
        const offsetIndex = (index + 1) % palettePool.length;
        candidatePair = palettePool[offsetIndex];
      }
      gradMap[key] = candidatePair;
      lastPair = candidatePair;
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
      const response = await fetch('https://ytdownloader-jnt0.onrender.com/download-deezer', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
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
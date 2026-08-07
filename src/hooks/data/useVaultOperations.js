/* --- src/hooks/useVaultOperations.js --- */
import { useState, useEffect } from 'react';

export const useVaultOperations = ({
  library, setLibrary, settings, setSettings,
  isSampleVaultActive, setIsSampleVaultActive,
  selectedSong, handleSetSelectedSong, setCurrentTrack, handleHomeClick
}) => {
  const [songToRemove, setSongToRemove] = useState(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const dismissSampleMode = () => {
    if (isSampleVaultActive) {
      setIsSampleVaultActive(false);
      localStorage.setItem('isSampleVaultActive', 'false');
      localStorage.setItem('hasVisitedBefore', 'true');
    }
  };

  const handleSetSettings = (newSettingsAction) => {
    dismissSampleMode();
    setSettings(newSettingsAction);
  };

  const applyParsedData = (parsedData, shouldRedirect = true) => {
    const newLibrary = [...library];
    const mergeSongs = (importedSongs) => {
      importedSongs.forEach(newSong => {
        const existingIdx = newLibrary.findIndex(s => s.trackId === newSong.trackId);
        if (existingIdx >= 0) newLibrary[existingIdx] = { ...newLibrary[existingIdx], ...newSong };
        else newLibrary.push(newSong);
      });
    };
    if (parsedData.library && Array.isArray(parsedData.library)) {
      mergeSongs(parsedData.library);
      setLibrary(newLibrary);
      if (parsedData.settings) setSettings(prev => ({ ...prev, ...parsedData.settings }));
      if (shouldRedirect) handleHomeClick();
    } else if (Array.isArray(parsedData)) {
      mergeSongs(parsedData);
      setLibrary(newLibrary);
      if (shouldRedirect) handleHomeClick();
    }
  };

  useEffect(() => {
    const autoLoadSampleOnMount = async () => {
      const hasVisitedBefore = localStorage.getItem('hasVisitedBefore');
      if (library.length === 0 && !hasVisitedBefore) {
        setIsLoadingSample(true);
        try {
          const res = await fetch('/PlanetMusic_Backup.json');
          if (res.ok) {
            const data = await res.json();
            applyParsedData(data, false);
            localStorage.setItem('hasVisitedBefore', 'true');
            localStorage.setItem('isSampleVaultActive', 'true');
            setIsSampleVaultActive(true);
          }
        } catch (err) {
          console.warn("Could not auto-load sample vault on mount:", err);
        } finally {
          setIsLoadingSample(false);
        }
      }
    };
    autoLoadSampleOnMount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearSampleVault = () => {
    setLibrary([]);
    localStorage.removeItem('songLibrary');
    localStorage.setItem('isSampleVaultActive', 'false');
    localStorage.setItem('hasVisitedBefore', 'true');
    setIsSampleVaultActive(false);
  };

  const handleKeepSampleVault = () => {
    dismissSampleMode();
  };

  const toggleLibrary = (e, song) => {
    if (e) e.stopPropagation();
    dismissSampleMode();
    const isSaved = library.some((s) => s.trackId === song.trackId);
    
    if (isSaved) {
      setSongToRemove(song);
    } else {
      setLibrary([...library, song]);
    }
  };

  const confirmRemove = () => {
    if (songToRemove) {
      dismissSampleMode();
      setLibrary(library.filter((s) => s.trackId !== songToRemove.trackId));
      if (selectedSong?.trackId === songToRemove.trackId) handleSetSelectedSong(null);
      setSongToRemove(null);
    }
  };

  const cancelRemove = () => {
    setSongToRemove(null);
  };

  const updateSongInLibrary = (updatedSong) => {
    dismissSampleMode();
    setLibrary(prevLibrary => {
      const exists = prevLibrary.some(s => s.trackId === updatedSong.trackId);
      if (exists) {
        return prevLibrary.map(s => s.trackId === updatedSong.trackId ? updatedSong : s);
      } else {
        return [...prevLibrary, updatedSong];
      }
    });
    handleSetSelectedSong(updatedSong);
    setCurrentTrack(prevTrack => {
      if (prevTrack && prevTrack.trackId === updatedSong.trackId) {
        return { ...prevTrack, ...updatedSong };
      }
      return prevTrack;
    });
  };

  const handleExport = () => {
    if (library.length === 0) return alert("Your vault is empty! Add songs before exporting.");
    
    const optimizedLibrary = library.map(song => {
      const optimizedSong = { ...song, lyrics: song.lyrics || "", syncData: song.syncData || [] };
      delete optimizedSong.artworkUrl30;
      delete optimizedSong.artworkUrl60;
      delete optimizedSong.trackCensoredName;
      delete optimizedSong.collectionCensoredName;
      delete optimizedSong.artistViewUrl;
      delete optimizedSong.trackViewUrl;
      return optimizedSong;
    });
    
    const exportData = { library: optimizedLibrary, settings: { ...settings } };
    delete exportData.settings.deezerArl;
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PlanetMusic_Backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target ? event.target.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedData = JSON.parse(e.target.result);
        dismissSampleMode();
        applyParsedData(parsedData);
      } catch (err) {
        alert('Could not read the JSON file.');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = null;
  };

  const handleLoadSample = async () => {
    setIsLoadingSample(true);
    try {
      const res = await fetch('/PlanetMusic_Backup.json');
      if (!res.ok) {
        throw new Error('File not found');
      }
      const data = await res.json();
      applyParsedData(data, true);
      localStorage.setItem('isSampleVaultActive', 'true');
      localStorage.setItem('hasVisitedBefore', 'true');
      setIsSampleVaultActive(true);
    } catch (err) {
      alert("Could not load sample backup file from public folder. Please make sure 'PlanetMusic_Backup.json' is placed inside the 'public/' directory.");
    } finally {
      setIsLoadingSample(false);
    }
  };

  return {
    songToRemove,
    isLoadingSample,
    dismissSampleMode,
    handleSetSettings,
    handleClearSampleVault,
    handleKeepSampleVault,
    toggleLibrary,
    confirmRemove,
    cancelRemove,
    updateSongInLibrary,
    handleExport,
    handleImport,
    handleLoadSample
  };
};
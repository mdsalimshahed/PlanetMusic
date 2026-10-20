/* --- src/hooks/data/useVaultOperations.js --- */
import { useCallback, useState, useEffect, useRef } from 'react';
import { normalizeSongLyrics } from '../../../utils/smartPunctuation.js';
import { packVault, sanitizeVaultSettings, unpackVault } from '../../services/vaultCodec.js';
import { slugifyBlogLinkTitle } from '../../utils/blogRoutes.js';

export const useVaultOperations = ({
  library, setLibrary, settings, setSettings,
  isSampleVaultActive, setIsSampleVaultActive,
  selectedSong, handleSetSelectedSong, updateSelectedSongDirect, setCurrentTrack,
  isVaultRoute, navigate
}) => {
  const [songToRemove, setSongToRemove] = useState(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const sampleAutoLoadStartedRef = useRef(false);

  const dismissSampleMode = useCallback(() => {
    if (isSampleVaultActive) {
      setIsSampleVaultActive(false);
      localStorage.setItem('isSampleVaultActive', 'false');
      localStorage.setItem('hasVisitedBefore', 'true');
    }
  }, [isSampleVaultActive, setIsSampleVaultActive]);

  const handleSetSettings = (newSettingsAction) => {
    dismissSampleMode();
    setSettings(newSettingsAction);
  };

  const applyParsedData = (parsedData) => {
    if (!Array.isArray(parsedData) && !Array.isArray(parsedData?.library)) {
      throw new Error('This file does not contain a PlanetMusic song library.');
    }
    const decodedData = unpackVault(parsedData);
    if (!Array.isArray(decodedData.library)) {
      throw new Error('The backup contains an invalid song library.');
    }
    const newLibrary = [...library];
    const mergeSongs = (importedSongs) => {
      importedSongs.forEach(importedSong => {
        const newSong = normalizeSongLyrics(importedSong);
        const existingIdx = newLibrary.findIndex(s => String(s.trackId) === String(newSong.trackId));
        if (existingIdx >= 0) newLibrary[existingIdx] = { ...newLibrary[existingIdx], ...newSong };
        else newLibrary.push(newSong);
      });
    };

    mergeSongs(decodedData.library);
    setLibrary(newLibrary);
    if (decodedData.settings) {
      const importedSettings = sanitizeVaultSettings(decodedData.settings);
      setSettings(prev => ({ ...prev, ...importedSettings }));
    }
  };

  useEffect(() => {
    const autoLoadSampleOnVaultOpen = async () => {
      const hasVisitedBefore = localStorage.getItem('hasVisitedBefore');
      if (!isVaultRoute || library.length > 0 || hasVisitedBefore || sampleAutoLoadStartedRef.current) {
        return;
      }
      sampleAutoLoadStartedRef.current = true;
      setIsLoadingSample(true);
      try {
        const response = await fetch('/PlanetMusic_Backup.json');
        if (!response.ok) {
          throw new Error(`Sample backup request failed (${response.status})`);
        }
        const data = await response.json();
        const decodedData = unpackVault(data);
        if (!Array.isArray(decodedData.library)) {
          throw new Error('The sample backup does not contain a valid song library.');
        }
        applyParsedData(data);
        localStorage.setItem('hasVisitedBefore', 'true');
        localStorage.setItem('isSampleVaultActive', 'true');
        setIsSampleVaultActive(true);
      } catch (error) {
        console.error('Could not automatically load the sample vault.', error);
      } finally {
        setIsLoadingSample(false);
      }
    };
    autoLoadSampleOnVaultOpen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVaultRoute]);

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

  const toggleLibrary = useCallback((e, song) => {
    if (e) e.stopPropagation();
    dismissSampleMode();
    const isSaved = library.some((s) => s.trackId === song.trackId);
    
    if (isSaved) {
      setSongToRemove(song);
    } else {
      setLibrary([...library, song]);
    }
  }, [dismissSampleMode, library, setLibrary]);

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

    // Prevent iTunes preview fallback if custom sources exist
    if (updatedSong.customLinks?.hasLocal || updatedSong.customLinks?.yt || updatedSong.customLinks?.deezer) {
      if (updatedSong.previewUrl) {
        updatedSong.originalPreviewUrl = updatedSong.previewUrl;
      }
      updatedSong.previewUrl = ''; 
    } else if (updatedSong.originalPreviewUrl) {
      updatedSong.previewUrl = updatedSong.originalPreviewUrl;
    }

    const finalSong = normalizeSongLyrics(updatedSong);

    setLibrary(prevLibrary => {
      const exists = prevLibrary.some(s => String(s.trackId) === String(finalSong.trackId));
      if (exists) {
        return prevLibrary.map(s => String(s.trackId) === String(finalSong.trackId) ? finalSong : s);
      } else {
        return [...prevLibrary, finalSong];
      }
    });

    // Update selectedSong in memory directly without route navigation
    if (selectedSong && String(selectedSong.trackId) === String(finalSong.trackId)) {
      if (typeof updateSelectedSongDirect === 'function') {
        updateSelectedSongDirect(finalSong);
      }
    }

    // --- DUAL LINK VS LYRIC PLAYER CONTROLLER ---
    setCurrentTrack(prevTrack => {
      if (!prevTrack) return null;
      if (String(prevTrack.trackId) !== String(finalSong.trackId)) {
        // Edited song is NOT the active player track -> Leave player completely untouched
        return prevTrack;
      }

      // Check if any audio link source was edited
      const sameLocal = prevTrack.customLinks?.hasLocal === finalSong.customLinks?.hasLocal;
      const sameYt = prevTrack.customLinks?.yt === finalSong.customLinks?.yt;
      const sameDz = prevTrack.customLinks?.deezer === finalSong.customLinks?.deezer;
      const samePreview = prevTrack.previewUrl === finalSong.previewUrl;

      const linksModified = !sameLocal || !sameYt || !sameDz || !samePreview;

      if (linksModified) {
        // LINK EDITED: Force close/stop the player so it never gets stuck at 00:00
        return null;
      }

      // LYRICS ONLY EDITED: Keep exact object reference so audio stream continues uninterrupted
      return prevTrack;
    });
  };

  const handleExport = ({ songIds, includeSettings, includeDeezerArl, includeBlogPosts }) => {
    const selectedIds = new Set(songIds);
    const selectedSongs = library.filter(song => selectedIds.has(String(song.trackId)));
    const optimizedLibrary = selectedSongs.map(song => {
      const optimizedSong = { ...song, lyrics: song.lyrics || "", syncData: song.syncData || [] };
      delete optimizedSong.artworkUrl30;
      delete optimizedSong.artworkUrl60;
      delete optimizedSong.trackCensoredName;
      delete optimizedSong.collectionCensoredName;
      delete optimizedSong.artistViewUrl;
      delete optimizedSong.trackViewUrl;
      return optimizedSong;
    });
    
    const exportSettings = includeSettings ? sanitizeVaultSettings(settings) : {};
    if (!includeDeezerArl) delete exportSettings.deezerArl;
    else if (!includeSettings) exportSettings.deezerArl = settings.deezerArl;
    const payload = {
      ...packVault({
        library: optimizedLibrary,
        settings: Object.keys(exportSettings).length > 0 ? exportSettings : undefined
      }),
      backupOptions: {
        includesAppSettings: Boolean(includeSettings),
        includesDeezerArl: Boolean(includeDeezerArl),
        includesCustomBlogPosts: Boolean(includeBlogPosts)
      }
    };

    if (includeBlogPosts) {
      try {
        const posts = JSON.parse(localStorage.getItem('custom_blog_posts_storage') || '[]');
        if (!Array.isArray(posts)) throw new Error('Saved custom blog posts are not a valid list.');
        payload.customBlogPosts = posts;
      } catch (error) {
        console.error('Could not prepare custom blog posts for backup export.', error);
        alert('Could not include custom blog posts in the backup. Please check the saved blog data and try again.');
        return;
      }
    }

    const jsonString = JSON.stringify(payload);
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
        const decodedData = unpackVault(parsedData);
        if (!Array.isArray(parsedData) && !Array.isArray(parsedData?.library)) {
          throw new Error('This file does not contain a PlanetMusic song library.');
        }
        if (!Array.isArray(decodedData.library)) {
          throw new Error('The backup contains an invalid song library.');
        }
        const importedPosts = parsedData?.customBlogPosts;
        if (importedPosts !== undefined) {
          if (!Array.isArray(importedPosts) || importedPosts.some(post => !post || typeof post !== 'object' || Array.isArray(post))) {
            throw new Error('The backup contains invalid custom blog posts.');
          }
        }
        if (decodedData.settings !== undefined &&
          (!decodedData.settings || typeof decodedData.settings !== 'object' || Array.isArray(decodedData.settings))) {
          throw new Error('The backup contains invalid application settings.');
        }
        if (decodedData.library.some(song => !song || typeof song !== 'object' || Array.isArray(song) || song.trackId == null)) {
          throw new Error('The backup contains a song without a valid track ID.');
        }
        setPendingImport({
          fileName: file.name,
          library: decodedData.library,
          settings: decodedData.settings ? sanitizeVaultSettings(decodedData.settings) : undefined,
          customBlogPosts: importedPosts
        });
      } catch (err) {
        console.error('Could not import the selected PlanetMusic backup.', err);
        alert(err instanceof Error ? err.message : 'Could not read the JSON file.');
      }
    };
    reader.onerror = () => {
      console.error('Could not read the selected PlanetMusic backup file.', reader.error);
      alert('Could not read the selected backup file. Please try again.');
    };
    reader.readAsText(file);
    if (event.target) event.target.value = null;
  };

  const cancelImport = () => setPendingImport(null);

  const confirmImport = ({ songIds, includeSettings, includeDeezerArl, includeBlogPosts }) => {
    if (!pendingImport) return;
    try {
      const selectedIds = new Set(songIds);
      const selectedSongs = pendingImport.library.filter(song => selectedIds.has(String(song.trackId)));
      const importSettings = includeSettings || includeDeezerArl
        ? sanitizeVaultSettings(includeSettings ? pendingImport.settings || {} : {})
        : undefined;
      if (importSettings && !includeDeezerArl) delete importSettings.deezerArl;
      if (includeDeezerArl && pendingImport.settings?.deezerArl) {
        importSettings.deezerArl = pendingImport.settings.deezerArl;
        importSettings.rememberDeezerArl = true;
        importSettings.deezerArlValid = false;
      }

      let mergedPosts;
      if (includeBlogPosts && Array.isArray(pendingImport.customBlogPosts)) {
        const savedPosts = JSON.parse(localStorage.getItem('custom_blog_posts_storage') || '[]');
        if (!Array.isArray(savedPosts)) {
          throw new Error('Existing custom blog data is invalid. No backup data was imported.');
        }
        mergedPosts = [...savedPosts];
        pendingImport.customBlogPosts.forEach((importedPost) => {
          const normalizedPost = {
            ...importedPost,
            linkTitle: importedPost.linkTitle || importedPost.title || importedPost.id || '',
            isCustom: true
          };
          const normalizedSlug = slugifyBlogLinkTitle(normalizedPost.linkTitle);
          const existingIndex = mergedPosts.findIndex(post => (
            post.id === normalizedPost.id
            || slugifyBlogLinkTitle(post.linkTitle || post.title || post.id) === normalizedSlug
          ));
          if (existingIndex >= 0) mergedPosts[existingIndex] = normalizedPost;
          else mergedPosts.push(normalizedPost);
        });
        const linkSlugs = mergedPosts.map(post => slugifyBlogLinkTitle(post.linkTitle || post.title || post.id));
        if (linkSlugs.some((slug, index) => !slug || linkSlugs.indexOf(slug) !== index)) {
          throw new Error('The backup has custom blog link titles that conflict with posts already saved in this browser.');
        }
      }

      dismissSampleMode();
      applyParsedData({ library: selectedSongs, settings: importSettings });
      if (mergedPosts) {
        localStorage.setItem('custom_blog_posts_storage', JSON.stringify(mergedPosts));
        window.dispatchEvent(new Event('planetmusic-custom-blogs-updated'));
      }
      setPendingImport(null);
      navigate('/vault');
    } catch (err) {
      console.error('Could not import the selected PlanetMusic backup.', err);
      alert(err instanceof Error ? err.message : 'Could not import the selected backup.');
    }
  };

  const handleLoadSample = async () => {
    setIsLoadingSample(true);
    try {
      const res = await fetch('/PlanetMusic_Backup.json');
      if (!res.ok) {
        throw new Error('File not found');
      }
      const data = await res.json();
      applyParsedData(data);
      localStorage.setItem('isSampleVaultActive', 'true');
      localStorage.setItem('hasVisitedBefore', 'true');
      setIsSampleVaultActive(true);
      navigate('/vault');
    } catch (error) {
      console.error('Could not load sample backup file.', error);
      alert(`Could not load sample backup file: ${error.message}`);
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
    pendingImport,
    cancelImport,
    confirmImport,
    handleLoadSample
  };
};
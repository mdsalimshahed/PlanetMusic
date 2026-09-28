/* --- src/hooks/data/useAppStorage.js --- */
import { useState, useEffect } from 'react';
import { useRef } from 'react';
import { normalizeSongLyrics } from '../../../utils/smartPunctuation.js';
import { getStoredLibrary, saveStoredLibrary } from '../../services/db.js';

const DEEZER_ARL_STORAGE_KEY = 'planetmusic.deezerArl';

const readRememberedDeezerArl = () => {
  try {
    return localStorage.getItem(DEEZER_ARL_STORAGE_KEY)
      || sessionStorage.getItem(DEEZER_ARL_STORAGE_KEY)
      || '';
  } catch {
    return '';
  }
};

const updateRememberedDeezerArl = (arl) => {
  try {
    if (arl) localStorage.setItem(DEEZER_ARL_STORAGE_KEY, arl);
    else localStorage.removeItem(DEEZER_ARL_STORAGE_KEY);
    sessionStorage.removeItem(DEEZER_ARL_STORAGE_KEY);
  } catch {
    // Keep the token in React memory if browser storage is unavailable.
  }
};

const useDebouncedStorageWrite = (key, value) => {
  const pendingValueRef = useRef(null);
  const timerRef = useRef(null);
  const persistRef = useRef(() => {});

  persistRef.current = () => {
    const pendingValue = pendingValueRef.current;
    if (pendingValue === null) return;
    pendingValueRef.current = null;

    try {
      if (localStorage.getItem(key) !== pendingValue) {
        localStorage.setItem(key, pendingValue);
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('planetmusic:storage-error', {
        detail: { quota: error?.name === 'QuotaExceededError' || error?.code === 22 }
      }));
    }
  };

  useEffect(() => {
    pendingValueRef.current = key === 'searchQuery'
      ? value
      : key === 'isSampleVaultActive'
        ? (value ? 'true' : 'false')
        : JSON.stringify(key === 'appSettings' ? { ...value, deezerArl: undefined } : value);

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persistRef.current(), 500);
    return () => clearTimeout(timerRef.current);
  }, [key, value]);

  useEffect(() => {
    const flushPendingWrite = () => {
      if (document.visibilityState === 'hidden' || !document.visibilityState) {
        clearTimeout(timerRef.current);
        persistRef.current();
      }
    };

    document.addEventListener('visibilitychange', flushPendingWrite);
    window.addEventListener('pagehide', flushPendingWrite);
    return () => {
      document.removeEventListener('visibilitychange', flushPendingWrite);
      window.removeEventListener('pagehide', flushPendingWrite);
      clearTimeout(timerRef.current);
      persistRef.current();
    };
  }, []);
};

export const useAppStorage = (urlSearchQuery) => {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.bgImageOpacity === undefined) parsed.bgImageOpacity = 0.25;
      if (parsed.cosmosSplitRatio === undefined) parsed.cosmosSplitRatio = 60;
      if (parsed.cardFontSize === undefined) parsed.cardFontSize = 1.6;
      if (parsed.modalFontSize === undefined) parsed.modalFontSize = 5.5;
      if (parsed.liveSyncFontSize === undefined) parsed.liveSyncFontSize = 4.5;
      if (parsed.focusedSyncFontSize === undefined) parsed.focusedSyncFontSize = 5.5;
      if (parsed.focusedAdlibFontSize === undefined) parsed.focusedAdlibFontSize = 3.5;
      if (parsed.artistNameFontSize === undefined) parsed.artistNameFontSize = 3.5;
      if (parsed.modalSplitRatio === undefined) parsed.modalSplitRatio = 50;
      if (parsed.bgPreemptionTime === undefined) parsed.bgPreemptionTime = 400;
      if (parsed.modalPaddingY === undefined) parsed.modalPaddingY = 5;
      if (parsed.eqFadeOutTime === undefined) parsed.eqFadeOutTime = 500;
      if (parsed.translationColor === undefined) parsed.translationColor = '#ffffff';
      if (parsed.translationOpacity === undefined) parsed.translationOpacity = 0.9;
      if (parsed.transliterationColor === undefined) parsed.transliterationColor = '#ffffff';
      if (parsed.transliterationOpacity === undefined) parsed.transliterationOpacity = 0.8;
      if (parsed.cardWidth === undefined || parsed.cardWidth > 50) parsed.cardWidth = 12;
      
      // New Performance Setting
      if (parsed.disableAnimations === undefined) parsed.disableAnimations = false;
      
      if (parsed.adsEnabled === undefined) parsed.adsEnabled = true;
      parsed.rememberDeezerArl = parsed.rememberDeezerArl === true;
      parsed.deezerArl = parsed.rememberDeezerArl ? readRememberedDeezerArl() : '';
      if (!parsed.rememberDeezerArl) updateRememberedDeezerArl('');
      
      delete parsed.youtubeApiKey;
      delete parsed.spotifyClientId;
      delete parsed.spotifyClientSecret;
      delete parsed.persistentMemory; // Cleanup legacy setting if it exists
      
      return parsed;
    }
    return {
      cardFontSize: 1.6,
      modalFontSize: 5.5,
      cardWidth: 12,
      cardPadding: 16,
      cardGap: 28,
      isRounded: true,
      borderRadius: 16,
      bgImageOpacity: 0.25,
      cosmosSplitRatio: 60,
      liveSyncFontSize: 4.5,
      focusedSyncFontSize: 5.5,
      focusedAdlibFontSize: 3.5,
      artistNameFontSize: 3.5,
      modalSplitRatio: 50,
      bgPreemptionTime: 400,
      modalPaddingY: 5,
      eqFadeOutTime: 500,
      translationColor: '#ffffff',
      translationOpacity: 0.9,
      transliterationColor: '#ffffff',
      transliterationOpacity: 0.8,
      deezerArl: '',
      rememberDeezerArl: false,
      disableAnimations: false,
      adsEnabled: true
    };
  });

  const [searchQuery, setSearchQuery] = useState(() => {
    return urlSearchQuery || localStorage.getItem('searchQuery') || '';
  });

  const [searchResults, setSearchResults] = useState([]);

  const [library, setLibrary] = useState(() => {
    const saved = localStorage.getItem('songLibrary');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeSongLyrics) : [];
  });
  const libraryHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const hydrateLibrary = async () => {
      try {
        const storedLibrary = await getStoredLibrary();
        if (!isMounted) return;

        if (Array.isArray(storedLibrary)) {
          setLibrary(storedLibrary.map(normalizeSongLyrics));
        } else {
          const legacyLibrary = localStorage.getItem('songLibrary');
          const parsedLegacyLibrary = legacyLibrary ? JSON.parse(legacyLibrary) : [];
          if (Array.isArray(parsedLegacyLibrary) && parsedLegacyLibrary.length > 0) {
            const migratedLibrary = parsedLegacyLibrary.map(normalizeSongLyrics);
            await saveStoredLibrary(migratedLibrary);
            localStorage.removeItem('songLibrary');
            if (isMounted) setLibrary(migratedLibrary);
          }
        }
      } catch (error) {
        window.dispatchEvent(new CustomEvent('planetmusic:storage-error', { detail: { quota: false, error } }));
      } finally {
        if (isMounted) libraryHydratedRef.current = true;
      }
    };

    hydrateLibrary();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!libraryHydratedRef.current) return;
    saveStoredLibrary(library).catch((error) => {
      window.dispatchEvent(new CustomEvent('planetmusic:storage-error', { detail: { quota: false, error } }));
    });
  }, [library]);

  const [isSampleVaultActive, setIsSampleVaultActive] = useState(() => {
    return localStorage.getItem('isSampleVaultActive') === 'true';
  });

  // Synchronize input if user navigates through browser history
  useEffect(() => {
    if (urlSearchQuery !== searchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearchQuery]);
  useEffect(() => {
    updateRememberedDeezerArl(settings.rememberDeezerArl ? settings.deezerArl : '');
  }, [settings]);

  useDebouncedStorageWrite('appSettings', settings);
  useDebouncedStorageWrite('searchQuery', searchQuery);
  useDebouncedStorageWrite('isSampleVaultActive', isSampleVaultActive);

  return {
    settings, setSettings,
    library, setLibrary,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    isSampleVaultActive, setIsSampleVaultActive
  };
};
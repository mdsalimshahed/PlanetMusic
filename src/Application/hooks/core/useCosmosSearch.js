/* --- src/hooks/useCosmosSearch.js --- */
import { useState, useEffect, useRef } from 'react';
import { filterAndSortByTitleMatch, mergeOnlineSearchResults } from '../../utils/searchEngine.js';
import { fetchDeezerApi } from '../../services/deezerBackend.js';

export const useCosmosSearch = ({
  searchQuery, searchResults, setSearchResults,
  activeTab, urlSearchQuery, navigate, library, setIsExplicitSearch
}) => {
  const [searchingQuery, setSearchingQuery] = useState('');
  const searchRequestId = useRef(0);
  const activeSearchQuery = useRef('');
  const activeSearchController = useRef(null);
  const debounceTimer = useRef(null);

  const filteredLibrary = activeTab === 'vault' && searchQuery.trim()
    ? filterAndSortByTitleMatch(library, searchQuery)
    : library;
  const isSearching = Boolean(
    searchingQuery &&
    searchingQuery === searchQuery.trim() &&
    activeTab === 'vault' &&
    filteredLibrary.length === 0
  );

  const invalidateActiveSearch = () => {
    searchRequestId.current += 1;
    activeSearchQuery.current = '';
    activeSearchController.current?.abort();
    activeSearchController.current = null;
  };

  const performOnlineSearch = async (query) => {
    if (!query.trim()) return;
    activeSearchController.current?.abort();
    const controller = new AbortController();
    activeSearchController.current = controller;
    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    activeSearchQuery.current = query.trim();
    setSearchingQuery(query.trim());
    let itunesResults = [];
    let deezerResults = [];
    const publishResults = () => {
      if (searchRequestId.current !== requestId) return;
      const mergedResults = mergeOnlineSearchResults(itunesResults, deezerResults);
      setSearchResults(filterAndSortByTitleMatch(mergedResults, query));
    };

    const iTunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25&explicit=Yes&country=US`, {
      signal: controller.signal
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        itunesResults = Array.isArray(data.results) ? data.results : [];
        publishResults();
      })
      .catch(error => {
        if (!controller.signal.aborted) console.error('iTunes Search Error:', error);
      });

    const deezerPromise = fetchDeezerApi(`/search-deezer?q=${encodeURIComponent(query)}`, {
      signal: controller.signal
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        deezerResults = Array.isArray(data.results) ? data.results : [];
        publishResults();
      })
      .catch(error => {
        if (!controller.signal.aborted) console.error('Deezer Search Error:', error);
      });

    await Promise.allSettled([iTunesPromise, deezerPromise]);
    if (searchRequestId.current === requestId) {
      setSearchingQuery('');
      activeSearchController.current = null;
    }
  };

  useEffect(() => {
    if (activeTab !== 'vault') {
      invalidateActiveSearch();
      return;
    }
    if (!searchQuery.trim()) {
      invalidateActiveSearch();
      setSearchResults([]);
      setIsExplicitSearch(false);
      if (urlSearchQuery) navigate('/vault', { replace: true });
      return;
    }
    const isCurrentQueryAlreadySearched = activeSearchQuery.current === searchQuery.trim();
    if (!isCurrentQueryAlreadySearched) {
      invalidateActiveSearch();
    }
    setIsExplicitSearch(false);
    
    if (searchQuery.trim() !== urlSearchQuery) {
      navigate(`/vault?q=${encodeURIComponent(searchQuery.trim())}`, { replace: true });
    }

    if (filteredLibrary.length > 0) {
      invalidateActiveSearch();
      setSearchResults([]);
      return;
    }

    if (isCurrentQueryAlreadySearched) return;

    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      performOnlineSearch(searchQuery);
    }, 400);

    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeTab, filteredLibrary.length]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setIsExplicitSearch(true);
    navigate(`/vault?q=${encodeURIComponent(searchQuery.trim())}`);
    performOnlineSearch(searchQuery);
  };

  const uniqueOnlineResults = searchResults.filter(
    onlineSong => !filteredLibrary.some(localSong => 
      String(localSong.trackId) === String(onlineSong.trackId) ||
      (localSong.trackName.toLowerCase() === onlineSong.trackName.toLowerCase() && localSong.artistName.toLowerCase() === onlineSong.artistName.toLowerCase())
    )
  );

  return {
    isSearching,
    filteredLibrary,
    uniqueOnlineResults,
    handleSearchSubmit
  };
};
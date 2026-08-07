/* --- src/hooks/useCosmosSearch.js --- */
import { useState, useEffect } from 'react';
import { norm, filterAndSortByTitleMatch } from '../utils/searchEngine';

export const useCosmosSearch = ({
  searchQuery, searchResults, setSearchResults,
  activeTab, urlSearchQuery, navigate, library, setIsExplicitSearch
}) => {
  const [isSearching, setIsSearching] = useState(false);

  const filteredLibrary = activeTab === 'main' && searchQuery.trim() 
    ? filterAndSortByTitleMatch(library, searchQuery)
    : library;

  const performOnlineSearch = async (query) => {
    if (!query.trim()) return;
    setIsSearching(true);
    
    let currentResults = [];
    
    // Ensure iTunes results are strictly unique by ID before processing
    const processITunes = (items) => {
      const seenIds = new Set();
      const uniqueItems = [];
      items.forEach(song => {
        if (!seenIds.has(song.trackId)) {
          seenIds.add(song.trackId);
          uniqueItems.push({
            ...song,
            sourceNames: ['iTunes']
          });
        }
      });
      return uniqueItems;
    };

    const fuseDeezerAndDeduplicate = (existing, dzItems) => {
      // 1. Deduplicate Deezer's raw payload first (fixes the Deezer self-duplication bug)
      const uniqueDzMap = new Map();
      dzItems.forEach(dz => {
        const tId = `dz_${dz.id}`;
        if (!uniqueDzMap.has(tId)) {
          uniqueDzMap.set(tId, {
            trackId: tId,
            trackName: dz.title,
            artistName: dz.artist,
            collectionName: dz.album,
            artworkUrl100: dz.cover,
            trackTimeMillis: (dz.duration || 0) * 1000,
            previewUrl: '',
            trackExplicitness: 'explicit',
            sourceNames: ['Deezer'],
            customLinks: { deezer: dz.link }
          });
        }
      });
      const deezerResults = Array.from(uniqueDzMap.values());

      const finalResults = [];
      const matchedDeezerIds = new Set();

      // 2. Process existing (iTunes) and fuse identical Deezer tracks into them
      existing.forEach(song => {
        const normTitle = norm(song.trackName);
        const normArtist = norm(song.artistName);

        const dzMatch = deezerResults.find(dz => 
          !matchedDeezerIds.has(dz.trackId) &&
          norm(dz.trackName) === normTitle &&
          norm(dz.artistName) === normArtist
        );

        const formattedSong = { ...song };

        if (dzMatch) {
          formattedSong.sourceNames = Array.from(new Set([...(formattedSong.sourceNames || []), 'Deezer']));
          formattedSong.customLinks = { ...formattedSong.customLinks, deezer: dzMatch.customLinks.deezer };
          if (dzMatch.trackExplicitness === 'explicit') formattedSong.trackExplicitness = 'explicit';
          matchedDeezerIds.add(dzMatch.trackId);
        }

        finalResults.push(formattedSong);
      });

      // 3. Add any remaining Deezer tracks that didn't match an iTunes track
      deezerResults.forEach(dz => {
        if (!matchedDeezerIds.has(dz.trackId)) {
          finalResults.push(dz);
          matchedDeezerIds.add(dz.trackId); // Safety lock ensures we never add the same ID twice
        }
      });

      return finalResults;
    };

    try {
      const iTunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25&explicit=Yes&country=US`)
        .then(res => res.json())
        .then(data => {
          const formatted = processITunes(data.results || []);
          currentResults = formatted;
          setSearchResults(filterAndSortByTitleMatch(formatted, query));
          setIsSearching(false); 
          return data;
        })
        .catch(err => {
          console.error("iTunes Search Error:", err);
          return { results: [] };
        });

      const deezerPromise = fetch(`https://ytdownloader-jnt0.onrender.com/search-deezer?q=${encodeURIComponent(query)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data.results && data.results.length > 0) {
            const fused = fuseDeezerAndDeduplicate(currentResults, data.results);
            setSearchResults(filterAndSortByTitleMatch(fused, query));
          }
          return data;
        })
        .catch(err => {
          console.error("Deezer Search Error:", err);
          return { results: [] };
        });

      await Promise.allSettled([iTunesPromise, deezerPromise]);
    } catch (error) {
      console.error('Error fetching songs:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'main') return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsExplicitSearch(false);
      if (urlSearchQuery) navigate('/', { replace: true });
      return;
    }
    setIsExplicitSearch(false);
    
    if (searchQuery.trim() !== urlSearchQuery) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`, { replace: true });
    }

    if (filteredLibrary.length > 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      performOnlineSearch(searchQuery);
    }, 400);

    return () => clearTimeout(debounceTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeTab, filteredLibrary.length]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsExplicitSearch(true);
    navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
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
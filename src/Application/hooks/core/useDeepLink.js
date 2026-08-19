/* --- src/hooks/useDeepLink.js --- */
import { useEffect } from 'react';

export const useDeepLink = ({ urlTrackId, library, searchResults, selectedSong, setSelectedSong }) => {
  useEffect(() => {
    if (urlTrackId) {
      if (selectedSong && String(selectedSong.trackId) === String(urlTrackId)) return;
      let found = library.find(s => String(s.trackId) === String(urlTrackId)) || 
                   searchResults.find(s => String(s.trackId) === String(urlTrackId));
      
      if (found) {
        setSelectedSong(found);
      } else {
        if (!urlTrackId.startsWith('dz_')) {
          fetch(`https://itunes.apple.com/lookup?id=${urlTrackId}&entity=song`)
            .then(res => res.json())
            .then(data => {
              if (data.results && data.results.length > 0) {
                setSelectedSong({
                  ...data.results[0],
                  sourceNames: ['iTunes']
                });
              }
            })
            .catch(e => console.error("Deep link fetch failed", e));
        }
      }
    } else {
      setSelectedSong(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTrackId]);
};
import { useEffect, useMemo, useState } from 'react';
import './BackupExportModal.css';

const getSongLabel = (song) => {
  const title = song.trackName || song.title || 'Untitled track';
  const artist = song.artistName || song.artist || 'Unknown artist';
  return { title, artist };
};

const getCustomPostCount = () => {
  try {
    const savedPosts = JSON.parse(localStorage.getItem('custom_blog_posts_storage') || '[]');
    return Array.isArray(savedPosts) ? savedPosts.length : 0;
  } catch (error) {
    console.error('Could not read custom posts for backup export.', error);
    return 0;
  }
};

const BackupExportModal = ({ songs, settings, onClose, onExport }) => {
  const [selectedSongIds, setSelectedSongIds] = useState(
    () => new Set(songs.map((song) => String(song.trackId)))
  );
  const [includeSettings, setIncludeSettings] = useState(true);
  const [includeDeezerArl, setIncludeDeezerArl] = useState(false);
  const [includeBlogPosts, setIncludeBlogPosts] = useState(false);
  const [search, setSearch] = useState('');
  const [blogPostCount] = useState(getCustomPostCount);

  const deezerArlAvailable = Boolean(settings.deezerArl?.trim());

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter((song) => {
      const { title, artist } = getSongLabel(song);
      return `${title} ${artist}`.toLowerCase().includes(query);
    });
  }, [songs, search]);

  const allFilteredSelected = filteredSongs.length > 0
    && filteredSongs.every((song) => selectedSongIds.has(String(song.trackId)));

  const toggleSong = (trackId) => {
    const id = String(trackId);
    setSelectedSongIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedSongIds((current) => {
      const next = new Set(current);
      filteredSongs.forEach((song) => {
        const id = String(song.trackId);
        if (allFilteredSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const handleExport = () => {
    onExport({
      songIds: [...selectedSongIds],
      includeSettings,
      includeDeezerArl,
      includeBlogPosts
    });
  };

  return (
    <div
      className="backup-export-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="backup-export-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-export-title"
      >
        <header className="backup-export-header">
          <div>
            <span className="backup-export-eyebrow">PlanetMusic backup</span>
            <h2 id="backup-export-title">Choose what to export</h2>
          </div>
          <button className="backup-export-close" type="button" onClick={onClose} aria-label="Close export dialog">
            ×
          </button>
        </header>

        <div className="backup-export-song-section">
          <div className="backup-export-controls">
            <label className="backup-export-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a song or artist"
              />
            </label>
            <button
              className="backup-export-toggle-all"
              type="button"
              onClick={toggleAllFiltered}
              disabled={filteredSongs.length === 0}
            >
              {allFilteredSelected ? 'Exclude all' : 'Include all'}
            </button>
          </div>

          <div className="backup-export-song-list" aria-label="Songs to export">
            {filteredSongs.length > 0 ? filteredSongs.map((song) => {
              const id = String(song.trackId);
              const { title, artist } = getSongLabel(song);
              return (
                <label className="backup-export-song" key={id}>
                  <input
                    type="checkbox"
                    checked={selectedSongIds.has(id)}
                    onChange={() => toggleSong(id)}
                  />
                  {song.artworkUrl100 && <img src={song.artworkUrl100} alt="" />}
                  <span className="backup-export-song-copy">
                    <strong>{title}</strong>
                    <small>{artist}</small>
                  </span>
                </label>
              );
            }) : (
              <p className="backup-export-empty">No songs match that search.</p>
            )}
          </div>
        </div>

        <div className="backup-export-extras">
          <label className={`backup-export-option${!deezerArlAvailable ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={includeDeezerArl}
              disabled={!deezerArlAvailable}
              onChange={(event) => setIncludeDeezerArl(event.target.checked)}
            />
            <span className="backup-export-option-copy">
              <strong>Include Deezer ARL</strong>
              <small>{deezerArlAvailable ? 'Sensitive login token' : 'Not available in this Vault'}</small>
            </span>
          </label>
          <label className="backup-export-option">
            <input
              type="checkbox"
              checked={includeSettings}
              onChange={(event) => setIncludeSettings(event.target.checked)}
            />
            <span className="backup-export-option-copy">
              <strong>Include app settings</strong>
              <small>All app settings</small>
            </span>
          </label>
          <label className={`backup-export-option backup-export-option-wide${blogPostCount === 0 ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={includeBlogPosts}
              disabled={blogPostCount === 0}
              onChange={(event) => setIncludeBlogPosts(event.target.checked)}
            />
            <span className="backup-export-option-copy">
              <strong>Include custom blog posts</strong>
              <small>{blogPostCount > 0 ? `${blogPostCount} post${blogPostCount === 1 ? '' : 's'}` : 'Not available in this Vault'}</small>
            </span>
          </label>
        </div>

        <footer className="backup-export-footer">
          <div className="backup-export-summary">
            <span className="backup-export-selection">{selectedSongIds.size} song{selectedSongIds.size === 1 ? '' : 's'} selected</span>
            {includeSettings && <span className="backup-export-included">App settings</span>}
            {includeDeezerArl && <span className="backup-export-included">Deezer ARL</span>}
            {includeBlogPosts && <span className="backup-export-included">Custom blog posts</span>}
          </div>
          <div>
            <button className="backup-export-cancel" type="button" onClick={onClose}>Cancel</button>
            <button className="backup-export-submit" type="button" onClick={handleExport}>
              Download backup
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default BackupExportModal;

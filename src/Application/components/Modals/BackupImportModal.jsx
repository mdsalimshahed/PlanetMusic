import { useEffect, useMemo, useState } from 'react';
import './BackupExportModal.css';
import './BackupImportModal.css';

const getSongLabel = (song) => ({
  title: song.trackName || song.title || 'Untitled track',
  artist: song.artistName || song.artist || 'Unknown artist'
});

const ImportSong = ({ song, selected, onToggle }) => {
  const id = String(song.trackId);
  const { title, artist } = getSongLabel(song);
  return (
    <label className="backup-export-song" key={id}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(id)}
      />
      {song.artworkUrl100 && <img src={song.artworkUrl100} alt="" />}
      <span className="backup-export-song-copy">
        <strong>{title}</strong>
        <small>{artist}</small>
      </span>
    </label>
  );
};

const BackupImportModal = ({ backup, existingSongs, onClose, onImport }) => {
  const [selectedSongIds, setSelectedSongIds] = useState(
    () => new Set(backup.library.map(song => String(song.trackId)))
  );
  const [includeSettings, setIncludeSettings] = useState(
    Boolean(Object.keys(backup.settings || {}).some(key => key !== 'deezerArl'))
  );
  const [includeDeezerArl, setIncludeDeezerArl] = useState(false);
  const [includeBlogPosts, setIncludeBlogPosts] = useState(Boolean(backup.customBlogPosts?.length));
  const [search, setSearch] = useState('');

  const existingTrackIds = useMemo(
    () => new Set(existingSongs.map(song => String(song.trackId))),
    [existingSongs]
  );
  const appSettingsAvailable = Object.keys(backup.settings || {}).some(key => key !== 'deezerArl');
  const deezerArlAvailable = Boolean(backup.settings?.deezerArl?.trim());
  const blogPosts = backup.customBlogPosts || [];
  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return backup.library;
    return backup.library.filter(song => {
      const { title, artist } = getSongLabel(song);
      return `${title} ${artist}`.toLowerCase().includes(query);
    });
  }, [backup.library, search]);
  const allFilteredSelected = filteredSongs.length > 0
    && filteredSongs.every(song => selectedSongIds.has(String(song.trackId)));
  const existingBackupSongs = filteredSongs.filter(song => existingTrackIds.has(String(song.trackId)));
  const newBackupSongs = filteredSongs.filter(song => !existingTrackIds.has(String(song.trackId)));
  const matchingSongCount = backup.library.filter(song => (
    selectedSongIds.has(String(song.trackId)) && existingTrackIds.has(String(song.trackId))
  )).length;
  const hasSelectedExtras = (includeSettings && appSettingsAvailable)
    || includeDeezerArl
    || (includeBlogPosts && blogPosts.length > 0);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const toggleSong = (trackId) => {
    const id = String(trackId);
    setSelectedSongIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedSongIds(current => {
      const next = new Set(current);
      filteredSongs.forEach(song => {
        const id = String(song.trackId);
        if (allFilteredSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const handleImport = () => onImport({
    songIds: [...selectedSongIds],
    includeSettings,
    includeDeezerArl,
    includeBlogPosts
  });

  return (
    <div
      className="backup-export-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="backup-export-dialog backup-import-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-import-title"
      >
        <header className="backup-export-header">
          <div>
            <span className="backup-export-eyebrow">PlanetMusic backup</span>
            <h2 id="backup-import-title">Choose what to import</h2>
            <p className="backup-import-file-name">{backup.fileName}</p>
          </div>
          <button className="backup-export-close" type="button" onClick={onClose} aria-label="Close import dialog">
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
                onChange={event => setSearch(event.target.value)}
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

          <div className="backup-export-song-list" aria-label="Songs in backup">
            {filteredSongs.length > 0 ? (
              <>
                {existingBackupSongs.length > 0 && (
                  <h3 className="backup-import-category">
                    Already in Vault — will update <span>{existingBackupSongs.length}</span>
                  </h3>
                )}
                {existingBackupSongs.map(song => (
                  <ImportSong
                    key={String(song.trackId)}
                    song={song}
                    selected={selectedSongIds.has(String(song.trackId))}
                    onToggle={toggleSong}
                  />
                ))}
                {newBackupSongs.length > 0 && (
                  <h3 className="backup-import-category">
                    New arrivals <span>{newBackupSongs.length}</span>
                  </h3>
                )}
                {newBackupSongs.map(song => (
                  <ImportSong
                    key={String(song.trackId)}
                    song={song}
                    selected={selectedSongIds.has(String(song.trackId))}
                    onToggle={toggleSong}
                  />
                ))}
              </>
            ) : (
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
                onChange={event => setIncludeDeezerArl(event.target.checked)}
              />
              <span className="backup-export-option-copy">
                <strong>Include Deezer ARL</strong>
                <small>{deezerArlAvailable ? 'Sensitive login token' : 'Not included in this backup'}</small>
              </span>
          </label>
          <label className={`backup-export-option${!appSettingsAvailable ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={includeSettings}
              disabled={!appSettingsAvailable}
              onChange={event => setIncludeSettings(event.target.checked)}
            />
            <span className="backup-export-option-copy">
              <strong>Include app settings</strong>
              <small>{appSettingsAvailable ? 'All app settings' : 'Not included in this backup'}</small>
            </span>
          </label>
          <label className={`backup-export-option backup-export-option-wide${blogPosts.length === 0 ? ' is-disabled' : ''}`}>
              <input
                type="checkbox"
                checked={includeBlogPosts}
                disabled={blogPosts.length === 0}
                onChange={event => setIncludeBlogPosts(event.target.checked)}
              />
              <span className="backup-export-option-copy">
                <strong>Include custom blog posts</strong>
                <small>{blogPosts.length > 0 ? `${blogPosts.length} post${blogPosts.length === 1 ? '' : 's'}` : 'Not included in this backup'}</small>
              </span>
          </label>
        </div>

        <footer className="backup-export-footer">
          <div className="backup-export-summary">
            <span className="backup-export-selection">
              {selectedSongIds.size} song{selectedSongIds.size === 1 ? '' : 's'} selected
            </span>
            {matchingSongCount > 0 && (
              <span className="backup-import-existing-count">
                {matchingSongCount} will update
              </span>
            )}
            {includeSettings && appSettingsAvailable && <span className="backup-export-included">App settings</span>}
            {includeDeezerArl && <span className="backup-export-included">Deezer ARL</span>}
            {includeBlogPosts && blogPosts.length > 0 && <span className="backup-export-included">Custom blog posts</span>}
          </div>
          <div>
            <button className="backup-export-cancel" type="button" onClick={onClose}>Cancel</button>
            <button
              className="backup-export-submit"
              type="button"
              onClick={handleImport}
              disabled={selectedSongIds.size === 0 && !hasSelectedExtras}
            >
              Import selected
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default BackupImportModal;

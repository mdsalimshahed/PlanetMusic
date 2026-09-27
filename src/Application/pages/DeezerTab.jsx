import { useEffect, useRef, useState } from 'react';
import { fetchDeezerApi, getDeezerApiUrl } from '../services/deezerBackend.js';
import './DeezerTab.css';

const normalizeResults = (payload) => {
  const results = Array.isArray(payload) ? payload : payload?.results ?? payload?.data ?? [];
  return Array.isArray(results) ? results : [];
};

const getErrorMessage = (status) => {
  if (status === 403) return 'The backend gateway could not authorize this request. Please try again later.';
  if (status === 429) return 'You have made requests too quickly. Please wait a moment and try again.';
  if (status === 503) return 'The Deezer service is temporarily unavailable. Please try again later.';
  if (status === 401) return 'The request was not authorized. Please reload the page and try again.';
  return 'The request could not be completed. Please try again.';
};

const createSessionId = () => {
  const value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
};

const getTrackUrl = (track) => track.link || track.url || `https://www.deezer.com/track/${track.id}`;

const DeezerTab = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState(null);
  const [arlToken, setArlToken] = useState('');
  const [showArl, setShowArl] = useState(false);
  const [quality, setQuality] = useState('1');
  const [indexCounter, setIndexCounter] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const progressSourceRef = useRef(null);

  const metadataDetails = metadata?.track ?? metadata?.data ?? metadata ?? selectedTrack;
  useEffect(() => () => {
    progressSourceRef.current?.close();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const searchTracks = async (event) => {
    event.preventDefault();
    const searchTerm = query.trim();
    if (!searchTerm) return;
    setIsSearching(true);
    setError('');
    setNotice('');
    setSelectedTrack(null);
    setMetadata(null);
    try {
      const response = await fetchDeezerApi(`/search-deezer?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error(getErrorMessage(response.status));
      const payload = await response.json();
      setResults(normalizeResults(payload));
    } catch (searchError) {
      setError(searchError.message || 'Search could not reach the backend.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectTrack = async (track) => {
    setSelectedTrack(track);
    setMetadata(null);
    setError('');
    setNotice('');
    setIsLoadingMetadata(true);
    try {
      const response = await fetchDeezerApi(`/track-info-deezer/${encodeURIComponent(track.id)}`);
      if (!response.ok) throw new Error(getErrorMessage(response.status));
      const payload = await response.json();
      if (payload?.success === false) throw new Error('Track details could not be loaded. Please try again.');
      setMetadata(payload?.data ?? payload);
    } catch (metadataError) {
      setError(metadataError.message || 'Track details could not be loaded.');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const startAction = async (action) => {
    if (!selectedTrack) return;
    if (!arlToken.trim()) {
      setShowArl(true);
      setNotice('Enter your Deezer ARL to continue. It is used for this request only.');
      return;
    }

    setIsWorking(true);
    setError('');
    setNotice('');
    setProgress({ message: 'Connecting…', percent: 0 });
    progressSourceRef.current?.close();
    const sessionId = createSessionId();
    const progressSource = new EventSource(
      getDeezerApiUrl(`/deezer-progress/${encodeURIComponent(sessionId)}`)
    );
    progressSourceRef.current = progressSource;
    progressSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        setProgress({
          message: update.message || update.status || 'Working…',
          percent: Number.isFinite(Number(update.percent)) ? Number(update.percent) : null
        });
      } catch {
        setProgress({ message: event.data || 'Working…', percent: null });
      }
    };
    progressSource.onerror = () => {
      progressSource.close();
      setProgress((currentProgress) => currentProgress?.percent === 100 ? currentProgress : {
        ...currentProgress,
        message: 'Progress updates disconnected. The request may still be processing.'
      });
    };

    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('url', getTrackUrl(selectedTrack));
    formData.append('arl_token', arlToken.trim());
    formData.append('quality', quality);
    formData.append('action', action);
    formData.append('local_dir', '');
    formData.append('index_counter', String(indexCounter));

    try {
      const response = await fetchDeezerApi('/download-deezer', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(getErrorMessage(response.status));
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await response.json();
        if (payload.success === false) throw new Error('The backend could not complete this action. Please check the Deezer ARL and try again.');
        setNotice(payload.message || 'The backend completed the request.');
        setProgress({ message: 'Complete', percent: 100 });
      } else {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setAudioUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          return objectUrl;
        });
        if (action === 'download') {
          const disposition = response.headers.get('content-disposition') || '';
          const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^;"]+)/i);
          const filename = decodeURIComponent(filenameMatch?.[1] || `${selectedTrack.title || selectedTrack.name || 'planetmusic-track'}.mp3`);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = filename;
          document.body.append(link);
          link.click();
          link.remove();
          setNotice('Your download is ready.');
        } else {
          setNotice('Stream ready.');
        }
        setProgress({ message: 'Complete', percent: 100 });
      }
      setIndexCounter((currentCounter) => currentCounter + 1);
    } catch (actionError) {
      setError(actionError.message || 'The request could not be completed.');
      setProgress(null);
    } finally {
      progressSource.close();
      progressSourceRef.current = null;
      setIsWorking(false);
      setArlToken('');
      setShowArl(false);
    }
  };

  const metadataRows = [
    ['Album', metadataDetails?.album?.title || metadataDetails?.album || selectedTrack?.album],
    ['Artist', metadataDetails?.artist?.name || metadataDetails?.artist || selectedTrack?.artist],
    ['Duration', metadataDetails?.duration || selectedTrack?.duration],
    ['Release', metadataDetails?.release_date || metadataDetails?.releaseDate],
    ['Track ID', metadataDetails?.id || selectedTrack?.id]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return (
    <section className="view-section deezer-page">
      <header className="deezer-heading">
        <div>
          <p className="deezer-eyebrow">PLANETMUSIC / AUDIO DESK</p>
          <h1>Deezer workspace</h1>
          <p>Search the catalog, inspect a track, then download or stream it.</p>
        </div>
        <span className="deezer-connection"><span /> Same-origin API</span>
      </header>

      <form className="deezer-search" onSubmit={searchTracks}>
        <label htmlFor="deezer-query">Find a track</label>
        <div className="deezer-search-row">
          <input id="deezer-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Track, artist, or album" />
          <button type="submit" disabled={isSearching || !query.trim()}>{isSearching ? 'Searching…' : 'Search catalog'}</button>
        </div>
      </form>

      {(error || notice) && <p className={`deezer-feedback ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</p>}

      <div className="deezer-workspace-grid">
        <section className="deezer-results" aria-label="Search results">
          <div className="deezer-section-heading">
            <h2>Results</h2>
            <span>{results.length}</span>
          </div>
          {results.length ? (
            <div className="deezer-track-list">
              {results.map((track) => {
                const id = track.id ?? track.track_id;
                const isActive = String(selectedTrack?.id) === String(id);
                return (
                  <button className={`deezer-track-row ${isActive ? 'is-selected' : ''}`} key={id} type="button" onClick={() => selectTrack({ ...track, id })}>
                    {track.cover || track.cover_medium || track.album?.cover_medium ? (
                      <img src={track.cover || track.cover_medium || track.album.cover_medium} alt="" />
                    ) : <span className="deezer-cover-placeholder" aria-hidden="true">PM</span>}
                    <span className="deezer-track-copy">
                      <strong>{track.title || track.title_short || track.name || 'Untitled track'}</strong>
                      <span>{track.artist?.name || track.artist || 'Unknown artist'}{track.album?.title || track.album ? ` · ${track.album?.title || track.album}` : ''}</span>
                    </span>
                    <span className="deezer-track-duration">{track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : ''}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="deezer-empty">{isSearching ? 'Searching Deezer…' : 'Search to see matching tracks.'}</p>
          )}
        </section>

        <section className="deezer-detail" aria-label="Selected track details">
          <div className="deezer-section-heading"><h2>Track details</h2></div>
          {!selectedTrack ? (
            <p className="deezer-empty">Choose a result to load its metadata and available actions.</p>
          ) : (
            <>
              <div className="deezer-selected-track">
                {selectedTrack.cover || selectedTrack.cover_medium || selectedTrack.album?.cover_medium ? (
                  <img src={selectedTrack.cover || selectedTrack.cover_medium || selectedTrack.album.cover_medium} alt="" />
                ) : <span className="deezer-cover-placeholder" aria-hidden="true">PM</span>}
                <div>
                  <h3>{metadataDetails?.title || selectedTrack.title || selectedTrack.name || 'Untitled track'}</h3>
                  <p>{metadataDetails?.artist?.name || metadataDetails?.artist || selectedTrack.artist?.name || selectedTrack.artist || 'Unknown artist'}</p>
                  {isLoadingMetadata && <span className="deezer-meta-loading">Loading metadata…</span>}
                </div>
              </div>

              {metadataRows.length > 0 && <dl className="deezer-metadata">
                {metadataRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === 'Duration' && Number.isFinite(Number(value)) ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}` : String(value)}</dd></div>)}
              </dl>}

              <div className="deezer-options">
                <label>Quality code<input value={quality} onChange={(event) => setQuality(event.target.value)} inputMode="numeric" /></label>
                <label>Index counter<input type="number" min="0" value={indexCounter} onChange={(event) => setIndexCounter(Number(event.target.value))} /></label>
              </div>

              {showArl && (
                <label className="deezer-arl-field">Deezer ARL token
                  <input type="password" value={arlToken} onChange={(event) => setArlToken(event.target.value)} autoComplete="off" placeholder="Requested only for this action" />
                </label>
              )}
              <div className="deezer-actions">
                <button type="button" disabled={isWorking} onClick={() => startAction('download')}>Download</button>
                <button type="button" className="is-secondary" disabled={isWorking} onClick={() => startAction('stream')}>Stream</button>
              </div>

              {progress && <div className="deezer-progress" role="status">
                <div><span>{progress.message}</span><span>{progress.percent === null ? '' : `${progress.percent}%`}</span></div>
                <progress max="100" value={progress.percent ?? undefined} />
              </div>}
              {audioUrl && <audio className="deezer-audio-player" controls src={audioUrl} />}
            </>
          )}
        </section>
      </div>
    </section>
  );
};

export default DeezerTab;
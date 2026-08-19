/* --- src/components/TrackGrid.jsx --- */
import './TrackGrid.css';
import React from 'react';
import SongCard from './SongCard.jsx';
import InFeedSponsor from '../Promos/InFeedSponsor.jsx';

const TrackGrid = ({ items, library, toggleLibrary, setSelectedSong, setCurrentTrack, adsEnabled }) => {
  return (
    <div className="track-grid">
      {items.map((song, idx) => {
        // Inject an In-Feed Ad every 6 items
        const showAdAfter = (idx + 1) % 6 === 0;
        return (
          <React.Fragment key={`${song.trackId}-${idx}`}>
            <div className="track-grid-item">
              <SongCard 
                song={song} 
                isSaved={library.some((s) => s.trackId === song.trackId)}
                toggleLibrary={toggleLibrary}
                setSelectedSong={setSelectedSong}
                setCurrentTrack={setCurrentTrack}
              />
            </div>
            
            {/* INJECT IN-FEED AD IF ENABLED */}
            {adsEnabled && showAdAfter && <InFeedSponsor testMode={true} wrapperClass="track-grid-item dynamic-radius-override" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TrackGrid;
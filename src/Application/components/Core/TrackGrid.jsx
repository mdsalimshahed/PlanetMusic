/* --- src/Application/components/Core/TrackGrid.jsx --- */
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
        
        // Calculate the staggered delay (Caps at 1.5s so massive libraries don't take forever to load)
        const staggerDelay = Math.min(idx * 0.05, 1.5);

        return (
          <React.Fragment key={`${song.trackId}-${idx}`}>
            <div 
              className="track-grid-item"
              style={{ animationDelay: `${staggerDelay}s` }}
            >
              <SongCard 
                song={song} 
                isSaved={library.some((s) => s.trackId === song.trackId)}
                toggleLibrary={toggleLibrary}
                setSelectedSong={setSelectedSong}
                setCurrentTrack={setCurrentTrack}
              />
            </div>
            
            {/* INJECT IN-FEED AD IF ENABLED */}
            {adsEnabled && showAdAfter && (
              <InFeedSponsor 
                testMode={true} 
                wrapperClass="track-grid-item dynamic-radius-override" 
                wrapperStyle={{ animationDelay: `${staggerDelay + 0.02}s` }} 
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TrackGrid;
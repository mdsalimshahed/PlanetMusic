/* --- src/components/ImageManager.jsx --- */
import { Link } from 'react-router-dom';
import WorkspaceTip from '../WorkspaceTip.jsx';
import './ImageManager.css';

const getArtistImage = (images, artist) => {
  if (images?.[artist]) return images[artist];
  const normalizedArtist = artist.trim().toLowerCase();
  const matchingArtist = Object.keys(images || {}).find(
    name => name.trim().toLowerCase() === normalizedArtist
  );
  return matchingArtist ? images[matchingArtist] : '';
};

const ImageManager = ({
  allPotentialSingers, selectedSong, customData, singerImages, handleImageChange, handleColorChange, masterPalette, globalArtistData
}) => {
  return (
    <div className="image-manager-container">
      <WorkspaceTip
        title="Customize artist profiles"
        guideTo="/docs/dev-blog/post/image-manager-customizing-artist-profiles"
        guideLabel="Artist Image Manager guide"
      >
        <ul>
          <li>
            <svg className="workspace-tip-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
            <span>Artists appear here when lyrics use singer tags such as <code>[Verse: Artist Name]</code>. See the <Link to="/docs/dev-blog/post/formatting-lyrics-singer-tags">singer-tag formatting guide</Link>.</span>
          </li>
          <li>
            <svg className="workspace-tip-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span>Set a singer’s portrait and color in <strong className="workspace-tip-action workspace-tip-action--manage">Manage Artists</strong>. The shared portrait appears wherever that artist sings; the song-specific link stays local.</span>
          </li>
          <li>
            <svg className="workspace-tip-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M17 21v-8H7v8M7 3v5h8" />
            </svg>
            <span>Use <strong className="workspace-tip-action workspace-tip-action--clear">Clear Image</strong> to remove an image, then <strong className="workspace-tip-action workspace-tip-action--save">Save Artists Data</strong> to keep changes.</span>
          </li>
        </ul>
      </WorkspaceTip>
             
      <div className="image-manager-list">
        {allPotentialSingers.map(singer => {
          const searchTarget = encodeURIComponent(`"${singer}" ${selectedSong.artistName} singer`);
          const duckDuckGoUrl = `https://duckduckgo.com/?q=${searchTarget}&iax=images&ia=images&iaf=layout:Square`;
          const colorValue = masterPalette[singer] || '#ffffff';
                     
          // Determine the image currently intended to be shown
          const currentImage = getArtistImage(customData.artistImages, singer) ||
            getArtistImage(globalArtistData?.images, singer) ||
            singerImages[singer];
          const imageInputValue = getArtistImage(customData.artistImages, singer);

          return (
            <div key={singer} className="image-manager-row glass-panel-light">
              <div className="img-manager-top-row">
                <a href={duckDuckGoUrl} target="_blank" rel="noreferrer" className="img-manager-name" style={{ color: colorValue }}>
                    {singer}
                </a>
                <div className="img-manager-controls">
                  <input 
                    type="color" 
                    className="img-manager-color-picker" 
                    value={colorValue}
                    onChange={(e) => handleColorChange(singer, e.target.value)} 
                    title="Choose Artist Color"
                  />
                  {currentImage && (
                      <img src={currentImage} alt="Preview" className="img-manager-preview" />
                  )}
                </div>
              </div>
              <div className="img-manager-input-row">
                <input 
                  type="text" 
                  className="img-manager-input" 
                  placeholder="Paste HD Image URL here..." 
                  value={imageInputValue}
                  onChange={(e) => handleImageChange(singer, e.target.value)} 
                />
                {currentImage && (
                  <button 
                    className="img-manager-clear-btn" 
                    onClick={() => handleImageChange(singer, '')} 
                    title="Clear Image"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageManager;
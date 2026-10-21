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
        guideTo="/docs/dev-blog/post/formatting-lyrics-singer-tags"
        guideLabel="Lyrics & singer tags"
      >
        <ul>
          <li>
            <span>Artists appear here when lyrics use singer names in section tags, such as <code>[Verse: Artist Name]</code>.</span>
          </li>
          <li>
            <span>Use <strong className="workspace-tip-action workspace-tip-action--manage">Manage Artists</strong> to assign an image and color to each singer.</span>
          </li>
          <li>
            <span>Use <strong className="workspace-tip-action workspace-tip-action--clear">Clear Image</strong> to remove an image, then <strong className="workspace-tip-action workspace-tip-action--save">Save Artists Data</strong> to keep changes or <strong className="workspace-tip-action workspace-tip-action--close">Close Editor</strong> to leave. See the <Link to="/docs/dev-blog/post/image-manager-customizing-artist-profiles">Image Manager guide</Link>.</span>
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
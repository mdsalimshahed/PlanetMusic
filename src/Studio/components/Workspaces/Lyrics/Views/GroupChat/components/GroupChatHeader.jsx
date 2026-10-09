import ArtistPresenceAvatar from './ArtistPresenceAvatar.jsx';
import { getArtistImage } from '../utils/groupChatUtils.js';

const GroupChatHeader = ({
  artists,
  onlineArtists,
  lastLineEndByArtist,
  playbackTime,
  imageSources
}) => (
  <header className="group-chat-header">
    <div className="group-chat-heading">
      <div className="group-chat-participants" aria-live="polite">
        {artists.map((artist, artistIndex) => {
          const lastLineEnd = lastLineEndByArtist.get(artist.name);
          return (
            <ArtistPresenceAvatar
              key={artist.name}
              artist={artist}
              artistIndex={artistIndex}
              isOnline={onlineArtists.has(artist.name)}
              isDimmed={lastLineEnd != null && playbackTime - lastLineEnd > 5}
              image={getArtistImage(artist.name, imageSources)}
            />
          );
        })}
      </div>
    </div>
  </header>
);

export default GroupChatHeader;

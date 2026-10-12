const artworkThemes = {
  'welcome-to-planetmusic': 'vault',
  'how-player-audio-streams-custom-links-work': 'audio',
  'formatting-lyrics-singer-tags': 'lyrics',
  'how-to-search-and-save-songs-to-your-vault': 'search',
  'how-to-sync-songs-with-music': 'sync',
  'advanced-adlib-synchronization': 'adlibs',
  'complete-guide-to-the-translation-workspace': 'translation',
  'understanding-autospacing-engine-cjk': 'language',
  'image-manager-customizing-artist-profiles': 'artist',
  'personalizing-viewing-experience-layout': 'layout',
  'data-storage-backups-purge-button': 'backup',
  'decoding-live-equalizer-web-audio': 'equalizer',
  'troubleshooting-playback-missing-artworks': 'troubleshoot',
  'creating-custom-blogs-and-workspaces': 'creator',
  'importing-exporting-translations-txt': 'export',
  'ambient-mode-floating-lyrics': 'ambient',
  'mobile-optimization-on-the-go': 'mobile',
  'how-to-contact-us-get-support': 'support',
  'group-chat-lyrics-view': 'group',
  'audio-delay-test-bluetooth-sync': 'delay'
};

const artworkThemeFor = (post) => {
  if (artworkThemes[post.id]) return artworkThemes[post.id];
  const category = `${post.category || ''} ${post.title || ''}`.toLowerCase();
  if (/translat|language|cjk|chinese|japanese/.test(category)) return 'translation';
  if (/lyric|sync|singer|ad.?lib/.test(category)) return 'lyrics';
  if (/audio|player|equalizer|playback|delay/.test(category)) return 'audio';
  if (/backup|storage|vault|privacy/.test(category)) return 'vault';
  return 'creator';
};

const ArtworkDetail = ({ theme }) => {
  switch (theme) {
    case 'translation':
    case 'language':
    case 'export':
      return (
        <g className="blog-art-detail">
          <rect x="154" y="61" width="125" height="137" rx="12" />
          <rect x="321" y="61" width="125" height="137" rx="12" />
          <path d="M174 91h79M174 110h58M174 151h66M174 170h48M341 91h85M341 110h61M341 151h66M341 170h45" />
          <text x="188" y="144">言</text><text x="354" y="144">A</text>
          <path className="blog-art-accent-line" d="M288 128h22m-8-8 8 8-8 8" />
        </g>
      );
    case 'audio':
    case 'equalizer':
    case 'delay':
      return (
        <g className="blog-art-detail">
          <circle cx="300" cy="129" r="62" />
          <circle className="blog-art-accent-stroke" cx="300" cy="129" r="44" />
          <path className="blog-art-accent-fill" d="m290 106 34 23-34 23z" />
          <path d="M107 129h42l16-29 20 62 19-46 19 26h26m102-13h25l19-27 18 52 19-38 18 13h42" />
        </g>
      );
    case 'lyrics':
    case 'sync':
    case 'adlibs':
    case 'group':
      return (
        <g className="blog-art-detail">
          <path d="M153 80h210M153 110h283M153 140h236M153 170h192" />
          <path className="blog-art-accent-line" d="M153 110h180" />
          <path className="blog-art-secondary-line" d="M153 140h108" />
          <circle className="blog-art-accent-fill" cx="334" cy="110" r="5" />
          <circle className="blog-art-secondary-fill" cx="261" cy="140" r="5" />
          <path d="M153 198h283" />
          <path className="blog-art-accent-line" d="M153 198h134" />
          <path d="M176 191v14m40-14v14m40-14v14m40-14v14m40-14v14m40-14v14m40-14v14" />
        </g>
      );
    case 'artist':
      return (
        <g className="blog-art-detail">
          <circle cx="228" cy="116" r="43" />
          <circle cx="344" cy="116" r="43" />
          <circle className="blog-art-accent-stroke" cx="286" cy="102" r="50" />
          <path d="M158 207c7-37 31-56 70-56 23 0 41 8 53 23m7 33c9-36 28-54 56-54 38 0 61 19 68 56" />
          <path className="blog-art-accent-line" d="M259 184h55" />
        </g>
      );
    case 'layout':
    case 'creator':
      return (
        <g className="blog-art-detail">
          <rect x="149" y="59" width="302" height="145" rx="12" />
          <path d="M149 91h302M174 115h90m-90 19h119m-119 19h100" />
          <rect className="blog-art-accent-stroke" x="337" y="107" width="87" height="71" rx="8" />
          <path className="blog-art-accent-line" d="M352 158h14l9-22 11 30 10-18h13" />
        </g>
      );
    case 'backup':
    case 'vault':
      return (
        <g className="blog-art-detail">
          <path d="M151 112 300 54l149 58v79l-149 54-149-54z" />
          <path className="blog-art-accent-stroke" d="m181 120 119-47 119 47v53l-119 43-119-43z" />
          <path d="m151 112 149 58 149-58M300 170v75" />
          <circle className="blog-art-accent-fill" cx="300" cy="151" r="13" />
          <path d="M300 164v27" />
        </g>
      );
    case 'search':
    case 'troubleshoot':
      return (
        <g className="blog-art-detail">
          <circle cx="277" cy="119" r="62" />
          <circle className="blog-art-accent-stroke" cx="277" cy="119" r="42" />
          <path className="blog-art-accent-line" d="m322 164 48 48" />
          <path d="M249 129h56m-28-28v56" />
          <circle className="blog-art-secondary-fill" cx="277" cy="119" r="7" />
        </g>
      );
    case 'ambient':
      return (
        <g className="blog-art-detail">
          <rect x="152" y="67" width="106" height="46" rx="23" />
          <rect x="333" y="91" width="110" height="46" rx="23" />
          <rect className="blog-art-accent-stroke" x="208" y="150" width="150" height="49" rx="24" />
          <path d="M177 90h55m128 24h55m-124 60h96" />
          <circle className="blog-art-accent-fill" cx="288" cy="174" r="4" />
        </g>
      );
    case 'mobile':
      return (
        <g className="blog-art-detail">
          <rect x="241" y="45" width="118" height="185" rx="18" />
          <path d="M276 66h48m-34 141h20" />
          <path className="blog-art-accent-line" d="M263 112h72m-72 22h56m-56 22h68m-68 22h43" />
          <circle className="blog-art-secondary-fill" cx="326" cy="135" r="4" />
        </g>
      );
    case 'support':
      return (
        <g className="blog-art-detail">
          <path d="M206 143v-15a94 94 0 0 1 188 0v15" />
          <rect x="194" y="132" width="36" height="66" rx="17" />
          <rect x="370" y="132" width="36" height="66" rx="17" />
          <path className="blog-art-accent-line" d="M370 187c-9 25-28 34-57 34h-16" />
          <rect className="blog-art-accent-stroke" x="272" y="208" width="43" height="22" rx="11" />
        </g>
      );
    default:
      return (
        <g className="blog-art-detail">
          <circle cx="300" cy="130" r="59" />
          <circle className="blog-art-accent-stroke" cx="300" cy="130" r="42" />
          <circle className="blog-art-secondary-stroke" cx="300" cy="130" r="23" />
          <circle className="blog-art-accent-fill" cx="300" cy="130" r="5" />
        </g>
      );
  }
};

const BlogPostArtwork = ({ post, className = '' }) => {
  const theme = artworkThemeFor(post);

  return (
    <div className={`blog-post-artwork ${className}`} data-art-theme={theme} aria-hidden="true">
      <svg viewBox="0 0 600 260" preserveAspectRatio="xMidYMid meet">
        <ellipse className="blog-art-glow" cx="300" cy="130" rx="190" ry="112" />
        <ellipse className="blog-art-orbit" cx="300" cy="130" rx="220" ry="76" transform="rotate(-16 300 130)" />
        <ellipse className="blog-art-orbit blog-art-orbit-secondary" cx="300" cy="130" rx="175" ry="98" transform="rotate(24 300 130)" />
        <circle className="blog-art-star" cx="112" cy="78" r="2" />
        <circle className="blog-art-star" cx="469" cy="72" r="2" />
        <circle className="blog-art-star" cx="472" cy="192" r="1.5" />
        <circle className="blog-art-star" cx="137" cy="191" r="1.5" />
        <ArtworkDetail theme={theme} />
      </svg>
    </div>
  );
};

export default BlogPostArtwork;

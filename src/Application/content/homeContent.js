// Shared by the homepage component AND the build-time prerender script (scripts/prerender.mjs).
// Keep this file plain JavaScript (no JSX, no import.meta.env) so Node can read it too.

export const SITE = {
  name: 'PlanetMusic',
  url: 'https://planetmusic.pages.dev',
  tagline: 'A music library and lyrics workspace that runs entirely in your browser.',
  description:
    'PlanetMusic is a free webtool for syncing lyrics to songs in any language. Become unburdened by language barriers with English translations and pronunciation guides.'
};

export const SECTIONS = [
  { id: 'about', label: 'What it is' },
  { id: 'how', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'guides', label: 'Guides' },
  { id: 'faq', label: 'FAQ' }
];

export const ABOUT = [
  {
    title: 'A place to keep your music',
    text: 'Search for a track, save it to your Vault, and it stays in your library with its artwork, lyrics and notes. The Vault lives in your own browser, so there is nothing to sign up for.'
  },
  {
    title: 'A workspace for lyrics',
    text: 'We’ve built the most intuitive, easy-to-use syncing workspace for bringing lyrics into time with the music. Our powerful formatting interface makes it easy to shape your lyrics and mark who sings each part, so every voice gets its moment.'
  },
  {
    title: 'A way to understand other languages',
    text: 'Keep original lyrics beside English translations and phonetic pronunciation guides such as Romaji or Pinyin. Automatic translation and pronunciation results can be reviewed and edited; Japanese and Chinese lyrics also have an auto-spacing tool.'
  }
];

export const STEPS = [
  { n: '01', title: 'Search the Cosmos', text: 'Use the search bar to find any song and save it to your Vault. Then add a link to the song from your favorite platform, whether it is YouTube, Deezer, or Spotify.', to: '/blog/post/how-to-search-and-save-songs-to-your-vault' },
  { n: '02', title: 'Add the lyrics and credit the artists', text: 'Paste or write your lyrics, then use our powerful formatting interface to tag each line to the artist behind it. Bring every voice to life with artist images by simply pasting an image link into Artist Manager.', to: '/blog/post/formatting-lyrics-singer-tags' },
  { n: '03', title: 'Sync the lyrics', text: 'Our engine automatically fetches available sync data, and you can fine-tune every line yourself. Press the Down Arrow to lock in a timestamp, or the Up Arrow to remove it.', to: '/blog/post/how-to-sync-songs-with-music' },
  { n: '04', title: 'Translate in one click', text: 'Translate every line at once with our automated translation engine. Then fine-tune each result in the Translation Workspace until it sounds right to you.', to: '/blog/post/complete-guide-to-the-translation-workspace' },
  { n: '05', title: 'Enjoy the music', text: 'Sit back and enjoy your lyrics in four different views. Follow every line in Live Scroll, stay with the moment in Focused, watch each voice come alive in Group Chat, or take in the full song in Plain Text.', to: '/blog/post/group-chat-lyrics-view' }
];

export const FEATURES = [
  { icon: '⌕', title: 'Search for songs', text: 'Search by song title or artist and browse matching results from connected music sources.', to: '/blog/post/how-to-search-and-save-songs-to-your-vault' },
  { icon: '♪', title: 'Sync Workspace', text: 'Keyboard-driven timing for every line, with separate handling for ad-libs and echoes.', to: '/blog/post/how-to-sync-songs-with-music' },
  { icon: '文', title: 'Translation Workspace', text: 'Original, translation and phonetic reading side by side. Import or export your own .txt translations.', to: '/blog/post/complete-guide-to-the-translation-workspace' },
  { icon: '▤', title: 'Four synced lyrics views', text: 'Follow lyrics as music plays in four views: Live scrolls through the song and highlights the current line; Focused centers the active lyric and positions timed ad-libs around it; Group Chat turns timed singer parts into a color-coded conversation; Plain Text shows the lyrics grouped by singer without playback highlighting.', to: '/blog/post/group-chat-lyrics-view' },
  { icon: '◔', title: 'Group Chat view', text: 'Turn a duet or ensemble track into a live group conversation with colors for each artist.', to: '/blog/post/group-chat-lyrics-view' },
  { icon: '✦', title: 'Ambient mode', text: 'Lyrics drift across a background that takes its colors from the album art.', to: '/blog/post/ambient-mode-floating-lyrics' },
  { icon: '◉', title: 'Artist Image Manager', text: 'Give each artist a photo and a color once; it is used everywhere they sing.', to: '/blog/post/image-manager-customizing-artist-profiles' },
  { icon: '⌁', title: 'Audio delay test', text: 'Measure Bluetooth lag and shift the lyrics so they land with what you hear.', to: '/blog/post/audio-delay-test-bluetooth-sync' },
  { icon: '⚙', title: 'Customize your workspace', text: 'Use the Settings tab to adjust typography, background opacity, and layout proportions to suit how you read and listen.', to: '/blog/post/personalizing-viewing-experience-layout' }
];

export const FEATURED_GUIDES = [
  { id: 'welcome-to-planetmusic', category: 'Core Features', readTime: '3 min read', title: 'Welcome to PlanetMusic: Your Personal Vault', summary: 'A quick intro to your personal music library, and why everything stays in your own browser.' },
  { id: 'how-to-sync-songs-with-music', category: 'Lyrics & Syncing', readTime: '3 min read', title: 'How to Sync Songs with Music', summary: 'How to map line timestamps, use the keyboard shortcuts, split and loop ad-libs, and switch audio sources.' },
  { id: 'complete-guide-to-the-translation-workspace', category: 'Translation Engine', readTime: '5 min read', title: 'How to Use the Translation Workspace', summary: 'Translate lyrics, tweak pronunciation and CJK spacing, then save or export your draft.' },
  { id: 'understanding-autospacing-engine-cjk', category: 'Translation Engine', readTime: '5 min read', title: 'Auto Spacing for Japanese & Chinese Lyrics', summary: 'What Auto Spacing does for Japanese and Chinese lyrics, how to use it, and how it works out where the spaces go.' },
  { id: 'data-storage-backups-purge-button', category: 'Tech & Audio', readTime: '4 min read', title: 'Data Storage, Backups & The Purge Button', summary: 'Where your data lives, how to back it up, and what the Purge button does.' },
  { id: 'audio-delay-test-bluetooth-sync', category: 'Tech & Audio', readTime: '4 min read', title: 'Audio Delay Test: Sync Lyrics with Bluetooth Headphones', summary: 'Measure and save a listening delay, then turn on Sync Delay so live lyrics follow Bluetooth audio.' }
];

export const FAQ = [
  { q: 'What is PlanetMusic?', a: 'PlanetMusic is a browser-based workspace for organizing a personal music library, timing lyrics to songs, and keeping translations and phonetic readings next to the original words.' },
  { q: 'Is it a music streaming service?', a: 'No. PlanetMusic is an editing and organization tool, not a licensed music catalog. Some features use third-party services for search and audio previews.' },
  { q: 'Do I need an account?', a: 'No. There are no accounts or logins. Your Vault and settings are saved in the browser you are using.' },
  { q: 'Where is my data stored, and can I back it up?', a: 'In your browser on your own device. Use Backup in the top bar to export a JSON file and import it later. Audio files you add from your own device are not included in that backup.' },
  { q: 'Which languages are supported for lyrics?', a: 'You can enter and sync lyrics in any language. Automatic translation targets English, and translation or pronunciation results depend on the connected services and language support. Japanese and Chinese also have an auto-spacing tool.' },
  { q: 'How can I view synced lyrics while music plays?', a: 'Choose Live to scroll through the song and highlight the current line, Focused to center the active lyric and show timed ad-libs around it, Group Chat to see singer parts as a color-coded conversation, or Plain Text to read lyrics grouped by singer without playback highlighting.' },
  { q: 'Does it work on a phone?', a: 'Yes. The layout adapts to phones and tablets, and Settings includes options to reduce animations on slower devices.' },
  { q: 'How do I get help or report a bug?', a: 'Use the Contact page. The guides also include a troubleshooting article for playback and artwork problems.' }
];

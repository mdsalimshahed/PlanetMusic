import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ABOUT, FAQ, FEATURES, SECTIONS, SITE, STEPS } from '../../content/homeContent.js';
import { getProceduralColor } from '../../../utils/proceduralColors.js';
import './HomeGuide.css';

const DEMO_LINE_COLORS = ['#ff8f9c', '#ffd166', '#8be9fd', '#c4a1ff', '#9be7a5', '#ffb86c'];
const shuffledDemoLineColors = [...DEMO_LINE_COLORS];

for (let index = shuffledDemoLineColors.length - 1; index > 0; index -= 1) {
  const randomIndex = Math.floor(Math.random() * (index + 1));
  [shuffledDemoLineColors[index], shuffledDemoLineColors[randomIndex]] = [
    shuffledDemoLineColors[randomIndex],
    shuffledDemoLineColors[index]
  ];
}

const DEMO_LINE_DATA = [
  {
    text: 'Where the moonlight learns to breathe',
    artist: 'Mira',
    artistStyle: 'mira'
  },
  {
    text: '⟁⟟⋇ ⌬⟡⋏⟐ ◈⌁⟁ ⊙⋔⌇'.toUpperCase(),
    translation: 'Even the smallest star carries the courage\nto outshine the dark.',
    pronunciation: 'BLEEP BLOOOP BLIM BLAM POOOOP',
    artist: '⟁⟟⋇',
    artistStyle: 'alien'
  },
  {
    text: 'Bajo estrellas, vuelvo a ti',
    translation: 'Beneath the stars, I return to you',
    artist: 'Sol',
    artistStyle: 'sol'
  },
  {
    text: 'The tide remembers our names',
    artist: 'Mira',
    artistStyle: 'mira'
  },
  {
    text: 'ひかりの先へ走り出す',
    translation: 'We run toward the light',
    pronunciation: 'HIKARI NO SAKI E HASHIRIDASU',
    artist: 'Noa',
    artistStyle: 'noa'
  },
  {
    text: 'Jusqu’à l’aube, nos cœurs brillent',
    translation: 'Until dawn, our hearts shine',
    artist: 'Ren',
    artistStyle: 'ren'
  }
];
const DEMO_ARTIST_STYLES = [...new Set(DEMO_LINE_DATA.map(({ artistStyle }) => artistStyle))];
const DEMO_ARTIST_COLORS = new Map(
  DEMO_ARTIST_STYLES.map((artistStyle, index) => [
    artistStyle,
    shuffledDemoLineColors[index % shuffledDemoLineColors.length]
  ])
);
const DEMO_LINES = DEMO_LINE_DATA.map((line) => ({
  ...line,
  color: DEMO_ARTIST_COLORS.get(line.artistStyle)
}));

const ABOUT_ART = [
  <svg key="library" viewBox="0 0 320 112" fill="none" aria-hidden="true">
    <rect x="68" y="17" width="78" height="78" rx="15" fill="#7548E8" />
    <rect x="77" y="26" width="60" height="60" rx="11" fill="url(#library-art)" />
    <circle cx="119" cy="48" r="17" fill="#312755" stroke="#F3EFFF" strokeOpacity="0.72" strokeWidth="2" />
    <circle cx="119" cy="48" r="12" stroke="#C3B3E0" strokeOpacity="0.62" />
    <circle cx="119" cy="48" r="8" stroke="#C3B3E0" strokeOpacity="0.5" />
    <circle cx="119" cy="48" r="4" fill="#5FD4FF" />
    <circle cx="119" cy="48" r="1.5" fill="#211936" />
    <circle cx="97" cy="61" r="19" fill="#211936" stroke="#F3EFFF" strokeOpacity="0.9" strokeWidth="2" />
    <circle cx="97" cy="61" r="14" stroke="#C3B3E0" strokeOpacity="0.72" />
    <circle cx="97" cy="61" r="9" stroke="#C3B3E0" strokeOpacity="0.58" />
    <circle cx="97" cy="61" r="5" fill="#F09BFF" />
    <circle cx="97" cy="61" r="1.5" fill="#211936" />
    <rect x="157" y="29" width="94" height="10" rx="5" fill="#E6D9FF" />
    <rect x="157" y="48" width="70" height="7" rx="3.5" fill="#9782BB" />
    <rect x="157" y="66" width="86" height="7" rx="3.5" fill="#554B68" />
    <circle cx="263" cy="34" r="16" fill="#27203B" />
    <path d="M256 34h14m-7-7v14" stroke="#C9A8FF" strokeWidth="2" strokeLinecap="round" />
    <defs>
      <linearGradient id="library-art" x1="77" y1="26" x2="137" y2="86" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F09BFF" />
        <stop offset="1" stopColor="#3478E5" />
      </linearGradient>
    </defs>
  </svg>,
  <svg key="lyrics" viewBox="0 0 320 112" fill="none" aria-hidden="true">
    <rect x="64" y="16" width="192" height="80" rx="15" fill="#100D1B" stroke="#49366B" />
    <path d="M82 37h57m-57 18h40m-40 18h61" stroke="#766A8C" strokeWidth="6" strokeLinecap="round" />
    <path d="M156 37h80m-68 18h68m-80 18h80" stroke="#D7C2FF" strokeWidth="6" strokeLinecap="round" />
    <path d="M160 30v50" stroke="#5FD4FF" strokeWidth="2" strokeDasharray="3 4" />
    <circle cx="160" cy="24" r="5" fill="#5FD4FF" />
    <path d="M91 85h11m8-5v5m8-11v11m8-16v16m8-8v8m8-13v13" stroke="#A77BFF" strokeWidth="3" strokeLinecap="round" />
  </svg>,
  <svg key="languages" viewBox="0 0 320 112" fill="none" aria-hidden="true">
    <rect x="64" y="19" width="88" height="74" rx="14" fill="#171326" stroke="#49366B" />
    <rect x="168" y="19" width="88" height="74" rx="14" fill="#171326" stroke="#28566A" />
    <text x="108" y="60" fill="#F3EFFF" fontSize="28" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">言</text>
    <text x="212" y="60" fill="#F3EFFF" fontSize="27" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">A</text>
    <path d="M84 75h48m104 0h-48" stroke="#9D93B8" strokeWidth="4" strokeLinecap="round" />
    <circle cx="160" cy="56" r="16" fill="#7548E8" />
    <path d="M153 56h14m-5-5 5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
];

const STEP_ART = [
  <svg key="search" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <circle cx="140" cy="45" r="27" stroke="#9D7BFF" strokeWidth="8" />
    <path d="m160 65 25 22" stroke="#5FD4FF" strokeWidth="9" strokeLinecap="round" />
    <path d="M129 45h22m-11-11v22" stroke="#F3EFFF" strokeWidth="4" strokeLinecap="round" />
    <circle cx="140" cy="45" r="39" stroke="#49366B" strokeWidth="2" strokeDasharray="4 7" />
  </svg>,
  <svg key="format" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <rect x="69" y="14" width="182" height="72" rx="12" fill="#171326" stroke="#49366B" strokeWidth="2" />
    <path d="M88 34h82m-82 16h56m-56 16h72" stroke="#766A8C" strokeWidth="6" strokeLinecap="round" />
    <path d="M188 34h42m-24 16h24m-42 16h42" stroke="#D7C2FF" strokeWidth="6" strokeLinecap="round" />
    <path d="m174 26 8 8-8 8m0 8 8 8-8 8" stroke="#5FD4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="artists" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <path d="M74 28h172M74 50h110M74 72h144" stroke="#49366B" strokeWidth="7" strokeLinecap="round" />
    <circle cx="55" cy="28" r="11" fill="#A77BFF" />
    <circle cx="55" cy="50" r="11" fill="#5FD4FF" />
    <circle cx="55" cy="72" r="11" fill="#F09BFF" />
    <path d="m223 51 9 9 19-21" stroke="#5FD4FF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="sync" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <path d="M64 51h31l10-19 14 39 14-51 16 62 13-42 11 11h83" stroke="#9D7BFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M64 83h192" stroke="#49366B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="150" cy="51" r="7" fill="#5FD4FF" stroke="#151222" strokeWidth="4" />
  </svg>,
  <svg key="translate" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <rect x="87" y="17" width="64" height="66" rx="12" fill="#171326" stroke="#7548E8" strokeWidth="2" />
    <rect x="169" y="17" width="64" height="66" rx="12" fill="#171326" stroke="#3478E5" strokeWidth="2" />
    <text x="119" y="58" fill="#F3EFFF" fontSize="26" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">言</text>
    <text x="201" y="58" fill="#F3EFFF" fontSize="25" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">A</text>
    <path d="M145 50h30m-8-8 8 8-8 8" stroke="#5FD4FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="views" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <rect x="73" y="17" width="74" height="66" rx="11" fill="#171326" stroke="#7548E8" strokeWidth="2" />
    <rect x="173" y="17" width="74" height="66" rx="11" fill="#171326" stroke="#3478E5" strokeWidth="2" />
    <path d="M88 36h44m-44 12h32m-32 12h38m63-24h44m-44 12h32m-32 12h38" stroke="#A77BFF" strokeWidth="4" strokeLinecap="round" />
    <circle cx="112" cy="72" r="4" fill="#5FD4FF" />
    <circle cx="210" cy="72" r="4" fill="#F09BFF" />
  </svg>
];

const FEATURE_ART = [
  <svg key="search" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <circle cx="148" cy="55" r="30" stroke="#A77BFF" strokeWidth="8" />
    <path d="m170 77 25 23" stroke="#5FD4FF" strokeWidth="9" strokeLinecap="round" />
    <path d="M135 55h26m-13-13v26" stroke="white" strokeWidth="4" strokeLinecap="round" />
    <path d="M91 27h30m-30 14h16m99 0h25m-25 12h16" stroke="#554B68" strokeWidth="5" strokeLinecap="round" />
  </svg>,
  <svg key="sync" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <path d="M52 63h38l13-22 18 46 18-61 20 75 17-51 15 13h77" stroke="#A77BFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M52 99h230" stroke="#49366B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="157" cy="63" r="7" fill="#5FD4FF" stroke="#100D1B" strokeWidth="4" />
  </svg>,
  <svg key="translation" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <rect x="58" y="20" width="91" height="80" rx="13" fill="#171326" stroke="#7548E8" strokeWidth="2" />
    <rect x="171" y="20" width="91" height="80" rx="13" fill="#171326" stroke="#3478E5" strokeWidth="2" />
    <text x="103" y="65" fill="#F3EFFF" fontSize="30" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">文</text>
    <text x="216" y="65" fill="#F3EFFF" fontSize="29" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">A</text>
    <path d="M92 82h23m97 0h9" stroke="#9D93B8" strokeWidth="4" strokeLinecap="round" />
  </svg>,
  <svg key="views" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <rect x="56" y="20" width="94" height="80" rx="12" fill="#171326" stroke="#49366B" />
    <rect x="170" y="20" width="94" height="80" rx="12" fill="#171326" stroke="#49366B" />
    <path d="M72 43h62m-62 14h46m-46 14h58" stroke="#B89DFF" strokeWidth="5" strokeLinecap="round" />
    <circle cx="194" cy="48" r="9" fill="#7548E8" />
    <circle cx="222" cy="48" r="9" fill="#3478E5" />
    <path d="M188 75h53" stroke="#5FD4FF" strokeWidth="5" strokeLinecap="round" />
  </svg>,
  <svg key="delay" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <g transform="translate(0 10)">
      <path d="M59 66V54c0-29 22-48 48-48s48 19 48 48v12" stroke="#A77BFF" strokeWidth="8" strokeLinecap="round" />
      <rect x="51" y="58" width="19" height="37" rx="9" fill="#7548E8" stroke="#D7C2FF" strokeWidth="2" />
      <rect x="144" y="58" width="19" height="37" rx="9" fill="#3478E5" stroke="#5FD4FF" strokeWidth="2" />
    </g>
    <path d="M185 42h79m-79 35h79" stroke="#554B68" strokeWidth="2" strokeLinecap="round" />
    <path d="M185 42h15l8-10 10 20 11-18 10 8h25" stroke="#D7C2FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M185 77h26l10-13 10 24 11-20 8 9h14" stroke="#5FD4FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M207 101h24m-6-6 6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="ambient" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <circle cx="158" cy="61" r="44" fill="#21123D" />
    <circle cx="158" cy="61" r="33" fill="#31204D" />
    <path d="M84 44c18-16 31 16 49 0s31 16 49 0 31 16 49 0" stroke="#F09BFF" strokeWidth="4" strokeLinecap="round" />
    <path d="M72 72c18-16 31 16 49 0s31 16 49 0 31 16 49 0 31 16 49 0" stroke="#5FD4FF" strokeWidth="3" strokeLinecap="round" />
  </svg>,
  <svg key="artist" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <circle cx="144" cy="46" r="23" fill="#7548E8" />
    <path d="M98 101c4-24 20-37 46-37s42 13 46 37" fill="#3478E5" />
    <circle cx="144" cy="46" r="31" stroke="#F09BFF" strokeWidth="2" />
    <path d="m201 29 4 10 11 1-8 7 2 11-9-6-10 6 3-11-8-7 11-1 4-10Z" fill="#5FD4FF" />
  </svg>,
  <svg key="backup" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <rect x="66" y="19" width="150" height="82" rx="12" fill="#171326" stroke="#49366B" strokeWidth="2" />
    <path d="M91 41h82M91 60h64M91 79h76" stroke="#766A8C" strokeWidth="5" strokeLinecap="round" />
    <rect x="76" y="32" width="13" height="13" rx="3" fill="#7548E8" />
    <path d="m79 38 3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="76" y="51" width="13" height="13" rx="3" fill="#7548E8" />
    <path d="m79 57 3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="76" y="70" width="13" height="13" rx="3" fill="#211936" stroke="#8C7CA8" strokeWidth="2" />
    <path d="M231 40v35m-14-14 14 14 14-14" stroke="#5FD4FF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M207 89h48" stroke="#A77BFF" strokeWidth="5" strokeLinecap="round" />
    <path d="M220 97h22" stroke="#554B68" strokeWidth="4" strokeLinecap="round" />
  </svg>,
  <svg key="settings" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <rect x="64" y="21" width="192" height="78" rx="14" fill="#171326" stroke="#49366B" strokeWidth="2" />
    <path d="M91 43h137M91 60h137M91 77h137" stroke="#554B68" strokeWidth="5" strokeLinecap="round" />
    <path d="M91 43h41m54 17h42M91 77h72" stroke="#A77BFF" strokeWidth="5" strokeLinecap="round" />
    <circle cx="139" cy="43" r="8" fill="#F09BFF" stroke="#171326" strokeWidth="3" />
    <circle cx="178" cy="60" r="8" fill="#5FD4FF" stroke="#171326" strokeWidth="3" />
    <circle cx="171" cy="77" r="8" fill="#F09BFF" stroke="#171326" strokeWidth="3" />
  </svg>
];

const HomeGuide = ({ isPlayerVisible = false }) => {
  const rootRef = useRef(null);
  const footerRef = useRef(null);
  const homeGuideCopyRef = useRef(null);
  const previewVisualRef = useRef(null);
  const previewPlayerRef = useRef(null);
  const lyricsScrollRef = useRef(null);
  const lyricsTrackRef = useRef(null);
  const lyricsTrackOffsetRef = useRef(0);
  const [activeSection, setActiveSection] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [demoIndex, setDemoIndex] = useState(1);
  const [previewWorkspace, setPreviewWorkspace] = useState('lyrics');
  const [shownPreviewWorkspace, setShownPreviewWorkspace] = useState('lyrics');
  const [previewTransitionPhase, setPreviewTransitionPhase] = useState('idle');
  const [isPreviewInView, setIsPreviewInView] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(false);
  const [latestChangelogEntry, setLatestChangelogEntry] = useState(null);
  const [groupChatMessages, setGroupChatMessages] = useState([]);
  const [changelogScrollbar, setChangelogScrollbar] = useState({ height: 0, top: 0, value: 0, max: 0, visible: false });
  const shownPreviewWorkspaceRef = useRef('lyrics');
  const vaultScrollRef = useRef(null);
  const groupChatMessagesRef = useRef(null);
  const changelogScrollRef = useRef(null);
  const changelogScrollbarTrackRef = useRef(null);
  const changelogScrollbarDragRef = useRef(null);
  const groupChatSequenceRef = useRef(0);
  const groupChatMessageIdRef = useRef(0);
  const previewTouchStartRef = useRef(null);
  const isMockPreviewActive = isPreviewInView && isDocumentVisible;

  useEffect(() => {
    const copy = homeGuideCopyRef.current;
    const visual = previewVisualRef.current;
    if (!copy || !visual) return undefined;

    const updateCopyHeight = () => {
      visual.style.setProperty('--home-guide-copy-height', `${copy.getBoundingClientRect().height}px`);
    };
    updateCopyHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateCopyHeight);
      return () => window.removeEventListener('resize', updateCopyHeight);
    }

    const resizeObserver = new ResizeObserver(updateCopyHeight);
    resizeObserver.observe(copy);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const visual = previewVisualRef.current;
    if (!visual) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setIsPreviewInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsPreviewInView(entry.isIntersecting && entry.intersectionRatio > 0),
      { threshold: 0 }
    );
    observer.observe(visual);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateDocumentVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible');
    updateDocumentVisibility();
    document.addEventListener('visibilitychange', updateDocumentVisibility);
    return () => document.removeEventListener('visibilitychange', updateDocumentVisibility);
  }, []);

  useEffect(() => {
    fetch('/changelog.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Changelog request failed (${response.status})`);
        return response.json();
      })
      .then((months) => {
        if (!Array.isArray(months) || months.some((month) => !Array.isArray(month.entries))) {
          throw new Error('The public changelog data has an invalid format.');
        }
        const latestEntry = months
          .flatMap((month) => month.entries)
          .filter((entry) => entry?.date && entry?.summary)
          .sort((first, second) => second.date.localeCompare(first.date))[0];
        if (!latestEntry) throw new Error('The public changelog contains no dated entries.');
        setLatestChangelogEntry(latestEntry);
      })
      .catch((error) => {
        console.error('Could not load the latest changelog entry for the homepage preview.', error);
      });
  }, []);

  // Scroll-spy: highlight the nav pill for the section currently on screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    SECTIONS.forEach(({ id }) => {
      const el = root.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeSection || !window.matchMedia('(max-width: 640px)').matches) return;
    const nav = rootRef.current?.querySelector('.home-guide-nav');
    const activeLink = nav?.querySelector(`a[href="#${activeSection}"]`);
    if (!nav || !activeLink) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const linkLeft = activeLink.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollTo({
      left: linkLeft - (nav.clientWidth - activeLink.clientWidth) / 2,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }, [activeSection]);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return undefined;
    const scrollArea = rootRef.current?.closest('.content-scroll-area') || null;
    const scrollTarget = scrollArea || window;
    const updateBackToTopVisibility = () => {
      if (scrollArea) {
        const remainingScroll = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
        setShowBackToTop(remainingScroll <= 120);
        return;
      }
      const remainingScroll = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setShowBackToTop(remainingScroll <= 120);
    };

    updateBackToTopVisibility();
    scrollTarget.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
    window.addEventListener('resize', updateBackToTopVisibility);
    return () => {
      scrollTarget.removeEventListener('scroll', updateBackToTopVisibility);
      window.removeEventListener('resize', updateBackToTopVisibility);
    };
  }, []);

  useEffect(() => {
    const scrollArea = changelogScrollRef.current;
    const track = changelogScrollbarTrackRef.current;
    if (!scrollArea || !track) return undefined;

    const updateScrollbar = () => {
      const trackHeight = track.clientHeight;
      const maxScroll = Math.max(0, scrollArea.scrollHeight - scrollArea.clientHeight);
      const thumbHeight = maxScroll > 0
        ? Math.min(trackHeight, Math.max(28, trackHeight * scrollArea.clientHeight / scrollArea.scrollHeight))
        : trackHeight;
      const thumbRange = Math.max(0, trackHeight - thumbHeight);
      setChangelogScrollbar({
        height: thumbHeight,
        top: maxScroll > 0 ? scrollArea.scrollTop / maxScroll * thumbRange : 0,
        value: scrollArea.scrollTop,
        max: maxScroll,
        visible: maxScroll > 0 && trackHeight > 0
      });
    };

    updateScrollbar();
    scrollArea.addEventListener('scroll', updateScrollbar, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollbar);
    resizeObserver?.observe(scrollArea);
    if (scrollArea.firstElementChild) resizeObserver?.observe(scrollArea.firstElementChild);

    return () => {
      scrollArea.removeEventListener('scroll', updateScrollbar);
      resizeObserver?.disconnect();
    };
  }, [latestChangelogEntry, shownPreviewWorkspace]);

  // Scroll-reveal for cards.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const reveal = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));
    return () => reveal.disconnect();
  }, []);

  // Looping lyric highlight in the hero preview.
  useEffect(() => {
    if (!isMockPreviewActive || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setDemoIndex((i) => (i + 1) % DEMO_LINES.length), 1600);
    return () => clearInterval(timer);
  }, [isMockPreviewActive]);

  useEffect(() => {
    if (shownPreviewWorkspace !== 'lyrics') return undefined;
    lyricsTrackOffsetRef.current = 0;
    const frame = window.requestAnimationFrame(() => {
      if (lyricsTrackRef.current) {
        lyricsTrackRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [shownPreviewWorkspace]);

  useEffect(() => {
    if (shownPreviewWorkspace !== 'lyrics') return undefined;

    const frame = window.requestAnimationFrame(() => {
      const scrollArea = lyricsScrollRef.current;
      const lyricsTrack = lyricsTrackRef.current;
      const activeLine = scrollArea?.querySelector('.home-guide-lyric-line.is-active');
      if (!scrollArea || !lyricsTrack || !activeLine) return;

      const areaBounds = scrollArea.getBoundingClientRect();
      const lineBounds = activeLine.getBoundingClientRect();
      const styles = window.getComputedStyle(scrollArea);
      const visibleTop = areaBounds.top + parseFloat(styles.paddingTop);
      const visibleBottom = areaBounds.bottom - parseFloat(styles.paddingBottom);
      const scrollDelta = lineBounds.top < visibleTop
        ? lineBounds.top - visibleTop
        : lineBounds.bottom > visibleBottom
          ? lineBounds.bottom - visibleBottom
          : 0;

      if (scrollDelta) {
        lyricsTrackOffsetRef.current -= scrollDelta;
        lyricsTrack.style.transform = `translate3d(0, ${lyricsTrackOffsetRef.current}px, 0)`;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [demoIndex, shownPreviewWorkspace]);

  useEffect(() => {
    if (shownPreviewWorkspace !== 'group-chat') {
      setGroupChatMessages([]);
      groupChatSequenceRef.current = 0;
      groupChatMessageIdRef.current = 0;
      return undefined;
    }
    if (!isMockPreviewActive) {
      return undefined;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let spawnTimer;
    const addMessage = () => {
      const index = groupChatSequenceRef.current++;
      setGroupChatMessages((messages) => [
        ...messages.slice(-23),
        {
          id: `group-chat-${groupChatMessageIdRef.current++}`,
          line: DEMO_LINES[index % DEMO_LINES.length],
          sequenceIndex: index
        }
      ]);
    };
    const startMessageChain = () => {
      addMessage();
      spawnTimer = window.setInterval(addMessage, 1600);
    };
    const handleMotionPreferenceChange = (event) => {
      window.clearInterval(spawnTimer);
      if (event.matches) {
        setGroupChatMessages(DEMO_LINES.map((line, index) => ({
          id: `group-chat-static-${index}`,
          line,
          sequenceIndex: index
        })));
      } else {
        groupChatMessageIdRef.current = 0;
        groupChatSequenceRef.current = 0;
        setGroupChatMessages([]);
        startMessageChain();
      }
    };

    if (reducedMotion.matches) {
      setGroupChatMessages(DEMO_LINES.map((line, index) => ({
        id: `group-chat-static-${index}`,
        line,
        sequenceIndex: index
      })));
    } else {
      setGroupChatMessages([]);
      startMessageChain();
    }

    reducedMotion.addEventListener('change', handleMotionPreferenceChange);
    return () => {
      window.clearInterval(spawnTimer);
      reducedMotion.removeEventListener('change', handleMotionPreferenceChange);
    };
  }, [isMockPreviewActive, shownPreviewWorkspace]);

  useEffect(() => {
    const lane = groupChatMessagesRef.current;
    if (!lane || shownPreviewWorkspace !== 'group-chat' || !isMockPreviewActive) return undefined;
    const frame = window.requestAnimationFrame(() => {
      lane.scrollTop = lane.scrollHeight;
    });
    const pruneMessagesOutsideView = () => {
      const laneBounds = lane.getBoundingClientRect();
      const hiddenIds = new Set(
        [...lane.querySelectorAll('[data-group-message-id]')]
          .filter((message) => message.getBoundingClientRect().bottom < laneBounds.top)
          .map((message) => message.dataset.groupMessageId)
      );
      if (hiddenIds.size) {
        setGroupChatMessages((messages) => messages.filter((message) => !hiddenIds.has(message.id)));
      }
    };
    lane.addEventListener('scroll', pruneMessagesOutsideView, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      lane.removeEventListener('scroll', pruneMessagesOutsideView);
    };
  }, [groupChatMessages, isMockPreviewActive, shownPreviewWorkspace]);

  useEffect(() => {
    if (previewWorkspace === shownPreviewWorkspaceRef.current) return undefined;
    if (!isMockPreviewActive) return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      shownPreviewWorkspaceRef.current = previewWorkspace;
      setShownPreviewWorkspace(previewWorkspace);
      setPreviewTransitionPhase('idle');
      return undefined;
    }

    setPreviewTransitionPhase('exiting');
    const enterTimer = window.setTimeout(() => {
      shownPreviewWorkspaceRef.current = previewWorkspace;
      setShownPreviewWorkspace(previewWorkspace);
      setPreviewTransitionPhase('entering');
    }, 180);
    const idleTimer = window.setTimeout(() => setPreviewTransitionPhase('idle'), 580);
    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(idleTimer);
    };
  }, [isMockPreviewActive, previewWorkspace]);

  const goTo = (id) => (event) => {
    event.preventDefault();
    const target = rootRef.current?.querySelector(`#${id}`);
    if (!target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scrollArea = rootRef.current?.closest('.content-scroll-area');
    if (scrollArea) {
      scrollArea.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const handleChangelogScrollbarPointerDown = (event) => {
    if (event.button !== 0 || !changelogScrollRef.current || !changelogScrollbarTrackRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    changelogScrollbarDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: changelogScrollRef.current.scrollTop
    };
  };

  const handleChangelogScrollbarPointerMove = (event) => {
    const drag = changelogScrollbarDragRef.current;
    const scrollArea = changelogScrollRef.current;
    const track = changelogScrollbarTrackRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !scrollArea || !track) return;

    const thumbRange = track.clientHeight - changelogScrollbar.height;
    if (thumbRange <= 0) return;
    const scrollRange = scrollArea.scrollHeight - scrollArea.clientHeight;
    scrollArea.scrollTop = drag.startScrollTop + (event.clientY - drag.startY) * scrollRange / thumbRange;
  };

  const handleChangelogScrollbarPointerUp = (event) => {
    if (changelogScrollbarDragRef.current?.pointerId !== event.pointerId) return;
    changelogScrollbarDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePreviewPlayerPointerDown = (event) => {
    if (
      event.pointerType !== 'touch'
      || !window.matchMedia('(max-width: 640px)').matches
      || !['vault', 'changelog'].includes(shownPreviewWorkspace)
    ) return;

    previewTouchStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  };

  const handlePreviewPlayerPointerUp = (event) => {
    const touchStart = previewTouchStartRef.current;
    if (!touchStart || touchStart.pointerId !== event.pointerId) return;
    previewTouchStartRef.current = null;

    const movedX = event.clientX - touchStart.x;
    const movedY = event.clientY - touchStart.y;
    if (Math.hypot(movedX, movedY) > 8) return;
    previewPlayerRef.current?.focus({ preventScroll: true });
  };

  const handlePreviewPlayerPointerCancel = (event) => {
    if (previewTouchStartRef.current?.pointerId === event.pointerId) {
      previewTouchStartRef.current = null;
    }
  };

  const handlePreviewPlayerKeyDown = (event) => {
    const scrollArea = shownPreviewWorkspace === 'vault'
      ? vaultScrollRef.current
      : shownPreviewWorkspace === 'changelog'
        ? changelogScrollRef.current
        : null;
    if (!scrollArea) return;

    if (event.key === 'ArrowDown') scrollArea.scrollTop += 40;
    else if (event.key === 'ArrowUp') scrollArea.scrollTop -= 40;
    else if (event.key === 'PageDown') scrollArea.scrollTop += scrollArea.clientHeight;
    else if (event.key === 'PageUp') scrollArea.scrollTop -= scrollArea.clientHeight;
    else if (event.key === 'Home') scrollArea.scrollTop = 0;
    else if (event.key === 'End') scrollArea.scrollTop = scrollArea.scrollHeight;
    else return;
    event.preventDefault();
  };

  const changelogChanges = latestChangelogEntry?.summary.split(/(?<=[.!?])\s+/).filter(Boolean) || [];
  const isMockScrollableView = shownPreviewWorkspace === 'vault' || shownPreviewWorkspace === 'changelog';
  const changelogDate = latestChangelogEntry
    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      .format(new Date(`${latestChangelogEntry.date}T00:00:00`))
    : '';
  const isChangelogList = changelogChanges.length < 7;
  const changelogColumns = isChangelogList
    ? [{ items: changelogChanges.map((text, index) => ({ text, index })) }]
    : changelogChanges.reduce((columns, text, index) => {
      columns[index % columns.length].items.push({ text, index });
      return columns;
    }, [{ items: [] }, { items: [] }]);

  return (
    <div className="home-guide" ref={rootRef}>
      <nav className="home-guide-nav" aria-label="On this page">
        {SECTIONS.map(({ id, label }) => (
          <a key={id} href={`#${id}`} onClick={goTo(id)} className={activeSection === id ? 'is-active' : ''} aria-current={activeSection === id ? 'true' : undefined}>
            {label}
          </a>
        ))}
      </nav>

      <header className={`home-guide-hero${isPlayerVisible ? ' has-player-ui' : ''}`} id="top">
        <div className="home-guide-stars" aria-hidden="true" />
        <div className="home-guide-copy" ref={homeGuideCopyRef}>
          <h1 className="pm-logo home-guide-title">
            <span>Listen to </span>
            <span className="pm-music" data-logo-text="MUSIC">MUSIC</span>
            <span> of the </span>
            <span className="pm-planet" data-logo-text="PLANET">PLANET</span>
          </h1>
          <p className="home-guide-lead">
            {SITE.description} Automatic translations and pronunciation readings can be reviewed and edited beside the
            original lyrics. No account or install required.
          </p>
          <ul className="home-guide-chips" aria-label="Highlights">
            <li>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="4" y="8" width="12" height="9" rx="2" />
                <path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2m-3.5 3v2" />
              </svg>
              Private by design
            </li>
            <li>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2.5" y="4" width="10" height="12" rx="1.5" />
                <path d="M5 14h5m5-6h2.5A1.5 1.5 0 0 1 19 9.5v6a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 13 15.5v-6A1.5 1.5 0 0 1 14.5 8Z" />
              </svg>
              Works on phone &amp; desktop
            </li>
            <li>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="7.5" />
                <path d="M2.8 7h14.4M2.8 13h14.4M10 2.5a12 12 0 0 1 0 15m0-15a12 12 0 0 0 0 15" />
              </svg>
              Lyrics in any language
            </li>
          </ul>
          <div className="home-guide-actions">
            <Link className="home-guide-action-card is-primary" to="/vault">
              <span className="home-guide-vault-graphic" aria-hidden="true">
                <span className="home-guide-vault-orbit" />
                <span className="home-guide-vault-record home-guide-vault-record-back"><i /></span>
                <span className="home-guide-vault-record home-guide-vault-record-front"><i /></span>
                <span className="home-guide-vault-wave"><i /><i /><i /><i /><i /><i /><i /></span>
              </span>
              <span className="home-guide-action-copy">
                <small className="home-guide-action-eyebrow">YOUR MUSIC · YOUR UNIVERSE</small>
                <strong>
                  Open your Vault
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </strong>
                <small>Find a song and let the lyrics take you somewhere.</small>
              </span>
              <span className="home-guide-vault-spark home-guide-vault-spark-one" aria-hidden="true">✦</span>
              <span className="home-guide-vault-spark home-guide-vault-spark-two" aria-hidden="true">✧</span>
            </Link>
          </div>
        </div>

        <div
          ref={previewVisualRef}
          className={`home-guide-visual ${isMockPreviewActive ? '' : 'is-mock-paused'}`}
          role="group"
          aria-label="Interactive preview of PlanetMusic workspaces"
        >
          <div className="home-guide-planet" aria-hidden="true">
            <div className="home-guide-ring home-guide-ring-a home-guide-ring-back" />
            <div className="home-guide-ring home-guide-ring-b home-guide-ring-back" />
            <div className="home-guide-ring home-guide-ring-c home-guide-ring-back" />
            <div className="home-guide-ring home-guide-ring-d home-guide-ring-back" />
            <img src="/favicon.svg?v=12" alt="" />
            <div className="home-guide-ring home-guide-ring-a home-guide-ring-front" />
            <div className="home-guide-ring home-guide-ring-b home-guide-ring-front" />
            <div className="home-guide-ring home-guide-ring-c home-guide-ring-front" />
            <div className="home-guide-ring home-guide-ring-d home-guide-ring-front" />
          </div>
          <div
            ref={previewPlayerRef}
            className={`home-guide-player ${shownPreviewWorkspace === 'vault' ? 'is-vault' : ''} ${shownPreviewWorkspace === 'lyrics' ? 'is-lyrics' : ''} ${shownPreviewWorkspace === 'group-chat' ? 'is-group-chat' : ''} ${shownPreviewWorkspace === 'ambient' ? 'is-ambient' : ''} ${shownPreviewWorkspace === 'changelog' ? 'is-changelog' : ''}`}
            tabIndex={isMockScrollableView ? 0 : -1}
            aria-label={isMockScrollableView ? `${shownPreviewWorkspace === 'vault' ? 'Vault' : 'Changelog'} mock window. Focus to scroll.` : undefined}
            onPointerDown={handlePreviewPlayerPointerDown}
            onPointerUp={handlePreviewPlayerPointerUp}
            onPointerCancel={handlePreviewPlayerPointerCancel}
            onKeyDown={handlePreviewPlayerKeyDown}
          >
            <div
              ref={shownPreviewWorkspace === 'vault' ? vaultScrollRef : undefined}
              key={shownPreviewWorkspace}
              className={`home-guide-preview-stage ${previewTransitionPhase} ${shownPreviewWorkspace === 'vault' ? 'is-vault' : ''} ${shownPreviewWorkspace === 'lyrics' ? 'is-lyrics' : ''} ${shownPreviewWorkspace === 'group-chat' ? 'is-group-chat' : ''} ${shownPreviewWorkspace === 'ambient' ? 'is-ambient' : ''} ${shownPreviewWorkspace === 'changelog' ? 'is-changelog' : ''}`}
            >
              {shownPreviewWorkspace === 'vault' && (
                <div className="home-guide-preview-library">
                  <div className="home-guide-vault-heading">
                    <span className="pm-logo home-guide-vault-wordmark" aria-label="Fictional alien-script wordmark">
                      <span className="pm-planet">⟟⌬⟁</span>
                      <span className="pm-music">⟐⋏⌇</span>
                    </span>
                  </div>
                  <div className="home-guide-vault-search" aria-hidden="true">
                    <b>
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="8.5" cy="8.5" r="5.5" />
                        <path d="m13 13 4 4" />
                      </svg>
                    </b>
                  </div>
                  <div className="home-guide-vault-grid">
                    {[
                      ['⟟⌬⟁⟐', '⋏⌇⌁', 'art-1', false],
                      ['⌬⋇⟡⋏', '⟁⌑⟟', 'art-2', true],
                      ['⊹◈⌇⟐', '⌁⟡⋔', 'art-3', true],
                      ['⟡⌁◈⋇', '⌬⋏⌖', 'art-10', false],
                      ['⟁⌁⊙⌬', '⟐⋏⌑', 'art-4', false],
                      ['⋇⌬⟐⋏', '◈⌁⌖', 'art-5', false],
                      ['⌁⟡⋔◈', '⟁⋇⌬', 'art-6', true],
                      ['⊙⟁⌬⋔', '⟐⌑⋇', 'art-11', true],
                      ['◈⌖⌁⟐', '⋏⟐⌬', 'art-7', true],
                      ['⋇⊙⟁⌑', '⌁◈⋔', 'art-8', false],
                      ['⌬⟐⋇⊹', '⌖⌁⋏', 'art-9', false],
                      ['⋏⌖⟐⊹', '⌁⌬◈', 'art-12', false]
                    ].map(([title, artist, artwork, explicit], index) => (
                      <article
                        className="home-guide-vault-card"
                        key={title}
                        style={{ '--preview-stagger-index': index }}
                      >
                        <div className={`home-guide-vault-art ${artwork}`}>
                          {explicit && <span className="home-guide-vault-explicit">⌬</span>}
                          <span className="home-guide-vault-play" aria-hidden="true">
                            <svg viewBox="0 0 20 20">
                              <path d="M6 4.5 15 10l-9 5.5z" />
                            </svg>
                          </span>
                          <span className="home-guide-vault-card-info">
                            <strong>{title}</strong>
                            <small>{artist}</small>
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            {shownPreviewWorkspace === 'lyrics' && (
              <div className="home-guide-preview-lyrics" aria-label="Live lyrics preview">
                <div className="home-guide-lyrics-artists" aria-hidden="true">
                  <span key={DEMO_LINES[demoIndex].artistStyle} className={`home-guide-group-avatar home-guide-lyrics-avatar group-avatar-${DEMO_LINES[demoIndex].artistStyle}`}>
                    <img src={`/artist-avatars/${DEMO_LINES[demoIndex].artistStyle}.png`} alt="" />
                  </span>
                </div>
                <span
                  className="home-guide-lyrics-artist-name"
                  style={{ color: DEMO_LINES[demoIndex].color }}
                >
                  {DEMO_LINES[demoIndex].artist}
                </span>
                <div className="home-guide-lyrics" ref={lyricsScrollRef} aria-hidden="true">
                  <div className="home-guide-lyrics-track" ref={lyricsTrackRef}>
                    {DEMO_LINES.map((line, i) => (
                      <div key={line.text} className={`home-guide-lyric-line ${i === demoIndex ? 'is-active' : i < demoIndex ? 'is-past' : ''}`}>
                        <div className="home-guide-lyric-anchor">
                          {line.translation && (
                            <span className="home-guide-lyric-translation">{line.translation.toUpperCase()}</span>
                          )}
                          <p style={{ color: line.color }}>{line.text}</p>
                          {line.pronunciation && (
                            <small className="home-guide-lyric-pronunciation">{line.pronunciation.toUpperCase()}</small>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {shownPreviewWorkspace === 'group-chat' && (
              <div className="home-guide-preview-group-chat" aria-label="Group chat lyrics preview">
                <div className="home-guide-group-chat-heading">
                  <div className="home-guide-group-avatars" aria-hidden="true">
                    {['mira', 'ren', 'sol', 'noa', 'alien'].map((artist) => (
                      <span className={`group-avatar-${artist}`} key={artist}>
                        <img src={`/artist-avatars/${artist}.png`} alt="" />
                      </span>
                    ))}
                  </div>
                  <i aria-hidden="true" />
                </div>
                <div className="home-guide-group-chat-messages" ref={groupChatMessagesRef}>
                  {groupChatMessages.map(({ id, line, sequenceIndex }) => {
                    const side = sequenceIndex % 2 === 0 ? 'right' : 'left';
                    return (
                      <div
                        className={`home-guide-group-message is-${side}`}
                        data-group-message-id={id}
                        key={id}
                      >
                        <span className={`home-guide-group-avatar group-avatar-${line.artistStyle}`} aria-hidden="true">
                          <img src={`/artist-avatars/${line.artistStyle}.png`} alt="" />
                        </span>
                        <div className="home-guide-group-message-content">
                          <div className="home-guide-group-bubble">
                            {line.translation && <span>{line.translation.toUpperCase()}</span>}
                            <p style={{ color: line.color }}>{line.text}</p>
                            {line.pronunciation && <small>{line.pronunciation.toUpperCase()}</small>}
                          </div>
                          <small className="home-guide-group-speaker">{line.artist}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {shownPreviewWorkspace === 'ambient' && (
              <div className="home-guide-preview-ambient">
                <div className="home-guide-ambient-chat" aria-hidden="true">
                  {DEMO_LINES.filter((_, index) => index !== 5).map((line, index) => (
                    <div className={`home-guide-ambient-message ${line.pronunciation ? 'has-pronunciation' : ''} ${index % 2 === 0 ? 'is-left' : 'is-right'}`} key={line.text}>
                      <span className={`home-guide-group-avatar home-guide-ambient-avatar group-avatar-${line.artistStyle}`}>
                        <img src={`/artist-avatars/${line.artistStyle}.png`} alt="" />
                      </span>
                      <div className="home-guide-ambient-bubble-content">
                        <span className="home-guide-ambient-artist">{line.artist}</span>
                        <span className="home-guide-ambient-lyric home-guide-ambient-lyric-original">{line.text}</span>
                        {line.pronunciation && (
                          <span className="home-guide-ambient-lyric home-guide-ambient-lyric-pronunciation">{line.pronunciation}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {shownPreviewWorkspace === 'changelog' && (
              <div className="home-guide-preview-changelog">
                <div className="home-guide-changelog-heading">
                  <h2>whats NEW!!!</h2>
                  {latestChangelogEntry && (
                    <div className="home-guide-changelog-meta">
                      <div className="home-guide-changelog-pills">
                        <span>{changelogChanges.length} {changelogChanges.length === 1 ? 'change' : 'changes'}</span>
                        {Number.isInteger(latestChangelogEntry.commits) && (
                          <span className="home-guide-changelog-commit-count">
                            {latestChangelogEntry.commits} {latestChangelogEntry.commits === 1 ? 'commit' : 'commits'}
                          </span>
                        )}
                      </div>
                      <time dateTime={latestChangelogEntry.date}>{changelogDate}</time>
                    </div>
                  )}
                </div>
                <div className="home-guide-changelog-scroll-shell">
                  <div id="home-guide-changelog-content" className="home-guide-changelog-scroll" ref={changelogScrollRef} tabIndex="-1" aria-label="Latest PlanetMusic changelog entry">
                    {latestChangelogEntry ? (
                      <div className={`home-guide-changelog-grid${isChangelogList ? ' is-list' : ''}`}>
                        {changelogColumns.map((column, columnIndex) => (
                          <ol key={columnIndex}>
                            {column.items.map(({ text, index }) => (
                              <li
                                data-change-number={index + 1}
                                key={`${latestChangelogEntry.date}-${index}`}
                                style={{
                                  '--preview-stagger-index': index,
                                  backgroundColor: `color-mix(in srgb, ${getProceduralColor(`changelog:card:${latestChangelogEntry.date}:${index}`)} 24%, transparent)`
                                }}
                              >
                                {text}
                              </li>
                            ))}
                          </ol>
                        ))}
                      </div>
                    ) : (
                      <p>Loading the latest website changes…</p>
                    )}
                  </div>
                  <div className="home-guide-changelog-scrollbar" ref={changelogScrollbarTrackRef} aria-hidden={!changelogScrollbar.visible}>
                    <div
                      className="home-guide-changelog-scrollbar-thumb"
                      style={{ height: changelogScrollbar.height, transform: `translateY(${changelogScrollbar.top}px)` }}
                      role="scrollbar"
                      aria-label="Changelog scroll position"
                      aria-controls="home-guide-changelog-content"
                      aria-orientation="vertical"
                      aria-valuemin="0"
                      aria-valuemax={Math.round(changelogScrollbar.max)}
                      aria-valuenow={Math.round(changelogScrollbar.value)}
                      tabIndex={changelogScrollbar.visible ? 0 : -1}
                      onPointerDown={handleChangelogScrollbarPointerDown}
                      onPointerMove={handleChangelogScrollbarPointerMove}
                      onPointerUp={handleChangelogScrollbarPointerUp}
                      onPointerCancel={handleChangelogScrollbarPointerUp}
                      onKeyDown={(event) => {
                        const scrollArea = changelogScrollRef.current;
                        if (!scrollArea) return;
                        if (event.key === 'ArrowDown') scrollArea.scrollTop += 40;
                        else if (event.key === 'ArrowUp') scrollArea.scrollTop -= 40;
                        else if (event.key === 'PageDown') scrollArea.scrollTop += scrollArea.clientHeight;
                        else if (event.key === 'PageUp') scrollArea.scrollTop -= scrollArea.clientHeight;
                        else if (event.key === 'Home') scrollArea.scrollTop = 0;
                        else if (event.key === 'End') scrollArea.scrollTop = scrollArea.scrollHeight;
                        else return;
                        event.preventDefault();
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
          <div className="home-guide-preview-tabs" role="group" aria-label="Choose a workspace preview">
            {[
              ['vault', 'Vault'],
              ['lyrics', 'Live'],
              ['group-chat', 'Group Chat'],
              ['ambient', 'Ambient'],
              ['changelog', 'Changelog']
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={previewWorkspace === id}
                aria-label={`Show ${label} preview`}
                onClick={() => setPreviewWorkspace(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section id="about" className="home-guide-section" aria-labelledby="about-title">
        <p className="home-guide-kicker">What PlanetMusic is</p>
        <h2 id="about-title">A music library that also understands lyrics.</h2>
        <p className="home-guide-section-lead">
          PlanetMusic is not a streaming service. It is a set of tools for people who want to do more with the songs they already
          listen to: organize them, follow along with the words, and learn what the words mean.
        </p>
        <div className="home-guide-about">
          {ABOUT.map((item, i) => (
            <article key={item.title} data-reveal style={{ '--i': i }}>
              <div className="home-guide-about-art">{ABOUT_ART[i]}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="home-guide-section" aria-labelledby="how-title">
        <p className="home-guide-kicker">How it works</p>
        <h2 id="how-title">From search to synced lyrics in six steps.</h2>
        <ol className="home-guide-steps">
          {STEPS.map((step, i) => (
            <li key={step.n} data-reveal style={{ '--i': i }}>
              <Link className="home-guide-step-link" to={step.to}>
                <span className="home-guide-step-art">{STEP_ART[i]}</span>
                <h3>{step.title}</h3>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="home-guide-section" aria-labelledby="features-title">
        <p className="home-guide-kicker">Features</p>
        <h2 id="features-title">Built for listening closely.</h2>
        <div className="home-guide-grid">
          {FEATURES.map((f, i) => (
            <Link key={f.title} to={f.to} className="home-guide-card" data-reveal style={{ '--i': i }}>
              <span className="home-guide-feature-art">{FEATURE_ART[i]}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="home-guide-more">Read the guide <b aria-hidden="true">↗</b></span>
            </Link>
          ))}
        </div>
      </section>

      <section id="guides" className="home-guide-section" aria-labelledby="guides-title">
        <div className="home-guide-section-row">
          <div>
            <p className="home-guide-kicker">Docs &amp; writing</p>
            <h2 id="guides-title">Choose your destination.</h2>
          </div>
        </div>
        <div className="home-guide-portals">
          <Link to="/docs/dev-blogs" className="home-guide-portal home-guide-portal-docs" data-reveal style={{ '--i': 0 }}>
            <span className="home-guide-portal-mode">READ</span>
            <h3>Developer Blogs</h3>
            <p>Official guides and how-tos.</p>
            <span className="home-guide-portal-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link to="/docs/custom-blog" className="home-guide-portal home-guide-portal-custom" data-reveal style={{ '--i': 1 }}>
            <span className="home-guide-portal-mode">WRITE · SAVED IN THIS BROWSER</span>
            <h3>Custom Blogs</h3>
            <p>Your own articles, stored privately in this browser.</p>
            <span className="home-guide-portal-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section id="faq" className="home-guide-section home-guide-faq" aria-labelledby="faq-title">
        <p className="home-guide-kicker">Questions</p>
        <h2 id="faq-title">Quick answers.</h2>
        <div className="home-guide-faq-list">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="home-guide-footer" ref={footerRef}>
        <p>PlanetMusic is a music editing and organization workspace, not a licensed music catalog. Some features use third-party services.</p>
        <nav aria-label="More about PlanetMusic">
          <Link to="/docs/dev-blogs">Guides</Link><Link to="/docs/changelog">Changelog</Link><Link to="/privacy">Privacy Policy</Link><Link to="/docs/terms-of-service">Terms of Service</Link><Link to="/contact">Contact</Link><Link to="/docs/about-me">About Me</Link>
        </nav>
      </footer>
      {showBackToTop && (
        <button className="home-guide-back-to-top" type="button" onClick={scrollToTop}>
          <span aria-hidden="true">↑</span> Back to top
        </button>
      )}
    </div>
  );
};

export default HomeGuide;

# 🪐 PlanetMusic

*The ultimate client-side music vault, dynamic lyrics engine, and language comprehension tool.*

[![Live Demo](https://img.shields.io/badge/Live_Demo-planetmusic.pages.dev-fbbf24?style=for-the-badge&logo=vercel)](https://planetmusic.pages.dev)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Client_Side-1DB954?style=for-the-badge)](#privacy--architecture)

**PlanetMusic** is a completely serverless, stateless web application designed for music lovers, karaoke enthusiasts, and language learners. It transforms your browser into a localized, ultra-customizable music vault with deeply immersive, synchronized lyric environments. 

Experience the app live at: **[https://planetmusic.pages.dev](https://planetmusic.pages.dev)**

By leveraging browser-native storage and advanced spatial rendering algorithms, PlanetMusic delivers a premium audio-visual experience entirely on your local machine—no downloads, installations, or accounts required.

## Public pages and publishing

The production build prerenders public routes as individual HTML files in `dist/`. Cloudflare Pages serves these at clean URLs such as `/docs/dev-blog/post/welcome-to-planetmusic`; crawlers receive the article text, page-specific metadata, and structured data in the HTML response without needing to run the React app. Song modal URLs are rewritten to the app entry point so opening or refreshing a `/song/...` deep link restores the modal. Unknown routes load the same app shell so the in-app 404 appears with the regular PlanetMusic interface. The build also generates `sitemap.xml`, `feed.xml`, and `404.html`.

The public developer guides come from `public/blog_posts.json`. To publish or update a guide, update that source and deploy a new build. Articles created in the in-app **Custom Blogs** editor are stored in that browser's local storage; they are private to that browser and are not published, included in the sitemap, or sent to search engines.

PlanetMusic targets Chrome 64+, Firefox 60+, Safari 12+, Edge 79+, and iOS 12+. Both production JavaScript outputs are compiled for this baseline. Browsers without module support receive the legacy bundle and polyfills; older module-capable browsers without dynamic-import support are routed to that same bundle. A ResizeObserver polyfill covers older Firefox-based browsers that predate the native API. Public pages are prerendered as readable HTML; motion is suppressed only while this static fallback is displayed, and the full interactive app restores its normal layout and animations once JavaScript starts. The Vault is blocked with a compatibility notice in browsers below the listed minimum versions; public pages remain readable. The Vault and custom blog drafts are stored locally, so viewing or changing that personal data requires JavaScript. Internet Explorer and browsers older than these versions are not supported. For compatibility testing, use `npm run dev:pages` at `http://localhost:8788` or test the deployed site; the Vite development server (`npm run dev`) does not include production compatibility bundles or generated route pages.

---

## ✨ Showcase Features

### 🌌 The Cosmos & The Vault
Search the "Cosmos" to fetch global track metadata, high-resolution artwork, and lyrics. With one click, save tracks directly to your "Vault." Your Vault is a persistent, localized library powered entirely by your browser's native `IndexedDB` and `LocalStorage`—meaning zero network load times and unparalleled privacy.

### 🎤 Spatial Ad-Lib Rendering (Focused View)
Experience lyrics like never before. In **Focused View**, the primary vocal line anchors to the center of the screen. Background vocals, echoes, and ad-libs are dynamically rendered orbiting the main text. PlanetMusic utilizes a custom **anti-collision spatial algorithm** to calculate safe zones on the fly, ensuring complex multi-singer tracks (even massive 5+ artist ensembles) render flawlessly without overlapping elements.

### 🌐 Advanced Linguistic Engine
Built for global music comprehension, PlanetMusic natively supports complex scripts including Japanese, Chinese, Korean, Arabic, and Bengali. 
* **Phonetic Transliteration:** Automatically generates Romanized phonetics (Romaji, Pinyin, etc.) alongside localized translations.
* **Auto-Spacing Algorithm:** Chinese and Japanese natively lack spaces. Our custom reverse-alignment engine contextually analyzes continuous scripts and intelligently injects spacing to allow for perfect word-by-word karaoke highlighting.

### 🎛️ Real-Time Web Audio Equalizer
When utilizing supported audio sources, PlanetMusic intercepts the audio signal through the browser's `AudioContext`. A Fast Fourier Transform (FFT) analyzes the frequencies 60 times a second to drive a beautifully smoothed, mathematically accurate live visualizer at the base of the screen.

### 🫧 Ambient Waterfall Mode
Turn your secondary monitor or TV into a stunning visualizer. Ambient Mode strips away the UI, scanning your Vault in the background to spawn perfectly timed, floating lyric "chat bubbles" that drift gracefully across a dynamic, album-art-derived gradient background.

---

## 🛠️ The Workspaces

PlanetMusic is highly modular, featuring dedicated graphical workspaces for total library control:

* **⏱️ Sync Workspace:** A keyboard-driven, precision timeline editor. Map start/end markers, step backwards, and split ad-libs onto their own independent audio loops seamlessly.
* **🌍 Translation Workspace:** A powerful side-by-side editor for translating poetry with context. Group lines by language to preserve grammar, adjust transliterations, and export/import `.txt` files to share translations.
* **🎨 Image & Artist Manager:** Assign dedicated hex colors and high-resolution avatars to specific artists. The engine globally applies these assets whenever that artist sings across your entire Vault.
* **📝 Creator Studio:** A built-in Markdown blogging engine for documenting your syncing strategies, translation notes, or personal music journal.

---

## 🔒 Privacy & Architecture

PlanetMusic is an architectural fortress of privacy. 

* **No User Library Database:** We do not store a database of user libraries.
* **Total Data Sovereignty:** Your data (audio blobs, custom lyrics, translation caches, and metadata) lives exclusively on your local hardware within your browser's sandboxed environment.
* **No Telemetry:** There are no user accounts, no login portals, and no proprietary tracking scripts.

You have total control. You can export your entire application state as a single JSON backup at any time, or trigger the **Purge** function to permanently annihilate your local database in milliseconds.

Translation requests send the selected lyric text to the PlanetMusic backend, which forwards it to Google Translate for translation and transliteration. The frontend schedules up to ten concurrent requests while preserving a 120-requests-per-minute client-side ceiling; the backend caps in-flight translation requests at ten and distributes outbound requests across the configured Webshare proxy pool. Backend rate limits and upstream `429` responses remain in effect. The backend does not persist request text. Configure the same `BACKEND_GATEWAY_TOKEN` on the backend service and the frontend Pages deployment; local Vite development reads it from `.dev.vars` (copy `.dev.vars.example` and set the token).

---

## 💡 Tech Stack
* **Framework:** React 18 / Vite
* **Routing:** React Router v6
* **Storage:** IndexedDB / LocalStorage Native APIs
* **Audio/Visual:** HTML5 Media / Web Audio API
* **Styling:** Custom CSS (Glassmorphism, Fluid Typography, Viewport Clamping)

---
### 🌍 Ready to explore the Cosmos?
**Launch the app directly in your browser: [planetmusic.pages.dev](https://planetmusic.pages.dev)**

*PlanetMusic — Your music, your language, your vault.*
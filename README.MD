# 🪐 PlanetMusic

*The ultimate client-side music vault, dynamic lyrics engine, and language comprehension tool.*

[![Live Demo](https://img.shields.io/badge/Live_Demo-planetmusic.pages.dev-fbbf24?style=for-the-badge&logo=vercel)](https://planetmusic.pages.dev)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Client_Side-1DB954?style=for-the-badge)](#privacy--architecture)

**PlanetMusic** is a completely serverless, stateless web application designed for music lovers, karaoke enthusiasts, and language learners. It transforms your browser into a localized, ultra-customizable music vault with deeply immersive, synchronized lyric environments. 

Experience the app live at: **[https://planetmusic.pages.dev](https://planetmusic.pages.dev)**

By leveraging browser-native storage and advanced spatial rendering algorithms, PlanetMusic delivers a premium audio-visual experience entirely on your local machine—no downloads, installations, or accounts required.

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

* **Zero Central Servers:** We do not maintain a database of user libraries.
* **Total Data Sovereignty:** Your data (audio blobs, custom lyrics, translation caches, and metadata) lives exclusively on your local hardware within your browser's sandboxed environment.
* **No Telemetry:** There are no user accounts, no login portals, and no proprietary tracking scripts.

You have total control. You can export your entire application state as a single JSON backup at any time, or trigger the **Purge** function to permanently annihilate your local database in milliseconds.

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
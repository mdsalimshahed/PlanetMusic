import "./PlanetMusicLogo.css";

export default function PlanetMusicLogo({ isPlaying = false, albumAccentColor }) {
  return (
    <span
      className={`pm-logo${isPlaying ? " is-playing" : ""}`}
      style={albumAccentColor ? { "--logo-art-accent": albumAccentColor } : undefined}
      role="img"
      aria-label="PlanetMusic"
    >
      <span className="pm-planet" data-logo-text="PLANET" aria-hidden="true">PLANET</span>
      <span className="pm-music" data-logo-text="MUSIC" aria-hidden="true">MUSIC</span>
    </span>
  );
}

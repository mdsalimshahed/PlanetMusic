import { getProceduralGradient } from '../../../utils/proceduralColors.js';

const SettingsCardHeading = ({ children, seed, gradient }) => (
  <h3
    className="settings-card-heading"
    style={{ backgroundImage: gradient || getProceduralGradient(`settings:heading:${seed}`) }}
  >
    {children}
  </h3>
);

export default SettingsCardHeading;
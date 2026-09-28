import { getProceduralColor } from '../../../utils/proceduralColors.js';

const SettingsSubheading = ({ children, seed }) => (
  <h4 className="sub-group-title" style={{ color: getProceduralColor(`settings:subheading:${seed}`) }}>
    {children}
  </h4>
);

export default SettingsSubheading;
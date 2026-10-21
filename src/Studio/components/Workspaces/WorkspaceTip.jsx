import { Link } from 'react-router-dom';
import './WorkspaceTip.css';

const WorkspaceTip = ({ title, guideTo, guideLabel, children }) => (
  <aside className="workspace-tip" role="note">
    <span className="workspace-tip-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M8.2 14.5A7 7 0 1 1 15.8 14.5c-.9.7-1.4 1.6-1.6 2.5h-4.4c-.2-.9-.7-1.8-1.6-2.5Z" />
        <path d="M12 2v1" />
      </svg>
    </span>
    <strong className="workspace-tip-title">{title}</strong>
    <div className="workspace-tip-content">
      {children}
      <Link className="workspace-tip-guide-link" to={guideTo}>
        Read: {guideLabel}
      </Link>
    </div>
  </aside>
);

export default WorkspaceTip;

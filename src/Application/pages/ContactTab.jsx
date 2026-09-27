/* --- src/pages/ContactTab.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './ContactTab.css';
import SponsorUnit from '../components/Promos/SponsorUnit.jsx';

const FEEDBACK_FRAME_NAME = 'feedback-submit-frame';
const DEFAULT_FEEDBACK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwsgSeL4WumbQNVFc9goFRjiEyUtZldk0IOyhwaB2Pnj0lxRtDKZ_k5Govq7qbWNzZg/exec';

const ContactTab = ({ adsEnabled }) => {
  const [formData, setFormData] = useState({ name: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' or 'error'
  const [submitDetail, setSubmitDetail] = useState('');
  const statusTimeoutRef = useRef(null);
  const responseTimeoutRef = useRef(null);
  const iframeLoadFallbackRef = useRef(null);
  const iframeRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const outgoingFormRef = useRef(null);

  useEffect(() => {
    const completeSubmission = (success) => {
      if (!pendingRequestRef.current) return;

      pendingRequestRef.current = null;
      clearTimeout(responseTimeoutRef.current);
      clearTimeout(iframeLoadFallbackRef.current);
      outgoingFormRef.current?.remove();
      outgoingFormRef.current = null;
      setIsSubmitting(false);
      setSubmitStatus(success ? 'success' : 'error');
      setSubmitDetail(success ? 'Thanks for getting in touch.' : 'Please try again in a moment.');
      if (success) setFormData({ name: '', subject: '', message: '' });

      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => setSubmitStatus(null), 5000);
    };

    const handleFeedbackResponse = (event) => {
      if (event.data?.type !== 'planetmusic-feedback-result') return;
      if (event.data.requestId !== pendingRequestRef.current) return;

      completeSubmission(event.data.success === true);
    };

    const handleIframeLoad = () => {
      const requestId = pendingRequestRef.current;
      if (!requestId) return;

      clearTimeout(iframeLoadFallbackRef.current);
      iframeLoadFallbackRef.current = setTimeout(() => {
        if (pendingRequestRef.current === requestId) completeSubmission(true);
      }, 750);
    };

    window.addEventListener('message', handleFeedbackResponse);
    iframeRef.current?.addEventListener('load', handleIframeLoad);
    return () => {
      window.removeEventListener('message', handleFeedbackResponse);
      iframeRef.current?.removeEventListener('load', handleIframeLoad);
      clearTimeout(statusTimeoutRef.current);
      clearTimeout(responseTimeoutRef.current);
      clearTimeout(iframeLoadFallbackRef.current);
      outgoingFormRef.current?.remove();
    };
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(statusTimeoutRef.current);
    clearTimeout(responseTimeoutRef.current);
    clearTimeout(iframeLoadFallbackRef.current);
    setSubmitStatus(null);
    setSubmitDetail('');

    const scriptUrl = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || DEFAULT_FEEDBACK_SCRIPT_URL;
    if (!scriptUrl) {
      setSubmitStatus('error');
      setSubmitDetail('The feedback service has not been configured yet.');
      statusTimeoutRef.current = setTimeout(() => setSubmitStatus(null), 5000);
      return;
    }

    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingRequestRef.current = requestId;
    setIsSubmitting(true);

    responseTimeoutRef.current = setTimeout(() => {
      if (pendingRequestRef.current !== requestId) return;
      pendingRequestRef.current = null;
      clearTimeout(iframeLoadFallbackRef.current);
      outgoingFormRef.current?.remove();
      outgoingFormRef.current = null;
      setIsSubmitting(false);
      setSubmitStatus('error');
      setSubmitDetail('We could not confirm delivery. Please try again.');
      statusTimeoutRef.current = setTimeout(() => setSubmitStatus(null), 5000);
    }, 30000);

    const outgoingForm = document.createElement('form');
    outgoingForm.method = 'POST';
    outgoingForm.action = scriptUrl;
    outgoingForm.target = FEEDBACK_FRAME_NAME;
    outgoingForm.style.display = 'none';

    const fields = {
      name: formData.name,
      subject: formData.subject,
      message: formData.message,
      requestId,
      website: ''
    };
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      outgoingForm.appendChild(input);
    });

    document.body.appendChild(outgoingForm);
    outgoingFormRef.current = outgoingForm;
    outgoingForm.submit();
  };

  return (
    <section className="view-section contact-tab-container">
      <div className="contact-layout-wrapper">
        
        {/* --- MAIN CONTENT AREA --- */}
        <div className="contact-main-content">
          
          <div className="contact-hero glass-panel">
            <h1 className="contact-hero-title">Get in Touch</h1>
            <p className="contact-hero-sub">
              Have a question, feedback, or a legal inquiry? We’re here to help.
            </p>
          </div>

          <div className="contact-card-body glass-panel">
            <form onSubmit={handleSubmit} className="contact-form">
              
              <div className="contact-form-group">
                <label>Name (Optional)</label>
                <input 
                  type="text" 
                  name="name" 
                  className="contact-input" 
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="What should we call you?" 
                />
              </div>

              <div className="contact-form-group">
                <label>Subject</label>
                <input 
                  type="text" 
                  name="subject" 
                  className="contact-input" 
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="What is this regarding?"
                  required
                />
              </div>

              <div className="contact-form-group">
                <label>Message</label>
                <textarea 
                  name="message" 
                  className="contact-textarea" 
                  required 
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Write your message here..."
                ></textarea>
              </div>

              <div className="contact-form-actions">
                <button 
                  type="submit" 
                  className="contact-submit-btn"
                  disabled={isSubmitting}
                  style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
                
                {submitStatus && (
                  <div
                    className={`contact-status-notice ${submitStatus}`}
                    role={submitStatus === 'error' ? 'alert' : 'status'}
                    aria-live={submitStatus === 'error' ? 'assertive' : 'polite'}
                  >
                    <span className="contact-status-icon" aria-hidden="true">
                      {submitStatus === 'success' ? (
                        <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>
                      )}
                    </span>
                    <span className="contact-status-copy">
                      <strong>{submitStatus === 'success' ? 'Message sent' : 'Message not sent'}</strong>
                      <span>{submitDetail}</span>
                    </span>
                    <span className="contact-status-timer" aria-hidden="true" />
                  </div>
                )}
              </div>
            </form>
            <iframe
              ref={iframeRef}
              name={FEEDBACK_FRAME_NAME}
              title="Feedback submission response"
              className="contact-submit-frame"
              tabIndex={-1}
              aria-hidden="true"
            />

            <div className="contact-info-blocks">
              <div className="info-block">
                <h4>Copyright & DMCA</h4>
                <p>For copyright inquiries, please review our Privacy & Legal stance first. PlanetMusic does not host user audio or lyrics centrally.</p>
              </div>
              <div className="info-block">
                <h4>Technical Support</h4>
                <p>If you lost your library, ensure your browser has not cleared your LocalStorage or IndexedDB data.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- DEDICATED SIDEBAR AREA --- */}
        <aside className="contact-sidebar">
          {adsEnabled && (
            <>
              <SponsorUnit 
                placement="contactSidebar"
                className="glass-panel dynamic-radius-override"
                style={{ minHeight: '600px' }}
                adTitle="Sponsor"
                adSub="Sidebar Advertisement Space"
              />
              <SponsorUnit 
                placement="contactStickySidebar"
                className="glass-panel dynamic-radius-override"
                style={{ minHeight: '300px' }}
                adTitle="Discover More"
                adSub="Sticky Sidebar Ad"
              />
            </>
          )}
        </aside>

      </div>

      {/* BOTTOM SPONSOR AD (Matches Settings Page Format) */}
      {adsEnabled && (
        <SponsorUnit 
          placement="contactBottom"
          className="glass-panel settings-promo-box dynamic-radius-override" 
          style={{ maxWidth: '1400px', margin: '0 auto' }}
          adTitle="Sponsor Message"
          adSub="Thank you for supporting PlanetMusic"
        />
      )}
    </section>
  );
};

export default ContactTab;
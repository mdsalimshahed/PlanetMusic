/* --- src/pages/ContactTab.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './ContactTab.css';
import SponsorUnit from '../components/Promos/SponsorUnit.jsx';

const ContactTab = ({ adsEnabled }) => {
  const [formData, setFormData] = useState({ name: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' or 'error'
  const statusTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(statusTimeoutRef.current), []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearTimeout(statusTimeoutRef.current);
    setSubmitStatus(null);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          name: formData.name || "Anonymous User",
          subject: formData.subject,
          message: formData.message,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setSubmitStatus('success');
        setFormData({ name: '', subject: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error("Submission failed:", error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
      statusTimeoutRef.current = setTimeout(() => setSubmitStatus(null), 5000);
    }
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
                      <span>{submitStatus === 'success' ? 'Thanks for getting in touch.' : 'Please try again in a moment.'}</span>
                    </span>
                    <span className="contact-status-timer" aria-hidden="true" />
                  </div>
                )}
              </div>
            </form>

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
                testMode={true} 
                className="glass-panel dynamic-radius-override"
                style={{ minHeight: '600px' }}
                adTitle="Sponsor"
                adSub="Sidebar Advertisement Space"
              />
              <SponsorUnit 
                testMode={true} 
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
          testMode={true} 
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
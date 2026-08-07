/* --- src/components/ContactTab.jsx --- */
import React, { useState } from 'react';
import './ContactTab.css';
import SponsorUnit from './Promos/SponsorUnit';

const ContactTab = ({ adsEnabled }) => {
  const [formData, setFormData] = useState({ name: '', subject: 'General Inquiry', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' or 'error'

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          // Get your free access key from https://web3forms.com/
          access_key: "YOUR_ACCESS_KEY_HERE", 
          name: formData.name || "Anonymous User",
          subject: formData.subject,
          message: formData.message,
        }),
      });
      const result = await response.json();
      
      if (result.success) {
        setSubmitStatus('success');
        setFormData({ name: '', subject: 'General Inquiry', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error("Submission failed:", error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
      
      // Clear the status message after 5 seconds
      if (submitStatus !== 'error') {
        setTimeout(() => setSubmitStatus(null), 5000);
      }
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
              Have a question, feedback, or a legal inquiry? We're here to help. 
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
                <select 
                  name="subject" 
                  className="contact-input" 
                  value={formData.subject}
                  onChange={handleChange}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Bug Report / Technical Issue">Bug Report / Technical Issue</option>
                  <option value="Feedback / Feature Request">Feedback / Feature Request</option>
                  <option value="DMCA / Copyright Notice">DMCA / Copyright Notice</option>
                </select>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
                <button 
                  type="submit" 
                  className="contact-submit-btn"
                  disabled={isSubmitting}
                  style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
                
                {submitStatus === 'success' && (
                  <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '14px', animation: 'fadeIn 0.3s ease' }}>
                    ✅ Message sent successfully!
                  </span>
                )}
                {submitStatus === 'error' && (
                  <span style={{ color: '#FA243C', fontWeight: 600, fontSize: '14px', animation: 'fadeIn 0.3s ease' }}>
                    ❌ Failed to send. Please try again.
                  </span>
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
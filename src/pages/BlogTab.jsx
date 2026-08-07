/* --- src/pages/BlogTab.jsx --- */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import './BlogTab.css';
import SponsorUnit from '../components/Promos/SponsorUnit';
import InFeedSponsor from '../components/Promos/InFeedSponsor';
import { renderMarkdown } from '../utils/markdownUtils';

// SVG Icon Helper Component
const Icon = ({ name, size = 18 }) => {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0 }
  };

  switch (name) {
    case 'plus':
      return (
        <svg {...props}>
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      );
    case 'download':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      );
    case 'download-single':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <polyline points="9 15 12 18 15 15"></polyline>
        </svg>
      );
    case 'close':
      return (
        <svg {...props}>
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      );
    case 'arrow-left':
      return (
        <svg {...props}>
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      );
    default:
      return null;
  }
};

const BlogTab = ({ adsEnabled }) => {
  const [posts, setPosts] = useState([]);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [activePost, setActivePost] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const bodyTextareaRef = useRef(null);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    category: 'Core Features',
    readTime: '4 min read',
    summary: '',
    tags: '',
    heroImage: '',
    content: ''
  });

  useEffect(() => {
    fetch('/blog_posts.json')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('No public blog_posts.json found');
      })
      .then((data) => {
        if (Array.isArray(data)) setPosts(data);
      })
      .catch(() => setPosts([]));
  }, []);

  const categories = useMemo(() => {
    const list = new Set(posts.map((p) => p.category));
    return ['All', ...Array.from(list)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchCat = selectedCategory === 'All' || post.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (post.title && post.title.toLowerCase().includes(q)) ||
        (post.summary && post.summary.toLowerCase().includes(q)) ||
        (post.tags && post.tags.some((t) => t.toLowerCase().includes(q)));
      return matchCat && matchSearch;
    });
  }, [posts, searchQuery, selectedCategory]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenStudio = (postToEdit = null) => {
    if (postToEdit) {
      setEditingPostId(postToEdit.id);
      setFormData({
        id: postToEdit.id,
        title: postToEdit.title || '',
        category: postToEdit.category || 'Core Features',
        readTime: postToEdit.readTime || '4 min read',
        summary: postToEdit.summary || '',
        tags: Array.isArray(postToEdit.tags) ? postToEdit.tags.join(', ') : postToEdit.tags || '',
        heroImage: postToEdit.heroImage || '',
        content: postToEdit.content || ''
      });
    } else {
      setEditingPostId(null);
      setFormData({
        id: '',
        title: '',
        category: 'Core Features',
        readTime: '4 min read',
        summary: '',
        tags: '',
        heroImage: '',
        content: ''
      });
    }
    setIsStudioOpen(true);
  };

  const handleDeletePost = (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Delete this article from local workspace?')) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (activePost && activePost.id === postId) setActivePost(null);
    }
  };

  const handleSaveArticle = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return alert('Title and Content required');

    const genId =
      formData.id.trim() ||
      formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const tagsArr = formData.tags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const articleObj = {
      ...formData,
      id: genId,
      date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      tags: tagsArr.length > 0 ? tagsArr : ['Guide']
    };

    if (editingPostId) {
      setPosts((prev) => prev.map((p) => (p.id === editingPostId ? articleObj : p)));
    } else {
      setPosts((prev) => [articleObj, ...prev.filter((p) => p.id !== genId)]);
    }

    setIsStudioOpen(false);
  };

  const handleExportCurrent = () => {
    if (!formData.title && !formData.content) return alert('Workspace is empty');

    const genId =
      formData.id.trim() ||
      formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const tagsArr = formData.tags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const payload = [
      {
        ...formData,
        id: genId || 'article-draft',
        date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        tags: tagsArr
      }
    ];

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${genId || 'article'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    if (posts.length === 0) return alert('No articles available');
    const blob = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'blog_posts.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const insertMarkdown = (prefix, suffix = '') => {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const txt = formData.content.substring(start, end) || 'text';
    const rep = `${prefix}${txt}${suffix}`;
    setFormData((prev) => ({
      ...prev,
      content: prev.content.substring(0, start) + rep + prev.content.substring(end)
    }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + txt.length);
    }, 50);
  };

  return (
    <section className="view-section blog-tab-container">
      <div className={`blog-layout-wrapper ${isStudioOpen ? 'studio-active' : ''}`}>
        <div className="blog-main-content">
          {isStudioOpen ? (
            <div className="blog-studio-card glass-panel">
              <div className="blog-studio-header">
                <h2>{editingPostId ? 'Edit Article Workspace' : 'New Article Workspace'}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="blog-icon-btn"
                    onClick={handleExportCurrent}
                    title="Export Current Article (JSON)"
                  >
                    <Icon name="download-single" />
                  </button>
                  <button
                    className="blog-icon-btn close"
                    onClick={() => setIsStudioOpen(false)}
                    title="Close Workspace"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>

              <div className="blog-studio-grid">
                {/* FORM COLUMN */}
                <form onSubmit={handleSaveArticle} className="blog-studio-form">
                  <div className="blog-form-row">
                    <div className="blog-form-group flex-2">
                      <label>Title</label>
                      <input
                        type="text"
                        name="title"
                        className="blog-input"
                        placeholder="e.g., Ultimate Guide to Syncing Lyrics"
                        value={formData.title}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className="blog-form-group flex-1">
                      <label>Category</label>
                      <select
                        name="category"
                        className="blog-select"
                        value={formData.category}
                        onChange={handleFormChange}
                      >
                        <option value="Core Features">Core Features</option>
                        <option value="Audio Engine">Audio Engine</option>
                        <option value="Lyrics & Syncing">Lyrics & Syncing</option>
                        <option value="Translation Engine">Translation Engine</option>
                        <option value="UI & Design">UI & Design</option>
                        <option value="Settings & Storage">Settings & Storage</option>
                      </select>
                    </div>
                  </div>

                  <div className="blog-form-row">
                    <div className="blog-form-group flex-1">
                      <label>Read Time</label>
                      <input
                        type="text"
                        name="readTime"
                        className="blog-input"
                        placeholder="e.g., 4 min read"
                        value={formData.readTime}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="blog-form-group flex-2">
                      <label>Hashtags (Comma Separated)</label>
                      <input
                        type="text"
                        name="tags"
                        className="blog-input"
                        placeholder="e.g., Syncing, Tutorial, Audio"
                        value={formData.tags}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>

                  <div className="blog-form-group">
                    <label>Hero Image URL</label>
                    <input
                      type="text"
                      name="heroImage"
                      className="blog-input"
                      placeholder="https://..."
                      value={formData.heroImage}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="blog-form-group">
                    <label>Summary</label>
                    <textarea
                      name="summary"
                      className="blog-textarea short"
                      placeholder="Brief overview of the article..."
                      value={formData.summary}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="blog-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label>Content (Markdown)</label>
                      <div className="md-toolbar">
                        <button type="button" onClick={() => insertMarkdown('**', '**')} title="Bold">B</button>
                        <button type="button" onClick={() => insertMarkdown('*', '*')} title="Italic">I</button>
                        <button type="button" onClick={() => insertMarkdown('## ')} title="Heading 2">H2</button>
                        <button type="button" onClick={() => insertMarkdown('### ')} title="Heading 3">H3</button>
                        <button type="button" onClick={() => insertMarkdown('- ')} title="Unordered List">List</button>
                        <button type="button" onClick={() => insertMarkdown('> ')} title="Quote">Quote</button>
                        <button type="button" onClick={() => insertMarkdown('`', '`')} title="Code">Code</button>
                      </div>
                    </div>
                    <textarea
                      ref={bodyTextareaRef}
                      name="content"
                      className="blog-textarea full"
                      placeholder="Write your full article body in Markdown..."
                      value={formData.content}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className="blog-studio-actions">
                    <button type="submit" className="blog-submit-btn">
                      {editingPostId ? 'Update Article' : 'Save Article'}
                    </button>
                  </div>
                </form>

                {/* PREVIEW COLUMN */}
                <div className="blog-markdown-preview-pane">
                  <span className="preview-pane-badge">Live Preview</span>
                  <div className="blog-article-body" style={{ marginTop: '16px' }}>
                    {formData.title && <h1 className="blog-article-title">{renderMarkdown(formData.title)}</h1>}
                    {formData.summary && <p className="blog-article-summary">{renderMarkdown(formData.summary)}</p>}
                    {formData.heroImage && <img src={formData.heroImage} alt="" className="blog-article-hero-img" />}
                    <hr className="blog-divider" />
                    {formData.content ? renderMarkdown(formData.content) : <p style={{ opacity: 0.5 }}>Your markdown preview will render here...</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : activePost ? (
            <div className="blog-reader-view glass-panel">
              <button className="blog-back-btn" onClick={() => setActivePost(null)}>
                <Icon name="arrow-left" size={16} /> Back to Articles
              </button>
              
              <header className="blog-article-header">
                <div className="blog-meta-badge-row">
                  <span className="blog-category-badge">{activePost.category}</span>
                  <span className="blog-meta-dot">•</span>
                  <span>{activePost.readTime}</span>
                  <span className="blog-meta-dot">•</span>
                  <span>{activePost.date}</span>
                </div>
                <h1 className="blog-article-title">{renderMarkdown(activePost.title)}</h1>
                <p className="blog-article-summary">{renderMarkdown(activePost.summary)}</p>
                {activePost.heroImage && <img src={activePost.heroImage} alt="" className="blog-article-hero-img" />}
              </header>

              {activePost.tags && activePost.tags.length > 0 && (
                <div className="blog-tags-row">
                  {activePost.tags.map((t, idx) => (
                    <span key={idx} className="blog-tag">#{t}</span>
                  ))}
                </div>
              )}

              <hr className="blog-divider" />
              <main className="blog-article-body">{renderMarkdown(activePost.content)}</main>

              <button className="blog-back-btn bottom-back" onClick={() => setActivePost(null)}>
                <Icon name="arrow-left" size={16} /> Back to Articles
              </button>

              {/* Bottom Large Sponsor Banner */}
              {adsEnabled && (
                <div className="blog-bottom-sponsor-wrapper" style={{ marginTop: '40px' }}>
                  <SponsorUnit
                    testMode={true}
                    className="glass-panel dynamic-radius-override blog-bottom-sponsor"
                    style={{ minHeight: '280px' }}
                    adTitle="Sponsored Feature"
                    adSub="Check out our featured partner"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="blog-grid-view">
              <div className="blog-hero glass-panel">
                <div className="blog-hero-top">
                  <div>
                    <h1 className="blog-hero-title">Documentation & Articles</h1>
                    <p className="blog-hero-sub">Explore guides, feature breakdowns, and engine technical notes.</p>
                  </div>
                  <div className="blog-hero-actions">
                    <button
                      className="blog-icon-btn action"
                      onClick={() => handleOpenStudio()}
                      title="Write New Article"
                    >
                      <Icon name="plus" />
                    </button>
                    {posts.length > 0 && (
                      <button
                        className="blog-icon-btn"
                        onClick={handleExportAll}
                        title="Export All Articles (JSON)"
                      >
                        <Icon name="download" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="blog-controls-row">
                  <div className="blog-search-box">
                    <Icon name="search" size={16} />
                    <input
                      type="text"
                      placeholder="Search articles, tags, or topics..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button className="blog-clear-search" onClick={() => setSearchQuery('')}>
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="blog-categories-pills">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredPosts.length > 0 ? (
                <div className="blog-cards-grid">
                  {filteredPosts.map((post, idx) => {
                    const showAdAfter = (idx + 1) % 4 === 0;
                    return (
                      <React.Fragment key={post.id}>
                        <div className="blog-card-wrapper">
                          <div className="blog-card" onClick={() => setActivePost(post)}>
                            {post.heroImage && <img src={post.heroImage} alt="" className="blog-card-thumb" />}
                            <div className="blog-card-top">
                              <span className="blog-category-badge">{post.category}</span>
                              <span className="blog-read-time">{post.readTime}</span>
                            </div>
                            <h3 className="blog-card-title">{post.title}</h3>
                            <p className="blog-card-summary">{post.summary}</p>
                            <div className="blog-card-bottom">
                              <div className="blog-card-tags">
                                {Array.isArray(post.tags) && post.tags.slice(0, 2).map((t, i) => (
                                  <span key={i} className="blog-mini-tag">#{t}</span>
                                ))}
                              </div>
                              <span className="blog-read-more">Read Article →</span>
                            </div>
                          </div>
                          <div className="blog-card-admin-controls">
                            <button className="blog-admin-btn edit" onClick={() => handleOpenStudio(post)}>
                              Edit
                            </button>
                            <button className="blog-admin-btn delete" onClick={(e) => handleDeletePost(e, post.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                        {adsEnabled && showAdAfter && (
                          <InFeedSponsor adClass="in-feed-blog-ad" testMode={true} wrapperClass="blog-card dynamic-radius-override" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <div className="blog-empty-box glass-panel">
                  <h3>No articles found</h3>
                  <p style={{ color: 'var(--text-subdued)', marginBottom: '20px' }}>Try searching for a different term or write a new post.</p>
                  <button className="blog-icon-btn action" style={{ margin: '0 auto' }} onClick={() => handleOpenStudio()} title="Write New Article">
                    <Icon name="plus" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Sponsor Column: Shifts below workspace when active */}
        <aside className={`blog-sidebar ${isStudioOpen ? 'studio-bottom' : ''}`}>
          {adsEnabled && (
            <>
              <SponsorUnit
                testMode={true}
                className="glass-panel dynamic-radius-override blog-sidebar-sponsor-large"
                style={{ minHeight: isStudioOpen ? '200px' : '600px', height: isStudioOpen ? '200px' : '600px' }}
                adTitle="Sponsor"
                adSub="Sidebar Advertisement Space"
              />
              <SponsorUnit
                testMode={true}
                className="glass-panel dynamic-radius-override blog-sidebar-sponsor-small"
                style={{ minHeight: isStudioOpen ? '200px' : '300px', height: isStudioOpen ? '200px' : '300px' }}
                adTitle="Discover More"
                adSub="Sticky Sidebar Ad"
              />
            </>
          )}
        </aside>
      </div>
    </section>
  );
};

export default BlogTab;
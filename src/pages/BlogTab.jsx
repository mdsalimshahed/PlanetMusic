/* --- src/pages/BlogTab.jsx --- */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    case 'upload':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
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
  const navigate = useNavigate();
  const params = useParams();

  // ROUTING ENGINE DECODING: Parse sub-views directly from URL path (/blog/dev, /blog/custom, /blog/post/:id, etc.)
  const subPath = params['*'] || '';
  const pathTokens = subPath.split('/').filter(Boolean);

  const viewMode = pathTokens[0] === 'post' ? 'reader' :
                   pathTokens[0] === 'write' ? 'studio' :
                   pathTokens[0] === 'edit' ? 'studio' : 'grid';

  const blogSection = pathTokens[0] === 'custom' ? 'custom' : 'dev';
  const activeArticleId = (pathTokens[0] === 'post' || pathTokens[0] === 'edit') ? pathTokens[1] : null;

  // 1. DUAL BLOG ARCHITECTURE STATE
  const [devPosts, setDevPosts] = useState([]);
  const [customPosts, setCustomPosts] = useState(() => {
    const saved = localStorage.getItem('custom_blog_posts_storage');
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const bodyTextareaRef = useRef(null);
  const importFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    category: 'Guides',
    readTime: '4 min read',
    summary: '',
    tags: '',
    heroImage: '',
    content: ''
  });

  // Always load Developer Blogs from public/blog_posts.json automatically
  useEffect(() => {
    fetch('/blog_posts.json')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('No public blog_posts.json found');
      })
      .then((data) => {
        if (Array.isArray(data)) setDevPosts(data);
      })
      .catch(() => setDevPosts([]));
  }, []);

  // Sync Custom Posts to LocalStorage whenever modified
  useEffect(() => {
    localStorage.setItem('custom_blog_posts_storage', JSON.stringify(customPosts));
  }, [customPosts]);

  // Populate Creator Studio Form when editing via route (/blog/edit/:id)
  useEffect(() => {
    if (viewMode === 'studio' && activeArticleId) {
      const postToEdit = customPosts.find((p) => p.id === activeArticleId);
      if (postToEdit) {
        setFormData({
          id: postToEdit.id,
          title: postToEdit.title || '',
          category: postToEdit.category || 'Guides',
          readTime: postToEdit.readTime || '4 min read',
          summary: postToEdit.summary || '',
          tags: Array.isArray(postToEdit.tags) ? postToEdit.tags.join(', ') : postToEdit.tags || '',
          heroImage: postToEdit.heroImage || '',
          content: postToEdit.content || ''
        });
      }
    } else if (viewMode === 'studio' && !activeArticleId) {
      setFormData({
        id: '',
        title: '',
        category: 'Guides',
        readTime: '4 min read',
        summary: '',
        tags: '',
        heroImage: '',
        content: ''
      });
    }
  }, [viewMode, activeArticleId, customPosts]);

  // Determine active posts feed based on selected main section
  const currentFeed = blogSection === 'dev' ? devPosts : customPosts;

  // Active post object for reader view (/blog/post/:id)
  const activePost = useMemo(() => {
    if (viewMode !== 'reader' || !activeArticleId) return null;
    return [...devPosts, ...customPosts].find((p) => p.id === activeArticleId) || null;
  }, [viewMode, activeArticleId, devPosts, customPosts]);

  const categories = useMemo(() => {
    const list = new Set(currentFeed.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [currentFeed]);

  // Collect all existing category suggestions for the datalist auto-complete
  const allCategorySuggestions = useMemo(() => {
    const list = new Set([...devPosts, ...customPosts].map((p) => p.category).filter(Boolean));
    const defaults = ['Guides', 'Music Notes', 'Personal', 'Reviews', 'Tech & Audio', 'Lyrics & Syncing', 'Translation Engine', 'Core Features'];
    defaults.forEach((d) => list.add(d));
    return Array.from(list);
  }, [devPosts, customPosts]);

  const filteredPosts = useMemo(() => {
    return currentFeed.filter((post) => {
      const matchCat = selectedCategory === 'All' || post.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (post.title && post.title.toLowerCase().includes(q)) ||
        (post.summary && post.summary.toLowerCase().includes(q)) ||
        (post.tags && post.tags.some((t) => t.toLowerCase().includes(q)));
      return matchCat && matchSearch;
    });
  }, [currentFeed, searchQuery, selectedCategory]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenStudio = (postToEdit = null) => {
    if (postToEdit) {
      navigate(`/blog/edit/${postToEdit.id}`);
    } else {
      navigate('/blog/write');
    }
  };

  const handleCloseStudio = () => {
    navigate(blogSection === 'custom' ? '/blog/custom' : '/blog/dev');
  };

  const handleDeletePost = (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Delete this article from your Custom Vault?')) {
      const updated = customPosts.filter((p) => p.id !== postId);
      setCustomPosts(updated);
      if (activeArticleId === postId) {
        navigate('/blog/custom');
      }
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
      category: formData.category.trim() || 'General',
      isCustom: true,
      date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      tags: tagsArr.length > 0 ? tagsArr : ['Personal']
    };

    if (activeArticleId) {
      setCustomPosts((prev) => prev.map((p) => (p.id === activeArticleId ? articleObj : p)));
    } else {
      setCustomPosts((prev) => [articleObj, ...prev.filter((p) => p.id !== genId)]);
    }

    // Automatically navigate to Custom section on save
    navigate('/blog/custom');
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
        category: formData.category.trim() || 'General',
        isCustom: true,
        date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        tags: tagsArr
      }
    ];

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${genId || 'custom_article'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCustomAll = () => {
    if (customPosts.length === 0) return alert('No custom articles available to export');
    const blob = new Blob([JSON.stringify(customPosts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Custom_Blogs_Backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportCustom = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          const formattedImport = imported.map((p) => ({ ...p, isCustom: true }));
          setCustomPosts((prev) => {
            const merged = [...prev];
            formattedImport.forEach((item) => {
              const idx = merged.findIndex((m) => m.id === item.id);
              if (idx >= 0) merged[idx] = item;
              else merged.push(item);
            });
            return merged;
          });
          navigate('/blog/custom');
          alert(`Successfully imported ${formattedImport.length} custom articles!`);
        } else {
          alert('Invalid blog JSON format.');
        }
      } catch (err) {
        alert('Failed to parse blog JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
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
      <div className={`blog-layout-wrapper ${viewMode === 'studio' ? 'studio-active' : ''}`}>
        <div className="blog-main-content">
          {viewMode === 'studio' ? (
            <div className="blog-studio-card glass-panel">
              <div className="blog-studio-header">
                <h2>{activeArticleId ? 'Edit Custom Article' : 'New Custom Article Workspace'}</h2>
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
                    onClick={handleCloseStudio}
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
                        placeholder="e.g., How to Sync Songs with Music"
                        value={formData.title}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    
                    {/* EDITABLE CATEGORY FIELD WITH AUTO-COMPLETE DATALIST */}
                    <div className="blog-form-group flex-1">
                      <label>Category</label>
                      <input
                        type="text"
                        name="category"
                        className="blog-input"
                        list="category-suggestions"
                        placeholder="e.g., Lyrics & Syncing"
                        value={formData.category}
                        onChange={handleFormChange}
                        required
                      />
                      <datalist id="category-suggestions">
                        {allCategorySuggestions.map((cat) => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
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
                        placeholder="e.g., Syncing, Timings, Adlibs"
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
                      placeholder="Brief overview of your custom post..."
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
                        <button type="button" onClick={() => insertMarkdown('\n---\n')} title="Horizontal Divider">---</button>
                      </div>
                    </div>
                    <textarea
                      ref={bodyTextareaRef}
                      name="content"
                      className="blog-textarea full"
                      placeholder="Write your custom article in Markdown..."
                      value={formData.content}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className="blog-studio-actions">
                    <button type="submit" className="blog-submit-btn">
                      {activeArticleId ? 'Update Article' : 'Save Custom Article'}
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
          ) : viewMode === 'reader' && activePost ? (
            <div className="blog-reader-view glass-panel">
              <button 
                className="blog-back-btn" 
                onClick={() => navigate(activePost.isCustom ? '/blog/custom' : '/blog/dev')}
              >
                <Icon name="arrow-left" size={16} /> Back to Articles
              </button>
              
              <header className="blog-article-header">
                <div className="blog-meta-badge-row">
                  <span className="blog-category-badge">{activePost.category}</span>
                  <span className="blog-meta-dot"> </span>
                  <span>{activePost.readTime}</span>
                  <span className="blog-meta-dot"> </span>
                  <span>{activePost.date}</span>
                  {activePost.isCustom && (
                    <>
                      <span className="blog-meta-dot"> </span>
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>[Custom]</span>
                    </>
                  )}
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

              <button 
                className="blog-back-btn bottom-back" 
                onClick={() => navigate(activePost.isCustom ? '/blog/custom' : '/blog/dev')}
              >
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
                    <h1 className="blog-hero-title">Documentation & Blogs</h1>
                    <p className="blog-hero-sub">Explore official system guides or create your own personal articles.</p>
                  </div>
                  <div className="blog-hero-actions">
                    <button
                      className="blog-icon-btn action"
                      onClick={() => handleOpenStudio()}
                      title="Create Custom Article"
                    >
                      <Icon name="plus" />
                    </button>
                    {blogSection === 'custom' && customPosts.length > 0 && (
                      <button
                        className="blog-icon-btn"
                        onClick={handleExportCustomAll}
                        title="Export All Custom Articles (JSON)"
                      >
                        <Icon name="download" />
                      </button>
                    )}
                    <input
                      type="file"
                      accept=".json,application/json"
                      ref={importFileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleImportCustom}
                    />
                    <button
                      className="blog-icon-btn"
                      onClick={() => importFileInputRef.current?.click()}
                      title="Import Custom Articles (JSON)"
                    >
                      <Icon name="upload" />
                    </button>
                  </div>
                </div>

                {/* DUAL SECTION TOGGLE PILLS WITH URL ROUTING */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px', marginBottom: '8px' }}>
                  <button
                    className={`category-pill ${blogSection === 'dev' ? 'active' : ''}`}
                    style={{ fontSize: '14px', padding: '10px 24px' }}
                    onClick={() => {
                      setSelectedCategory('All');
                      navigate('/blog/dev');
                    }}
                  >
                    Developer Blogs ({devPosts.length})
                  </button>
                  <button
                    className={`category-pill ${blogSection === 'custom' ? 'active' : ''}`}
                    style={{ fontSize: '14px', padding: '10px 24px' }}
                    onClick={() => {
                      setSelectedCategory('All');
                      navigate('/blog/custom');
                    }}
                  >
                    Custom Blogs ({customPosts.length})
                  </button>
                </div>

                <div className="blog-controls-row">
                  <div className="blog-search-box">
                    <Icon name="search" size={16} />
                    <input
                      type="text"
                      placeholder={`Search ${blogSection === 'dev' ? 'developer' : 'custom'} articles, tags, or topics...`}
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
                          <div 
                            className="blog-card" 
                            onClick={() => navigate(`/blog/post/${post.id}`)}
                          >
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
                              <span className="blog-read-more">Read Article</span>
                            </div>
                          </div>
                          {/* Admin Controls are shown ONLY for Custom Blogs */}
                          {blogSection === 'custom' && (
                            <div className="blog-card-admin-controls">
                              <button className="blog-admin-btn edit" onClick={() => handleOpenStudio(post)}>
                                Edit
                              </button>
                              <button className="blog-admin-btn delete" onClick={(e) => handleDeletePost(e, post.id)}>
                                Delete
                              </button>
                            </div>
                          )}
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
                  <h3>No {blogSection === 'dev' ? 'developer' : 'custom'} articles found</h3>
                  <p style={{ color: 'var(--text-subdued)', marginBottom: '20px' }}>
                    {blogSection === 'custom' 
                      ? 'You haven\'t created any custom articles yet. Click the + button above to write one!' 
                      : 'Try searching for a different term.'}
                  </p>
                  {blogSection === 'custom' && (
                    <button className="blog-icon-btn action" style={{ margin: '0 auto' }} onClick={() => handleOpenStudio()} title="Write New Article">
                      <Icon name="plus" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Sponsor Column: Shifts below workspace when active */}
        <aside className={`blog-sidebar ${viewMode === 'studio' ? 'studio-bottom' : ''}`}>
          {adsEnabled && (
            <>
              <SponsorUnit
                testMode={true}
                className="glass-panel dynamic-radius-override blog-sidebar-sponsor-large"
                style={{ minHeight: viewMode === 'studio' ? '200px' : '600px', height: viewMode === 'studio' ? '200px' : '600px' }}
                adTitle="Sponsor"
                adSub="Sidebar Advertisement Space"
              />
              <SponsorUnit
                testMode={true}
                className="glass-panel dynamic-radius-override blog-sidebar-sponsor-small"
                style={{ minHeight: viewMode === 'studio' ? '200px' : '300px', height: viewMode === 'studio' ? '200px' : '300px' }}
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
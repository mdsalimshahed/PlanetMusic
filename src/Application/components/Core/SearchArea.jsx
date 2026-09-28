import { memo, useEffect, useRef, useState } from 'react';

const SearchArea = ({ searchQuery, onCommit, onSearchSubmit, isSearching }) => {
  const [inputValue, setInputValue] = useState(searchQuery);
  const debounceTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(debounceTimerRef.current), []);

  const handleChange = (event) => {
    const value = event.target.value;
    setInputValue(value);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => onCommit(value), 200);
  };

  const handleSubmit = (event) => {
    clearTimeout(debounceTimerRef.current);
    onSearchSubmit(event, inputValue);
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-box">
        <input
          type="text"
          placeholder="Search vault (press Enter for full cosmos search)..."
          value={inputValue}
          onChange={handleChange}
        />
        <button type="submit" className="search-submit-btn" title="Search Cosmos">
          {isSearching ? (
            <span className="search-spinner"></span>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default memo(SearchArea);
import { useState } from "react";
import "./SectionGrid.css";

function SectionGrid({ sections, storyTitle, onSectionSelect, onBack }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!sections || sections.length === 0) {
    return (
      <div className="section-grid-container">
        <div className="section-grid-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Stories
          </button>
          <h1 className="section-grid-title">{storyTitle}</h1>
        </div>
        <div className="section-grid-empty">No sections available</div>
      </div>
    );
  }

  return (
    <div className="section-grid-container">
      <div className="section-grid-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Stories
        </button>
        <h1 className="section-grid-title">{storyTitle}</h1>
      </div>

      <div className="section-grid">
        {sections.map((section, index) => (
          <div
            key={index}
            className={`section-card ${hoveredIndex === index ? "hovered" : ""}`}
            onClick={() => onSectionSelect(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="section-card-image-wrapper">
              {section.imageUrl && (
                <img
                  src={section.imageUrl}
                  alt={`Section ${index + 1}`}
                  className="section-card-image"
                  loading="lazy"
                />
              )}
              {section.reference && (
                <div className="section-card-overlay">
                  <div className="section-reference-overlay">
                    {section.reference}
                  </div>
                </div>
              )}
            </div>

            <div className="section-card-content">
              {section.text && section.text.trim() && (
                <div className="section-preview">
                  {section.text.substring(0, 100)}
                  {section.text.length > 100 ? "..." : ""}
                </div>
              )}
              {(!section.text || !section.text.trim()) && section.reference && (
                <div className="section-preview section-preview-ref">
                  Bible Reference: {section.reference}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SectionGrid;

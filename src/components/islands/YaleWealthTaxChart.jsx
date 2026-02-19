import { useState, useRef, useEffect } from 'react';

/**
 * Interactive chart showing tax vs gains over a year.
 * Hovering over segments shows cumulative wealth accumulation.
 */
export default function YaleWealthTaxChart() {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Data configuration
  // Total Annual Return: ~$3.9B
  // Tax: $300M (first 30 days)
  // Gains: $3.6B (remaining 335 days)
  // Segments: 1 tax segment (30 days), 11 gains segments (~30.45 days each)
  
  const taxValue = 300000000; // $300M
  const totalGains = 3600000000; // $3.6B
  const gainsSegmentsCount = 11;
  const gainPerSegment = totalGains / gainsSegmentsCount;

  // Create segments data
  const segments = [
    { 
      type: 'tax', 
      value: taxValue, 
      label: 'Tax Paid',
      days: 30,
      flex: 30 
    },
    ...Array.from({ length: gainsSegmentsCount }).map((_, i) => ({
      type: 'gains',
      value: gainPerSegment,
      label: 'Untaxed Gains',
      days: 335 / gainsSegmentsCount,
      flex: 335 / gainsSegmentsCount
    }))
  ];

  // Calculate cumulative values for tooltip
  const segmentsWithCumulative = segments.map((seg, i) => {
    const cumulative = segments
      .slice(0, i + 1)
      .reduce((sum, s) => sum + s.value, 0);
    return { ...seg, cumulative, index: i };
  });

  const handleMouseEnter = (index, e) => {
    setHoveredIndex(index);
    updateTooltipPosition(e);
  };

  const handleMouseMove = (e) => {
    if (hoveredIndex !== null) {
      updateTooltipPosition(e);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const updateTooltipPosition = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Position relative to the container
    const x = e.clientX - rect.left;
    // Position above the bar
    const y = -10; 
    setTooltipPos({ x, y });
  };

  // Format currency: $3.9B or $300M
  const formatCurrency = (value) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(1)}B`;
    }
    return `$${(value / 1000000).toFixed(0)}M`;
  };

  return (
    <div 
      className="yale-wealth-reality__timeline" 
      role="img" 
      aria-label="Interactive chart: 30 days tax $300 million, 335 days gains $3.6 billion"
      ref={containerRef}
      onMouseLeave={handleMouseLeave}
    >
      <p className="yale-wealth-reality__timeline-caption" aria-hidden="true">One year</p>
      
      <div className="yale-wealth-reality__days" style={{ position: 'relative' }}>
        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div 
            className="yale-wealth-chart-tooltip"
            style={{ 
              position: 'absolute',
              left: tooltipPos.x,
              top: '-45px',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 20,
              backgroundColor: 'var(--yw-dark-bg, rgba(30, 41, 59, 0.95))',
              color: '#fff',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.65rem', opacity: 0.8, textTransform: 'uppercase', marginBottom: '0.1rem' }}>
              {hoveredIndex === 0 ? 'Month 1 (Taxed)' : `Month ${hoveredIndex + 1}`}
            </div>
            <div style={{ fontFamily: 'var(--aw-font-mono)', fontSize: '0.9rem' }}>
              {formatCurrency(segmentsWithCumulative[hoveredIndex].cumulative)}
            </div>
          </div>
        )}

        <div className="yale-wealth-reality__days-row" onMouseMove={handleMouseMove}>
          {segmentsWithCumulative.map((segment, i) => (
            <span
              key={i}
              className={`yale-wealth-reality__day yale-wealth-reality__day--${segment.type}`}
              style={{ 
                '--day-i': i, 
                flex: `${segment.flex} 1 0`,
                position: 'relative' // For z-index stacking context
              }}
              onMouseEnter={(e) => handleMouseEnter(i, e)}
              aria-label={`${segment.label}: ${formatCurrency(segment.value)}`}
            />
          ))}
        </div>
        <span className="yale-wealth-reality__days-label yale-wealth-reality__days-label--tax">$300M</span>
        <span className="yale-wealth-reality__days-label yale-wealth-reality__days-label--gains">$3,600,000,000</span>
      </div>
      
      <p className="yale-wealth-reality__days-legend">
        <span className="yale-wealth-reality__days-legend-tax">30 days = tax</span>
        <span className="yale-wealth-reality__days-legend-gains">335 days = gains</span>
      </p>
    </div>
  );
}

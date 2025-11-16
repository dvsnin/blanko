import { useState, useEffect, useRef } from 'react';

/**
 * Hook to calculate how many items can fit in a container
 * @param {number} itemWidth - Width of each item in pixels
 * @param {number} gap - Gap between items in pixels
 * @param {number} minItems - Minimum number of items to show
 * @returns {Object} - { containerRef, fitCount }
 */
export function useFitCount(itemWidth = 200, gap = 16, minItems = 1) {
  const containerRef = useRef(null);
  const [fitCount, setFitCount] = useState(minItems);

  useEffect(() => {
    const calculateFit = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Calculate how many items can fit: (width + gap) until last item
        const count = Math.floor((containerWidth + gap) / (itemWidth + gap));
        setFitCount(Math.max(count, minItems));
      }
    };

    calculateFit();
    window.addEventListener('resize', calculateFit);

    return () => {
      window.removeEventListener('resize', calculateFit);
    };
  }, [itemWidth, gap, minItems]);

  return { containerRef, fitCount };
}

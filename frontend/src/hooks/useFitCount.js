import { useState, useEffect, useRef } from 'react'

/**
 * Hook to calculate how many items fit in a container
 * @param {number} itemWidth - Width of each item
 * @param {number} gap - Gap between items
 * @param {number} minItems - Minimum number of items to display
 * @returns {Object} - { containerRef, fitCount }
 */
export function useFitCount(itemWidth = 200, gap = 16, minItems = 1) {
  const containerRef = useRef(null)
  const [fitCount, setFitCount] = useState(minItems)

  useEffect(() => {
    const calculateFit = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const availableWidth = containerWidth + gap
        const count = Math.floor(availableWidth / (itemWidth + gap))
        setFitCount(Math.max(count, minItems))
      }
    }

    calculateFit()

    const resizeObserver = new ResizeObserver(calculateFit)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [itemWidth, gap, minItems])

  return { containerRef, fitCount }
}

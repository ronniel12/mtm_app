import { ref } from 'vue'

/**
 * Global Event-Driven Data Refresh System
 *
 * Provides centralized refresh triggers and event listeners for all CRUD operations.
 * All CRUD mutations (Create, Update, Delete) trigger a refresh event that
 * components can listen to for instant UI updates.
 */

const eventBus = new Map() // Store cleanup functions

export function useDataRefresh() {

  /**
   * Trigger global refresh event for a specific data type
   * @param {string} dataType - The data type being refreshed (e.g., 'trips', 'employees', 'billings')
   * @param {object} data - Optional additional data to pass to listeners
   */
  const triggerRefresh = (dataType, data = {}) => {
    const eventData = {
      dataType,
      timestamp: Date.now(),
      ...data
    }


    // Dispatch to all listening components
    window.dispatchEvent(new CustomEvent(`refresh-${dataType}`, {
      detail: eventData
    }))
  }

  /**
   * Listen for refresh events for a specific data type
   * @param {string} dataType - The data type to listen for
   * @param {function} callback - Function to call when refresh event occurs
   * @returns {function} Cleanup function to remove the listener
   */
  const onRefresh = (dataType, callback) => {
    const eventHandler = (event) => {
      callback(event.detail)
    }

    // Store cleanup function for this listener
    const cleanup = () => {
      window.removeEventListener(`refresh-${dataType}`, eventHandler)
    }

    // Add listener
    window.addEventListener(`refresh-${dataType}`, eventHandler)
    eventBus.set(`${dataType}-${Date.now()}`, cleanup)


    return cleanup
  }

  /**
   * Trigger refresh for multiple data types (bulk refresh)
   * @param {string[]} dataTypes - Array of data types to refresh
   * @param {object} data - Additional data to pass
   */
  const triggerBulkRefresh = (dataTypes = [], data = {}) => {
    dataTypes.forEach(dataType => triggerRefresh(dataType, data))
  }

  /**
   * Clean up all listeners (call on component unmount if needed)
   */
  const cleanupAll = () => {
    eventBus.forEach(cleanup => cleanup())
    eventBus.clear()
  }

  return {
    triggerRefresh,
    triggerBulkRefresh,
    onRefresh,
    cleanupAll
  }
}

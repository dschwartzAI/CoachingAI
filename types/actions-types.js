/**
 * Standard return type for all server actions
 */
export const ActionState = {
  /**
   * Successful action
   * @param {string} message - Message describing the result
   * @param {any} data - Any data returned by the action
   */
  success(message, data) {
    return {
      isSuccess: true,
      message,
      data
    }
  },
  
  /**
   * Failed action
   * @param {string} message - Error message
   */
  error(message) {
    return {
      isSuccess: false,
      message
    }
  }
}

// Type definitions
/**
 * @typedef {Object} ActionStateSuccess
 * @property {boolean} isSuccess - Always true for success
 * @property {string} message - Success message
 * @property {any} data - Data returned by the action
 */

/**
 * @typedef {Object} ActionStateError
 * @property {boolean} isSuccess - Always false for errors
 * @property {string} message - Error message
 */

/**
 * @typedef {ActionStateSuccess|ActionStateError} ActionState
 */ 
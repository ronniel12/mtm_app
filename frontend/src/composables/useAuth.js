import { ref, computed } from 'vue'

// Reactive authentication state
const authState = ref({
  isAuthenticated: false,
  employee: null,
  pin: null,
  loginTime: null,
  expiresAt: null
})

// Session storage key
const AUTH_STORAGE_KEY = 'employee_auth'
const REMEMBER_PIN_KEY = 'employee_remembered_pin'

/**
 * Authentication composable for employee login/logout functionality
 */
export function useAuth() {
  /**
   * Check if user is currently authenticated
   */
  const isAuthenticated = computed(() => {
    return authState.value.isAuthenticated && 
           authState.value.pin && 
           authState.value.employee &&
           !isSessionExpired()
  })

  /**
   * Get current employee data
   */
  const getCurrentEmployee = computed(() => {
    return authState.value.employee
  })

  /**
   * Get current PIN
   */
  const getCurrentPin = computed(() => {
    return authState.value.pin
  })

  /**
   * Check if session is expired
   */
  function isSessionExpired() {
    if (!authState.value.expiresAt) return true
    
    const now = new Date()
    const expiresAt = new Date(authState.value.expiresAt)
    
    return now >= expiresAt
  }

  /**
   * Load authentication state from storage
   */
  function loadAuthState() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!stored) {
        clearAuthState()
        return false
      }

      const authData = JSON.parse(stored)
      
      // Check if session is expired
      if (isSessionExpired()) {
        clearAuthState()
        return false
      }

      // Restore auth state
      authState.value = {
        isAuthenticated: true,
        employee: authData.employee,
        pin: authData.pin,
        loginTime: authData.loginTime,
        expiresAt: authData.expiresAt
      }

      return true
    } catch (error) {
      console.error('Error loading auth state:', error)
      clearAuthState()
      return false
    }
  }

  /**
   * Save authentication state to storage
   */
  function saveAuthState(authData) {
    try {
      authState.value = {
        isAuthenticated: true,
        employee: authData.employee,
        pin: authData.pin,
        loginTime: authData.loginTime || new Date().toISOString(),
        expiresAt: authData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState.value))
      return true
    } catch (error) {
      console.error('Error saving auth state:', error)
      return false
    }
  }

  /**
   * Clear authentication state
   */
  function clearAuthState() {
    authState.value = {
      isAuthenticated: false,
      employee: null,
      pin: null,
      loginTime: null,
      expiresAt: null
    }
    
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  /**
   * Clear remembered PIN
   */
  function clearRememberedPin() {
    localStorage.removeItem(REMEMBER_PIN_KEY)
  }

  /**
   * Set remembered PIN
   */
  function setRememberedPin(pin) {
    try {
      localStorage.setItem(REMEMBER_PIN_KEY, pin)
      return true
    } catch (error) {
      console.error('Error saving remembered PIN:', error)
      return false
    }
  }

  /**
   * Get remembered PIN
   */
  function getRememberedPin() {
    try {
      return localStorage.getItem(REMEMBER_PIN_KEY)
    } catch (error) {
      console.error('Error retrieving remembered PIN:', error)
      return null
    }
  }

  /**
   * Login function - authenticates employee with PIN
   */
  async function login(pin, employeeData) {
    try {
      // Validate input
      if (!pin || !/^\d{4}$/.test(pin)) {
        throw new Error('Invalid PIN format')
      }

      if (!employeeData || !employeeData.name) {
        throw new Error('Invalid employee data')
      }

      // Create auth data
      const authData = {
        pin: pin,
        employee: employeeData,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }

      // Save auth state
      const saved = saveAuthState(authData)
      if (!saved) {
        throw new Error('Failed to save authentication data')
      }

      return {
        success: true,
        employee: employeeData,
        expiresAt: authData.expiresAt
      }

    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.message || 'Login failed'
      }
    }
  }

  /**
   * Logout function - clears authentication state
   */
  function logout() {
    clearAuthState()
    
    return {
      success: true,
      message: 'Logged out successfully'
    }
  }

  /**
   * Check if user has access to specific route
   */
  function hasRouteAccess(routeName) {
    switch (routeName) {
      case 'EmployeePortal':
      case 'employee':
        return isAuthenticated.value
      
      default:
        return true // Allow access to all other routes
    }
  }

  /**
   * Get session duration info
   */
  function getSessionInfo() {
    if (!authState.value.loginTime || !authState.value.expiresAt) {
      return null
    }

    const now = new Date()
    const loginTime = new Date(authState.value.loginTime)
    const expiresAt = new Date(authState.value.expiresAt)
    
    const totalDuration = expiresAt - loginTime
    const remainingTime = expiresAt - now
    const elapsedTime = now - loginTime
    
    return {
      totalDuration: totalDuration,
      remainingTime: remainingTime,
      elapsedTime: elapsedTime,
      remainingMinutes: Math.max(0, Math.floor(remainingTime / (1000 * 60))),
      elapsedMinutes: Math.floor(elapsedTime / (1000 * 60)),
      isExpired: isSessionExpired()
    }
  }

  /**
   * Extend session (refresh expiration time)
   */
  function extendSession(additionalHours = 24) {
    if (!authState.value.isAuthenticated) {
      return false
    }

    const newExpiresAt = new Date(Date.now() + (additionalHours * 60 * 60 * 1000))
    
    const updatedAuthData = {
      ...authState.value,
      expiresAt: newExpiresAt.toISOString()
    }

    return saveAuthState(updatedAuthData)
  }

  /**
   * Initialize authentication state on app load
   */
  function initializeAuth() {
    return loadAuthState()
  }

  /**
   * Validate PIN format (client-side validation)
   */
  function validatePinFormat(pin) {
    if (!pin) {
      return { valid: false, error: 'PIN is required' }
    }
    
    if (!/^\d{4}$/.test(pin)) {
      return { valid: false, error: 'PIN must be exactly 4 digits' }
    }
    
    return { valid: true }
  }

  return {
    // State
    isAuthenticated,
    getCurrentEmployee,
    getCurrentPin,
    
    // Session management
    isSessionExpired,
    loadAuthState,
    saveAuthState,
    clearAuthState,
    getSessionInfo,
    extendSession,
    initializeAuth,
    
    // Authentication methods
    login,
    logout,
    hasRouteAccess,
    validatePinFormat,
    
    // Remember me functionality
    clearRememberedPin,
    setRememberedPin,
    getRememberedPin
  }
}

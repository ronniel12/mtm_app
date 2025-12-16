import { reactive, computed } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'

const AUTH_STORAGE_KEY = 'mtm_admin_auth_v1'

const state = reactive({
  initialized: false,
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  loading: false,
  error: null,
})

let refreshPromise = null

function ensureInitialized() {
  if (!state.initialized) {
    loadAuthState()
  }
}

function loadAuthState() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!stored) {
      state.initialized = true
      return
    }

    const parsed = JSON.parse(stored)
    state.user = parsed.user || null
    state.accessToken = parsed.accessToken || null
    state.accessTokenExpiresAt = parsed.accessTokenExpiresAt || null
  } catch (error) {
    console.warn('Failed to parse stored auth state:', error)
    clearAuthState()
  } finally {
    state.initialized = true
  }
}

function persistAuthState() {
  if (state.user && state.accessToken) {
    const payload = {
      user: state.user,
      accessToken: state.accessToken,
      accessTokenExpiresAt: state.accessTokenExpiresAt,
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

function clearAuthState() {
  state.user = null
  state.accessToken = null
  state.accessTokenExpiresAt = null
  state.error = null
  persistAuthState()
}

function hasValidAccessToken() {
  if (!state.accessToken || !state.accessTokenExpiresAt) {
    return false
  }
  const now = Date.now()
  return now < state.accessTokenExpiresAt - 5000 // renew slightly before expiry
}

function setAuthData({ user, accessToken, expiresIn }) {
  if (!accessToken) {
    clearAuthState()
    return
  }

  state.user = user || state.user
  state.accessToken = accessToken
  state.accessTokenExpiresAt = Date.now() + (expiresIn * 1000)
  state.error = null
  state.initialized = true
  persistAuthState()
}

function getAccessToken() {
  ensureInitialized()
  return hasValidAccessToken() ? state.accessToken : null
}

async function login(email, password) {
  ensureInitialized()
  state.loading = true
  state.error = null

  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { email, password },
      { withCredentials: true }
    )

    setAuthData({
      user: data.user,
      accessToken: data.accessToken,
      expiresIn: data.accessTokenExpiresIn || 900,
    })

    return { success: true, user: data.user }
  } catch (error) {
    const message = error.response?.data?.message || 'Invalid email or password.'
    state.error = message
    clearAuthState()
    return { success: false, message }
  } finally {
    state.loading = false
  }
}

async function logout({ silent = false } = {}) {
  ensureInitialized()

  try {
    await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
    return { success: true }
  } catch (error) {
    if (!silent) {
      const message = error.response?.data?.message || 'Failed to log out.'
      state.error = message
      return { success: false, message }
    }
    return { success: false }
  } finally {
    clearAuthState()
  }
}

async function logoutSilently() {
  await logout({ silent: true })
}

async function attemptTokenRefresh() {
  ensureInitialized()

  if (!state.user) {
    return null
  }

  if (hasValidAccessToken()) {
    return state.accessToken
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        const user = data.user || state.user
        if (data.accessToken && user) {
          setAuthData({
            user,
            accessToken: data.accessToken,
            expiresIn: data.accessTokenExpiresIn || 900,
          })
          return data.accessToken
        }
        clearAuthState()
        return null
      })
      .catch((error) => {
        console.error('Token refresh failed:', error)
        clearAuthState()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function requestPasswordReset(email) {
  return axios.post(`${API_BASE_URL}/auth/request-reset`, { email }, { withCredentials: true })
}

async function resetPassword(token, password) {
  return axios.post(
    `${API_BASE_URL}/auth/reset-password`,
    { token, password },
    { withCredentials: true }
  )
}

async function initializeAuth() {
  ensureInitialized()
  if (state.user && !hasValidAccessToken()) {
    await attemptTokenRefresh()
  }
  return isAuthenticated.value
}

const isAuthenticated = computed(() => {
  ensureInitialized()
  return hasValidAccessToken() && !!state.user
})

const authUser = computed(() => state.user)
const authError = computed(() => state.error)
const isLoading = computed(() => state.loading)
const isInitialized = computed(() => state.initialized)

export function useAuth() {
  return {
    isAuthenticated,
    user: authUser,
    isInitialized,
    loading: isLoading,
    error: authError,
    login,
    logout: () => logout({ silent: false }),
    logoutSilently,
    initializeAuth,
    requestPasswordReset,
    resetPassword,
  }
}

export {
  getAccessToken,
  attemptTokenRefresh,
  logoutSilently,
  requestPasswordReset,
  resetPassword,
  initializeAuth,
}

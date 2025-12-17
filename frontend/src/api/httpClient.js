import axios from 'axios'
import { API_BASE_URL } from './config'
import { getAccessToken, attemptTokenRefresh, logoutSilently } from '@/composables/useAuth'


axios.defaults.withCredentials = true

let isRefreshing = false
let refreshQueue = []

function enqueueRequest(callback) {
  refreshQueue.push(callback)
}

function resolveRefreshQueue(token) {
  refreshQueue.forEach((callback) => {
    try {
      callback(token)
    } catch (error) {
      console.error('Error resolving queued request after refresh:', error)
    }
  })
  refreshQueue = []
}

axios.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  return config
})

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {}
    const status = error.response?.status

    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          enqueueRequest((newToken) => {
            if (newToken) {
              originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${newToken}`,
              }
              resolve(axios(originalRequest))
            } else {
              reject(error)
            }
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const newToken = await attemptTokenRefresh()
        resolveRefreshQueue(newToken)

        if (newToken) {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${newToken}`,
          }
          return axios(originalRequest)
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        resolveRefreshQueue(null)
        await logoutSilently()
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default axios

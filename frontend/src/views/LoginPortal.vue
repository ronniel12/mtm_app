<template>
  <div class="login-portal">
    <!-- Portal Header -->
    <div class="portal-header">
      <div class="portal-branding">
        <img src="/mtmlogo.jpeg" alt="MTM Enterprise" class="portal-logo" />
        <div class="portal-title">
          <h1>MTM Enterprise</h1>
          <p>Employee Login Portal</p>
        </div>
      </div>
    </div>

    <!-- Login Form -->
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h2>🔐 Employee Login</h2>
          <p>Enter your 4-digit PIN to access your payslips</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="pin">Employee PIN</label>
            <div class="pin-input-container">
              <input
                id="pin"
                v-model="pin"
                type="text"
                maxlength="4"
                pattern="[0-9]{4}"
                placeholder="••••"
                class="pin-input"
                :class="{ 'error': errorMessage }"
                autocomplete="off"
                ref="pinInput"
                @input="handlePinInput"
                @keyup.enter="handleLogin"
              />
            </div>
            <p class="input-help">Enter your 4-digit PIN</p>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="error-message">
            <span class="error-icon">⚠️</span>
            {{ errorMessage }}
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="loading-message">
            <div class="loading-spinner"></div>
            <span>Verifying PIN...</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="btn-login"
            :disabled="!isValidPin || loading"
          >
            <span v-if="!loading">🚀 Access Payslips</span>
            <span v-else>Verifying...</span>
          </button>
        </form>

        <!-- Help Text -->
        <div class="login-help">
          <div class="help-item">
            <span class="help-icon">ℹ️</span>
            <span>Your PIN was provided by your supervisor</span>
          </div>
          <div class="help-item">
            <span class="help-icon">🔒</span>
            <span>Your session will expire after 24 hours</span>
          </div>
          <div class="help-item">
            <span class="help-icon">📞</span>
            <span>Need help? Call 09605638462</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="login-footer">
      <div class="footer-content">
        <div class="company-info">
          <img src="/mtmlogo.jpeg" alt="MTM Enterprise" class="footer-logo" />
          <div class="footer-text">
            <h4>MTM ENTERPRISE</h4>
            <p>Secure Employee Portal</p>
          </div>
        </div>
        <div class="contact-info">
          <p><strong>Mobile:</strong> 09605638462</p>
          <p><strong>Telegram:</strong> +358-044-978-8592</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'
import { useAuth } from '@/composables/useAuth'

// Reactive data
const router = useRouter()
const auth = useAuth()
const pin = ref('')
const loading = ref(false)
const errorMessage = ref('')

// Refs
const pinInput = ref(null)

// Computed properties
const isValidPin = computed(() => {
  return /^\d{4}$/.test(pin.value)
})

// Methods
const handlePinInput = (event) => {
  // Only allow digits, max 4 characters
  const value = event.target.value.replace(/\D/g, '').slice(0, 4)
  pin.value = value
  
  // Clear error when user starts typing
  if (errorMessage.value) {
    errorMessage.value = ''
  }
}

const handleLogin = async () => {
  if (!isValidPin.value || loading.value) {
    return
  }

  try {
    loading.value = true
    errorMessage.value = ''

    console.log('🔐 Attempting login with PIN:', pin.value)

    // Verify PIN and get employee data
    const response = await axios.get(`${API_BASE_URL}/employee/${pin.value}/payslips`)
    
    if (!response.data.employee || !response.data.payslips) {
      throw new Error('Invalid response from server')
    }

    console.log('✅ PIN verified successfully:', response.data.employee.name)

    // Create authentication session
    const authData = {
      pin: pin.value,
      employee: response.data.employee,
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    }
    
    // Save authentication state
    auth.saveAuthState(authData)
    
    console.log('🗂️ Authentication session created')

    // Redirect to employee portal with PIN
    await router.push(`/employee/${pin.value}`)

  } catch (error) {
    console.error('❌ Login failed:', error)
    
    if (error.response?.status === 404) {
      errorMessage.value = 'Invalid PIN. Please check with your supervisor.'
    } else if (error.response?.status >= 500) {
      errorMessage.value = 'Server error. Please try again later.'
    } else {
      errorMessage.value = 'Unable to verify PIN. Please try again.'
    }
    
    // Clear PIN on error
    pin.value = ''
    
    // Focus back to input
    await nextTick()
    pinInput.value?.focus()
    
  } finally {
    loading.value = false
  }
}

// Auto-focus input on mount
onMounted(async () => {
  await nextTick()
  pinInput.value?.focus()
})
</script>

<style scoped>
.login-portal {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  display: flex;
  flex-direction: column;
}

/* Portal Header */
.portal-header {
  background: white;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid #f1f5f9;
  padding: 1.5rem 2rem;
}

.portal-branding {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.portal-logo {
  width: 60px;
  height: 60px;
  object-fit: contain;
  border-radius: 12px;
}

.portal-title h1 {
  margin: 0;
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.portal-title p {
  margin: 0.25rem 0 0 0;
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 500;
}

/* Login Container */
.login-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid #e2e8f0;
  width: 100%;
  max-width: 480px;
  position: relative;
  overflow: hidden;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8, #3b82f6);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h2 {
  margin: 0 0 0.5rem 0;
  color: #1e293b;
  font-size: 1.8rem;
  font-weight: 700;
}

.login-header p {
  margin: 0;
  color: #64748b;
  font-size: 1rem;
}

/* Form Styles */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #374151;
  font-size: 0.95rem;
}

.pin-input-container {
  position: relative;
}

.pin-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.5rem;
  background: #f9fafb;
  transition: all 0.2s;
  outline: none;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
}

.pin-input:focus {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.pin-input.error {
  border-color: #ef4444;
  background: #fef2f2;
}

.pin-input::placeholder {
  color: #9ca3af;
  letter-spacing: normal;
}

.input-help {
  font-size: 0.85rem;
  color: #6b7280;
  text-align: center;
  margin: 0;
}

/* Error and Loading States */
.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.9rem;
  font-weight: 500;
}

.error-icon {
  font-size: 1rem;
}

.loading-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  color: #0369a1;
  font-size: 0.9rem;
  font-weight: 500;
  justify-content: center;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 50%;
  border-top-color: #3b82f6;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Submit Button */
.btn-login {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-login:hover:not(:disabled) {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

.btn-login:active:not(:disabled) {
  transform: translateY(0);
}

.btn-login:disabled {
  background: #d1d5db;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Help Section */
.login-help {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.help-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #64748b;
  font-size: 0.9rem;
}

.help-icon {
  font-size: 1rem;
  width: 1.25rem;
  text-align: center;
}

/* Footer */
.login-footer {
  background: white;
  border-top: 1px solid #f1f5f9;
  padding: 2rem;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.company-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.footer-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 8px;
}

.footer-text h4 {
  margin: 0 0 0.25rem 0;
  color: #1e293b;
  font-size: 1rem;
}

.footer-text p {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
}

.contact-info {
  text-align: right;
  color: #475569;
}

.contact-info p {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
}

.contact-info p:last-child {
  margin-bottom: 0;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .portal-header {
    padding: 1rem;
  }

  .portal-branding {
    justify-content: center;
  }

  .login-container {
    padding: 1rem;
  }

  .login-card {
    padding: 2rem 1.5rem;
  }

  .login-header h2 {
    font-size: 1.5rem;
  }

  .pin-input {
    font-size: 1.25rem;
    padding: 0.875rem;
  }

  .footer-content {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
  }

  .company-info {
    justify-content: center;
  }

  .contact-info {
    text-align: center;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 1.5rem 1rem;
    border-radius: 12px;
  }

  .login-header {
    margin-bottom: 1.5rem;
  }

  .login-header h2 {
    font-size: 1.3rem;
  }

  .login-form {
    gap: 1.25rem;
  }

  .btn-login {
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
  }
}
</style>

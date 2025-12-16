<template>
  <div class="auth-page">
    <div class="auth-card">
      <header class="auth-header">
        <img src="/mtmlogo.jpeg" alt="MTM Enterprise" class="auth-logo" />
        <div class="auth-title">
          <h1>MTM Enterprise</h1>
          <p>Administrator Access</p>
        </div>
      </header>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <h2>Admin Login</h2>
        <p class="auth-subtitle">Sign in to manage operations and reports.</p>

        <label class="auth-label" for="email">Email</label>
        <input
          id="email"
          v-model.trim="email"
          type="email"
          required
          placeholder="admin@example.com"
          class="auth-input"
          autocomplete="email"
        />

        <label class="auth-label" for="password">Password</label>
        <div class="password-input-container">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            minlength="8"
            placeholder="••••••••"
            class="auth-input"
            autocomplete="current-password"
          />
          <button 
            type="button" 
            class="password-toggle"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
          >
            <span v-if="showPassword">👁️</span>
            <span v-else>👁️‍🗨️</span>
          </button>
        </div>

        <p v-if="errorMessage" class="auth-message error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="auth-message success">{{ successMessage }}</p>

        <button type="submit" class="auth-button" :disabled="loading">
          <span v-if="!loading">Sign In</span>
          <span v-else>Signing in…</span>
        </button>

        <div class="auth-links">
          <router-link to="/admin/forgot-password">Forgot password?</router-link>
          <router-link to="/login">Employee portal</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const auth = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const handleSubmit = async () => {
  if (loading.value) return

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  const { success, message } = await auth.login(email.value, password.value)

  loading.value = false

  if (!success) {
    errorMessage.value = message || 'Unable to sign in. Please try again.'
    return
  }

  successMessage.value = 'Login successful. Redirecting…'
  const redirectTo = typeof route.query.redirect === 'string' && route.query.redirect.length
    ? route.query.redirect
    : '/dashboard'
  router.replace(redirectTo)
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #2563eb 100%);
  padding: 2rem 1rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
  padding: 2.5rem 2rem;
}

.auth-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.auth-logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  object-fit: cover;
}

.auth-title h1 {
  margin: 0;
  font-size: 1.35rem;
  color: #0f172a;
  font-weight: 700;
}

.auth-title p {
  margin: 0.25rem 0 0;
  color: #475569;
  font-size: 0.95rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-form h2 {
  margin: 0;
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 700;
}

.auth-subtitle {
  margin: 0;
  color: #64748b;
  font-size: 0.95rem;
}

.auth-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
}

.auth-input {
  width: 100%;
  border: 1px solid #cbd5f5;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.auth-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.password-input-container {
  position: relative;
  width: 100%;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: #64748b;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.password-toggle:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.password-toggle:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}

/* Ensure the password input has padding on the right for the toggle */
#password {
  padding-right: 3rem;
  width: 100%;
}

.auth-button {
  margin-top: 0.5rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #1e40af 100%);
  color: #ffffff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.auth-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 15px 30px rgba(37, 99, 235, 0.3);
}

.auth-message {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
}

.auth-message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.auth-message.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.auth-links {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.auth-links a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
}

.auth-links a:hover {
  text-decoration: underline;
}

@media (max-width: 480px) {
  .auth-card {
    padding: 2rem 1.5rem;
  }

  .auth-form h2 {
    font-size: 1.35rem;
  }
}
</style>

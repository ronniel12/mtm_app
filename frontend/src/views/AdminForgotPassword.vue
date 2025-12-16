<template>
  <div class="auth-page">
    <div class="auth-card">
      <header class="auth-header">
        <img src="/mtmlogo.jpeg" alt="MTM Enterprise" class="auth-logo" />
        <div class="auth-title">
          <h1>Password Assistance</h1>
          <p>Enter your administrator email to receive reset instructions.</p>
        </div>
      </header>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <label class="auth-label" for="email">Administrator Email</label>
        <input
          id="email"
          v-model.trim="email"
          type="email"
          required
          placeholder="admin@example.com"
          class="auth-input"
          autocomplete="email"
        />

        <p v-if="errorMessage" class="auth-message error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="auth-message success">{{ successMessage }}</p>

        <button type="submit" class="auth-button" :disabled="loading">
          <span v-if="!loading">Send Reset Link</span>
          <span v-else>Sending…</span>
        </button>

        <div class="auth-links">
          <router-link to="/admin/login">Back to login</router-link>
          <router-link to="/login">Employee portal</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const auth = useAuth()

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const handleSubmit = async () => {
  if (loading.value) return

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await auth.requestPasswordReset(email.value)
    successMessage.value = 'If the email exists, reset instructions have been sent.'
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to send reset instructions.'
  } finally {
    loading.value = false
  }
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
  gap: 1rem;
  align-items: center;
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
  font-size: 1.3rem;
  color: #0f172a;
  font-weight: 700;
}

.auth-title p {
  margin: 0.35rem 0 0;
  color: #475569;
  font-size: 0.95rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
}
</style>

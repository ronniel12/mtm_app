<template>
  <div class="auth-page">
    <div class="auth-card">
      <header class="auth-header">
        <img src="/mtmlogo.jpeg" alt="MTM Enterprise" class="auth-logo" />
        <div class="auth-title">
          <h1>MTM Enterprise</h1>
          <p>Set New Password</p>
        </div>
      </header>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <h2>Set New Password</h2>
        <p class="auth-subtitle">Please create a new secure password for your account.</p>

        <div class="form-group">
          <label class="auth-label" for="newPassword">New Password</label>
          <div class="password-input-container">
            <input
              id="newPassword"
              v-model="form.newPassword"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="8"
              placeholder="••••••••"
              class="auth-input"
              autocomplete="new-password"
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
        </div>

        <div class="form-group">
          <label class="auth-label" for="confirmPassword">Confirm New Password</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            required
            minlength="8"
            placeholder="••••••••"
            class="auth-input"
            autocomplete="new-password"
          />
        </div>

        <p v-if="errorMessage" class="auth-message error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="auth-message success">{{ successMessage }}</p>

        <button type="submit" class="auth-button" :disabled="loading">
          <span v-if="!loading">Update Password</span>
          <span v-else>Updating...</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const form = ref({
  newPassword: '',
  confirmPassword: ''
});

const validateForm = () => {
  if (form.value.newPassword.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters long';
    return false;
  }
  if (form.value.newPassword !== form.value.confirmPassword) {
    errorMessage.value = 'Passwords do not match';
    return false;
  }
  return true;
};

const handleSubmit = async () => {
  if (loading.value) return;
  
  if (!validateForm()) return;
  
  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  
  try {
    const userId = route.query.userId || '';
    if (!userId) {
      throw new Error('Invalid user session');
    }
    
    const { success, message } = await auth.completePasswordReset(userId, form.value.newPassword);
    
    if (!success) {
      errorMessage.value = message || 'Failed to update password';
      return;
    }
    
    successMessage.value = 'Password updated successfully! Redirecting...';
    
    // Redirect to dashboard after successful password update
    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
    
  } catch (error) {
    console.error('Password reset error:', error);
    errorMessage.value = 'An error occurred while updating your password. Please try again.';
  } finally {
    loading.value = false;
  }
};

// Check if this is a valid password reset request
onMounted(() => {
  if (!route.query.userId) {
    router.push('/admin/login');
  }
});
</script>

<style scoped>
/* Reuse existing auth styles from AdminLogin.vue */
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
  margin: 0 0 1rem;
  color: #64748b;
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 1rem;
}

.auth-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
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

#newPassword, #confirmPassword {
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
  margin: 1rem 0 0;
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

@media (max-width: 480px) {
  .auth-card {
    padding: 2rem 1.5rem;
  }

  .auth-form h2 {
    font-size: 1.35rem;
  }
}
</style>

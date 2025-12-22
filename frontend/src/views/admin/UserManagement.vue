<template>
  <div class="user-management">
    <h1>👥 User Management</h1>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="!isAdmin" class="access-denied">
      Access denied. Admin privileges required.
    </div>

    <div v-else>
      <div class="header-actions">
        <button @click="openAddUserModal" class="add-user-btn">➕ Add User</button>
      </div>

      <!-- Card-based layout -->
      <div class="cards-container block">
        <div v-for="user in users" :key="user.id" class="user-card">
          <div class="card-field"><strong>ID:</strong> {{ user.id || 'N/A' }}</div>
          <div class="card-field"><strong>Email:</strong> {{ user.email || 'N/A' }}</div>
          <div class="card-field"><strong>Role:</strong> {{ user.role || 'N/A' }}</div>
          <div class="card-field"><strong>Last Login:</strong> {{ user.last_login ? new Date(user.last_login).toLocaleString() : 'Never' }}</div>
          <div class="card-actions">
            <button @click="openEditModal(user)" class="edit-btn card-edit-btn">✏️ Edit</button>
            <button @click="confirmDelete(user)" class="delete-btn card-delete-btn">🗑️ Delete</button>
            <button @click="confirmReset(user)" class="reset-btn card-reset-btn">Reset Password</button>
          </div>
        </div>
      </div>

      <!-- Set Password Modal -->
      <div v-if="showConfirm" class="modal-overlay" @click="cancelReset">
        <div class="modal-content" @click.stop>
          <h3>Set New Password</h3>
          <p>Setting new password for <strong>{{ selectedUser?.email }}</strong></p>
          <div class="password-fields">
            <div class="field">
              <label for="new-password">New Password:</label>
              <input id="new-password" type="password" v-model="customPassword" />
            </div>
            <div class="field">
              <label for="confirm-password">Confirm Password:</label>
              <input id="confirm-password" type="password" v-model="confirmPassword" />
            </div>
            <div v-if="passwordError" class="error-message">{{ passwordError }}</div>
          </div>
          <div class="modal-actions">
            <button @click="cancelReset" class="cancel-btn">Cancel</button>
            <button @click="resetPassword" class="confirm-btn">Set Password</button>
          </div>
        </div>
      </div>

      <!-- Add User Modal -->
      <div v-if="showAddUser" class="modal-overlay" @click="cancelAddUser">
        <div class="modal-content" @click.stop>
          <h3>Add New User</h3>
          <div class="add-user-fields">
            <div class="field">
              <label for="user-email">Email:</label>
              <input id="user-email" type="email" v-model="newUser.email" />
            </div>
            <div class="field">
              <label for="user-password">Password:</label>
              <input id="user-password" type="password" v-model="newUser.password" />
            </div>
            <div class="field">
              <label for="user-confirm-password">Confirm Password:</label>
              <input id="user-confirm-password" type="password" v-model="newUser.confirmPassword" />
            </div>
            <div class="field">
              <label for="user-role">Role:</label>
              <select id="user-role" v-model="newUser.role">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div v-if="addUserError" class="error-message">{{ addUserError }}</div>
          </div>
          <div class="modal-actions">
            <button @click="cancelAddUser" class="cancel-btn">Cancel</button>
            <button @click="addUser" class="confirm-btn">Add User</button>
          </div>
        </div>
      </div>

      <!-- Edit User Modal -->
      <div v-if="showEdit" class="modal-overlay" @click="cancelEdit">
        <div class="modal-content" @click.stop>
          <h3>Edit User</h3>
          <div class="edit-user-fields">
            <div class="field">
              <label for="edit-email">Email:</label>
              <input id="edit-email" type="email" v-model="editUser.email" />
            </div>
            <div class="field">
              <label for="edit-role">Role:</label>
              <select id="edit-role" v-model="editUser.role">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div class="field">
              <label for="edit-password">New Password (optional):</label>
              <input id="edit-password" type="password" v-model="editUser.password" placeholder="Leave blank to keep current password" />
            </div>
            <div class="field" v-if="editUser.password">
              <label for="edit-confirm-password">Confirm New Password:</label>
              <input id="edit-confirm-password" type="password" v-model="editUser.confirmPassword" />
            </div>
            <div v-if="editError" class="error-message">{{ editError }}</div>
          </div>
          <div class="modal-actions">
            <button @click="cancelEdit" class="cancel-btn">Cancel</button>
            <button @click="editUserSubmit" class="confirm-btn">Update User</button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteConfirm" class="modal-overlay" @click="cancelDelete">
        <div class="modal-content" @click.stop>
          <h3>Confirm Delete</h3>
          <p>Are you sure you want to delete the user <strong>{{ selectedUser?.email }}</strong>? This action cannot be undone.</p>
          <div class="modal-actions">
            <button @click="cancelDelete" class="cancel-btn">Cancel</button>
            <button @click="deleteUser" class="delete-confirm-btn">Delete User</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import httpClient from '@/api/httpClient'

const { user } = useAuth()

const users = ref([])
const showConfirm = ref(false)
const selectedUser = ref(null)
const customPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const error = ref('')

const showAddUser = ref(false)
const newUser = ref({
  email: '',
  password: '',
  confirmPassword: '',
  role: 'viewer'
})
const addUserError = ref('')

const showEdit = ref(false)
const editUser = ref({
  id: null,
  email: '',
  role: '',
  password: '',
  confirmPassword: ''
})
const editError = ref('')

const showDeleteConfirm = ref(false)

const isAdmin = computed(() => user.value && user.value.role === 'admin')

const loadUsers = async () => {
  try {
    const response = await httpClient.get('/admin/users')
    console.log('API response data:', response.data)
users.value = response.data
console.log('Users array:', users.value)
  } catch (err) {
    console.error('Failed to load users:', err)
    error.value = 'Failed to load users. Please try again.'
  }
}

onMounted(async () => {
  if (!isAdmin.value) {
    error.value = 'Access denied. Admin privileges required.'
    return
  }

  await loadUsers()
})

const confirmReset = (user) => {
  selectedUser.value = user
  showConfirm.value = true
}

const cancelReset = () => {
  showConfirm.value = false
  selectedUser.value = null
  customPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
}

const resetPassword = async () => {
  passwordError.value = ''
  if (customPassword.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters long.'
    return
  }
  if (customPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.'
    return
  }
  try {
    const response = await httpClient.post('/admin/reset-password', {
      userId: selectedUser.value.id,
      newPassword: customPassword.value
    })
    showConfirm.value = false
    // Optionally show success message
    alert('Password reset successfully.')
    // Clear fields
    customPassword.value = ''
    confirmPassword.value = ''
    selectedUser.value = null
  } catch (err) {
    console.error('Failed to reset password:', err)
    error.value = 'Failed to reset password. Please try again.'
  }
}

const openAddUserModal = () => {
  showAddUser.value = true
}

const cancelAddUser = () => {
  showAddUser.value = false
  newUser.value = {
    email: '',
    password: '',
    confirmPassword: '',
    role: 'viewer'
  }
  addUserError.value = ''
}

const addUser = async () => {
  addUserError.value = ''
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newUser.value.email)) {
    addUserError.value = 'Please enter a valid email address.'
    return
  }
  if (newUser.value.password.length < 8) {
    addUserError.value = 'Password must be at least 8 characters long.'
    return
  }
  if (newUser.value.password !== newUser.value.confirmPassword) {
    addUserError.value = 'Passwords do not match.'
    return
  }
  try {
    const response = await httpClient.post('/admin/users', {
      email: newUser.value.email,
      password: newUser.value.password,
      role: newUser.value.role
    })
    showAddUser.value = false
    alert('User added successfully.')
    // Clear fields
    newUser.value = {
      email: '',
      password: '',
      confirmPassword: '',
      role: 'viewer'
    }
    // Refresh user list
    await loadUsers()
  } catch (err) {
    console.error('Failed to add user:', err)
    addUserError.value = 'Failed to add user. Please try again.'
  }
}

const openEditModal = (user) => {
  editUser.value = {
    id: user.id,
    email: user.email,
    role: user.role,
    password: '',
    confirmPassword: ''
  }
  editError.value = ''
  showEdit.value = true
}

const cancelEdit = () => {
  showEdit.value = false
  editUser.value = {
    id: null,
    email: '',
    role: '',
    password: '',
    confirmPassword: ''
  }
  editError.value = ''
}

const editUserSubmit = async () => {
  editError.value = ''
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(editUser.value.email)) {
    editError.value = 'Please enter a valid email address.'
    return
  }
  if (editUser.value.password && editUser.value.password.length < 8) {
    editError.value = 'Password must be at least 8 characters long.'
    return
  }
  if (editUser.value.password && editUser.value.password !== editUser.value.confirmPassword) {
    editError.value = 'Passwords do not match.'
    return
  }
  try {
    const updateData = {
      email: editUser.value.email,
      role: editUser.value.role
    }
    if (editUser.value.password) {
      updateData.password = editUser.value.password
    }
    const response = await httpClient.put(`/admin/users/${editUser.value.id}`, updateData)
    showEdit.value = false
    alert('User updated successfully.')
    // Clear fields
    editUser.value = {
      id: null,
      email: '',
      role: '',
      password: '',
      confirmPassword: ''
    }
    // Refresh user list
    await loadUsers()
  } catch (err) {
    console.error('Failed to update user:', err)
    editError.value = 'Failed to update user. Please try again.'
  }
}

const confirmDelete = (user) => {
  selectedUser.value = user
  showDeleteConfirm.value = true
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  selectedUser.value = null
}

const deleteUser = async () => {
  try {
    const response = await httpClient.delete(`/admin/users/${selectedUser.value.id}`)
    showDeleteConfirm.value = false
    alert('User deleted successfully.')
    selectedUser.value = null
    // Refresh user list
    await loadUsers()
  } catch (err) {
    console.error('Failed to delete user:', err)
    error.value = 'Failed to delete user. Please try again.'
    showDeleteConfirm.value = false
  }
}


</script>

<style scoped>
.user-management {
  padding: 20px;
}

.error-message {
  color: red;
  margin-bottom: 20px;
}

.access-denied {
  color: red;
  font-size: 18px;
}





.edit-btn {
  background-color: #ff9800;
  color: white;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 4px;
}

.edit-btn:hover {
  background-color: #f57c00;
}

.delete-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 4px;
}

.delete-btn:hover {
  background-color: #d32f2f;
}

.reset-btn {
  background-color: #9c27b0;
  color: white;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 4px;
}

.reset-btn:hover {
  background-color: #7b1fa2;
}

.header-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.add-user-btn {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  border-radius: 4px;
}

.add-user-btn:hover {
  background-color: #45a049;
}

.refresh-btn {
  background-color: #2196f3;
  color: white;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  border-radius: 4px;
}

.refresh-btn:hover {
  background-color: #1976d2;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.password-fields {
  margin: 20px 0;
}

.add-user-fields {
  margin: 20px 0;
}

.add-user-fields .field select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.field {
  margin-bottom: 15px;
}

.field label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.field input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.cancel-btn,
.confirm-btn,
.copy-btn,
.close-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  background-color: #ccc;
}

.confirm-btn {
  background-color: #f44336;
  color: white;
}

.delete-confirm-btn {
  background-color: #f44336;
  color: white;
}

.copy-btn {
  background-color: #2196f3;
  color: white;
}

.close-btn {
  background-color: #4caf50;
  color: white;
}

.cards-container {
  margin-top: 20px;
}

.user-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  background-color: #f9f9f9;
}

.card-field {
  margin-bottom: 10px;
}

.card-field strong {
  display: inline-block;
  width: 120px;
  font-weight: bold;
}

.card-actions {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.card-edit-btn,
.card-delete-btn,
.card-reset-btn {
  flex: 1;
  min-width: 0;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .user-management {
    padding: 10px;
  }

  .header-actions {
    flex-direction: column;
    gap: 8px;
  }

  .card-actions {
    flex-direction: column;
    gap: 3px;
  }

  .card-actions button {
    padding: 6px 12px;
    font-size: 0.9rem;
  }

  .reset-btn {
    padding: 4px 8px;
    font-size: 0.8rem;
  }

  .add-user-btn {
    padding: 8px 16px;
    font-size: 0.9rem;
  }

  .refresh-btn {
    padding: 8px 16px;
    font-size: 0.9rem;
  }

  .modal-content {
    width: 95%;
    padding: 15px;
  }

  .modal-actions {
    flex-direction: column;
    gap: 8px;
  }

  .cancel-btn,
  .confirm-btn,
  .copy-btn,
  .close-btn {
    padding: 6px 12px;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .user-management {
    padding: 5px;
  }



  .card-actions button {
    padding: 5px 10px;
    font-size: 0.85rem;
  }

  .reset-btn {
    padding: 3px 6px;
    font-size: 0.75rem;
  }

  .add-user-btn {
    padding: 6px 12px;
    font-size: 0.85rem;
  }

  .refresh-btn {
    padding: 6px 12px;
    font-size: 0.85rem;
  }

  .modal-content {
    padding: 10px;
  }

  .modal-actions {
    gap: 6px;
  }

  .cancel-btn,
  .confirm-btn,
  .copy-btn,
  .close-btn {
    padding: 5px 10px;
    font-size: 0.85rem;
  }
}
</style>
<script setup>
import { ref, computed } from 'vue'
import TripList from './components/TripList.vue'
import TripForm from './components/TripForm.vue'
import RatesLookup from './components/RatesLookup.vue'
import Settings from './components/Settings.vue'
import DashboardCharts from './components/DashboardCharts.vue'
import BillingView from './components/BillingView.vue'
import BillingHistory from './components/BillingHistory.vue'
import PayrollView from './components/PayrollView.vue'
import PayslipHistory from './components/PayslipHistory.vue'
import TollView from './components/TollView.vue'
import ExpensesView from './components/ExpensesView.vue'
import axios from 'axios'
import { API_BASE_URL } from '@/api/config'

const showForm = ref(false)
const activeSection = ref('dashboard')
const refreshKey = ref(0)
const editTrip = ref(null)
const showHistory = ref(false)
const mobileMenuOpen = ref(false)
const billingTab = ref('create')
const payrollTab = ref('create')
const tripListRef = ref(null)

const trips = ref([])
const employees = ref([])
const isLoading = ref(true)
const error = ref(null)

const totalRates = computed(() => {
  if (trips.value.length === 0) return 0
  const sum = trips.value.reduce((acc, trip) => acc + (trip.rate || 0), 0)
  return Math.round(sum / trips.value.length)
})

const setActiveSection = (section) => {
  activeSection.value = section
  showForm.value = false
  editTrip.value = null
  showHistory.value = false // Reset history view when switching sections
}

const toggleForm = () => {
  showForm.value = !showForm.value
  if (!showForm.value) {
    editTrip.value = null
  }
}

const onTripAdded = () => {
  showForm.value = false
  editTrip.value = null
  // Force refresh by incrementing the key
  refreshKey.value++
  fetchDashboardData()
  // Directly refresh the trip list to ensure immediate UI update
  tripListRef.value?.fetchTrips()
}

const onTripEdit = (trip) => {
  editTrip.value = trip
  showForm.value = true
}

const fetchDashboardData = async () => {
  try {
    isLoading.value = true
    error.value = null

    // Use optimized endpoint that includes pre-calculated rates
    const [tripsRes, employeesRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/trips/calculated?limit=all`),
      axios.get(`${API_BASE_URL}/employees`)
    ])

    // Data is already processed by the API with pre-calculated rates
    trips.value = tripsRes.data.trips || []
    employees.value = employeesRes.data
  } catch (err) {
    console.error('Error fetching dashboard data:', err)
    error.value = 'Failed to load dashboard data. Please check if the backend server is running.'
  } finally {
    isLoading.value = false
  }
}



const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

// Mobile menu functions
const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const setActiveSectionMobile = (section) => {
  activeSection.value = section
  showForm.value = false
  editTrip.value = null
  showHistory.value = false
  mobileMenuOpen.value = false // Close mobile menu after selection
}

fetchDashboardData()
</script>

<template>
  <v-app class="app-container">
    <!-- App Bar - Fixed at top -->
    <v-app-bar
      app
      color="primary"
      dark
      elevation="2"
      height="64"
      fixed
      class="app-bar"
    >
      <v-btn
        icon
        @click="toggleMobileMenu"
        class="mobile-menu-icon"
        style="display: block !important;"
      >
        <v-icon>mdi-menu</v-icon>
      </v-btn>

      <!-- Desktop Navigation - Left side -->
      <v-tabs
        v-model="activeSection"
        class="d-none d-md-flex desktop-tabs"
        bg-color="transparent"
        slider-color="white"
        hide-slider
        density="compact"
        grow
      >
        <v-tab value="dashboard" @click="setActiveSection('dashboard')" class="nav-tab">
          <v-icon size="16" start>mdi-view-dashboard</v-icon>
          <span class="d-none d-md-inline">Dashboard</span>
        </v-tab>
        <v-tab value="payroll" @click="setActiveSection('payroll')" class="nav-tab">
          <v-icon size="16" start>mdi-cash-multiple</v-icon>
          <span class="d-none d-md-inline">Payroll</span>
        </v-tab>
        <v-tab value="trips" @click="setActiveSection('trips')" class="nav-tab">
          <v-icon size="16" start>mdi-truck</v-icon>
          <span class="d-none d-md-inline">Trips</span>
        </v-tab>
        <v-tab value="billing" @click="setActiveSection('billing')" class="nav-tab">
          <v-icon size="16" start>mdi-receipt</v-icon>
          <span class="d-none d-md-inline">Billing</span>
        </v-tab>
        <v-tab value="tolls" @click="setActiveSection('tolls')" class="nav-tab">
          <v-icon size="16" start>mdi-road-variant</v-icon>
          <span class="d-none d-md-inline">Tolls</span>
        </v-tab>
        <v-tab value="fuel" @click="setActiveSection('fuel')" class="nav-tab">
          <v-icon size="16" start>mdi-gas-station</v-icon>
          <span class="d-none d-md-inline">Fuel</span>
        </v-tab>
        <v-tab value="expenses" @click="setActiveSection('expenses')" class="nav-tab">
          <v-icon size="16" start>mdi-cash-minus</v-icon>
          <span class="d-none d-md-inline">Expenses</span>
        </v-tab>
        <v-tab value="maintenance" @click="setActiveSection('maintenance')" class="nav-tab">
          <v-icon size="16" start>mdi-wrench</v-icon>
          <span class="d-none d-md-inline">Maintenance</span>
        </v-tab>
        <v-tab value="settings" @click="setActiveSection('settings')" class="nav-tab">
          <v-icon size="16" start>mdi-cog</v-icon>
          <span class="d-none d-md-inline">Settings</span>
        </v-tab>
      </v-tabs>

      <!-- Logo and Text - Rightmost position -->
      <v-toolbar-title class="d-flex align-center toolbar-title">
        <img
          src="/mtmlogo.jpeg"
          alt="MTM Enterprise Logo"
          style="height: 36px; width: 36px; margin-right: 12px; display: block !important; visibility: visible !important;"
        />
        <span style="display: inline !important; visibility: visible !important; font-size: 1.25rem; font-weight: 600; color: white; letter-spacing: 0.5px;">MTM Enterprise</span>
      </v-toolbar-title>
    </v-app-bar>

    <!-- Mobile Navigation Drawer -->
    <v-navigation-drawer
      v-model="mobileMenuOpen"
      temporary
      location="left"
      width="280"
      class="mobile-drawer"
    >
      <div class="drawer-header pa-4">
        <div class="d-flex align-center">
          <v-img
            src="/mtmlogo.jpeg"
            alt="MTM Enterprise Logo"
            max-height="32"
            max-width="32"
            class="me-3"
          />
          <span class="text-h6 font-weight-bold">MTM Enterprise</span>
        </div>
      </div>
      <v-divider />
      <v-list nav class="drawer-list">
        <v-list-item
          :active="activeSection === 'dashboard'"
          @click="setActiveSectionMobile('dashboard')"
          value="dashboard"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-view-dashboard</v-icon></template>
          <v-list-item-title>Dashboard</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'payroll'"
          @click="setActiveSectionMobile('payroll')"
          value="payroll"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-cash-multiple</v-icon></template>
          <v-list-item-title>Payroll</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'trips'"
          @click="setActiveSectionMobile('trips')"
          value="trips"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-truck</v-icon></template>
          <v-list-item-title>Trips</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'billing'"
          @click="setActiveSectionMobile('billing')"
          value="billing"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-receipt</v-icon></template>
          <v-list-item-title>Billing</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'tolls'"
          @click="setActiveSectionMobile('tolls')"
          value="tolls"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-road-variant</v-icon></template>
          <v-list-item-title>Tolls</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'fuel'"
          @click="setActiveSectionMobile('fuel')"
          value="fuel"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-gas-station</v-icon></template>
          <v-list-item-title>Fuel</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'expenses'"
          @click="setActiveSectionMobile('expenses')"
          value="expenses"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-cash-minus</v-icon></template>
          <v-list-item-title>Expenses</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'maintenance'"
          @click="setActiveSectionMobile('maintenance')"
          value="maintenance"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-wrench</v-icon></template>
          <v-list-item-title>Maintenance</v-list-item-title>
        </v-list-item>
        <v-list-item
          :active="activeSection === 'settings'"
          @click="setActiveSectionMobile('settings')"
          value="settings"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-cog</v-icon></template>
          <v-list-item-title>Settings</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content Area -->
    <v-main class="main-content bg-grey-lighten-4">
      <div class="content-wrapper">
        <!-- Dashboard Section -->
        <div v-if="activeSection === 'dashboard'" class="content-section">
          <div class="section-header mb-3 mb-md-4">
            <h1 class="text-h5 text-md-h4 mb-2">📊 Dashboard</h1>
            <p class="text-body-2 text-md-body-1 text-grey">Overview of your logistics operations</p>
          </div>
          <div v-if="isLoading" class="loading-state text-center py-6 py-md-8">
            <v-progress-circular indeterminate color="primary" size="40" />
            <p class="mt-4 text-body-1">Loading dashboard data...</p>
          </div>
          <v-alert v-else-if="error" type="error" class="mb-4 error-alert">
            <template #prepend><v-icon>mdi-alert-circle</v-icon></template>
            <h3 class="text-h6 mb-2">Failed to Load Data</h3>
            <p>{{ error }}</p>
            <v-btn @click="fetchDashboardData" color="primary" variant="outlined" class="mt-2" size="small">Retry</v-btn>
          </v-alert>
          <div v-else class="dashboard-content">
            <DashboardCharts :trips="trips" :employees="employees" />
          </div>
        </div>

        <!-- Trips Section -->
        <div v-if="activeSection === 'trips'" class="content-section">
          <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-3 mb-md-4 gap-2">
            <div class="flex-grow-1">
              <h1 class="text-h5 text-md-h4 mb-2">🚛 Trip Management</h1>
            </div>
            <v-btn
              v-if="!showForm && !editTrip"
              @click="toggleForm"
              color="primary"
              prepend-icon="mdi-plus"
              size="small"
              class="action-btn"
            >
              <span class="d-none d-sm-inline">New Trip</span>
              <span class="d-sm-none">New</span>
            </v-btn>
          </div>
          <div v-if="showForm && !editTrip" class="mb-4 mb-md-6">
            <TripForm :editTrip="editTrip" @tripAdded="onTripAdded" @cancel="toggleForm" />
          </div>
          <TripList ref="tripListRef" :key="refreshKey" @tripEdit="onTripEdit" />
        </div>

        <!-- Settings Section -->
        <div v-if="activeSection === 'settings'" class="content-section">
          <div class="section-header mb-3 mb-md-4">
            <h1 class="text-h5 text-md-h4 mb-2">⚙️ Settings</h1>
            <p class="text-body-2 text-md-body-1 text-grey">Manage drivers, helpers, and rates</p>
          </div>
          <Settings />
        </div>

        <!-- Billing Section -->
        <div v-if="activeSection === 'billing'" class="content-section">
          <v-tabs v-model="billingTab" class="mb-3 mb-md-4 billing-tabs">
            <v-tab value="create" class="tab-item">
              <v-icon start size="16">mdi-plus</v-icon>
              <span class="d-none d-sm-inline">Create Billing</span>
              <span class="d-sm-none">Create</span>
            </v-tab>
            <v-tab value="history" class="tab-item">
              <v-icon start size="16">mdi-history</v-icon>
              <span class="d-none d-sm-inline">Billing History</span>
              <span class="d-sm-none">History</span>
            </v-tab>
          </v-tabs>
          <v-window v-model="billingTab" class="billing-window">
            <v-window-item value="create"><BillingView /></v-window-item>
            <v-window-item value="history"><BillingHistory @switch-to-create="billingTab = 'create'" /></v-window-item>
          </v-window>
        </div>

        <!-- Tolls Section -->
        <div v-if="activeSection === 'tolls'" class="content-section">
          <TollView />
        </div>

        <!-- Fuel Section -->
        <div v-if="activeSection === 'fuel'" class="content-section">
          <v-card class="pa-3 pa-md-6 text-center fuel-card" elevation="2">
            <v-icon size="60" size-md="80" color="grey-lighten-1" class="mb-3 mb-md-4">mdi-gas-station</v-icon>
            <h2 class="text-h6 text-md-h5 mb-2">Fuel Management</h2>
            <p class="text-body-2 text-md-body-1 text-grey mb-3 mb-md-4">Track fuel consumption and costs</p>
            <v-alert type="info" variant="tonal" class="fuel-alert">
              <template #prepend><v-icon>mdi-information</v-icon></template>
              Fuel Tracker Coming Soon - This section will track fuel purchases, consumption, and efficiency metrics.
            </v-alert>
          </v-card>
        </div>

        <!-- Expenses Section -->
        <div v-if="activeSection === 'expenses'" class="content-section">
          <ExpensesView />
        </div>

        <!-- Maintenance Section -->
        <div v-if="activeSection === 'maintenance'" class="content-section">
          <v-card class="pa-3 pa-md-6 text-center maintenance-card" elevation="2">
            <v-icon size="60" size-md="80" color="grey-lighten-1" class="mb-3 mb-md-4">mdi-wrench</v-icon>
            <h2 class="text-h6 text-md-h5 mb-2">Maintenance</h2>
            <p class="text-body-2 text-md-body-1 text-grey mb-3 mb-md-4">Vehicle maintenance tracking</p>
            <v-alert type="info" variant="tonal" class="maintenance-alert">
              <template #prepend><v-icon>mdi-information</v-icon></template>
              Maintenance Tracker Coming Soon - This section will track vehicle maintenance schedules and repair history.
            </v-alert>
          </v-card>
        </div>

        <!-- Payroll Section -->
        <div v-if="activeSection === 'payroll'" class="content-section">
          <v-tabs v-model="payrollTab" class="mb-3 mb-md-4 payroll-tabs">
            <v-tab value="create" class="tab-item">
              <v-icon start size="16">mdi-plus</v-icon>
              <span class="d-none d-sm-inline">Create Payslip</span>
              <span class="d-sm-none">Create</span>
            </v-tab>
            <v-tab value="history" class="tab-item">
              <v-icon start size="16">mdi-history</v-icon>
              <span class="d-none d-sm-inline">Payslip History</span>
              <span class="d-sm-none">History</span>
            </v-tab>
          </v-tabs>
          <v-window v-model="payrollTab" class="payroll-window">
            <v-window-item value="create"><PayrollView /></v-window-item>
            <v-window-item value="history"><PayslipHistory @switch-to-create="payrollTab = 'create'" /></v-window-item>
          </v-window>
        </div>
      </div>
    </v-main>

    <!-- Edit Trip Dialog -->
    <v-dialog v-model="editTrip" max-width="90vw" width="800" persistent class="edit-dialog">
      <v-card>
        <v-card-title class="d-flex align-center pa-3 pa-md-6">
          <v-icon start>mdi-pencil</v-icon>
          <span class="text-h6 text-md-h5">Edit Trip</span>
        </v-card-title>
        <v-card-text class="pa-3 pa-md-6">
          <TripForm :editTrip="editTrip" @tripAdded="onTripAdded" @cancel="() => editTrip = null" />
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style>
/* ==========================================================================
   MOBILE-FIRST RESPONSIVE APP DESIGN
   ========================================================================== */

/* Global Reset & Base Styles */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* App Container */
.app-container {
  width: 100vw;
  min-height: 100vh;
  background: #f8fafc;
}

/* ==========================================================================
   APP BAR STYLES
   ========================================================================== */

.app-bar {
  width: 100vw !important;
  left: 0 !important;
  right: 0 !important;
  background: #1976d2 !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
}

.toolbar-title {
  display: flex !important;
  align-items: center !important;
  margin-right: 24px;
}

.logo-image {
  flex-shrink: 0;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.app-title,
.app-title-mobile {
  visibility: visible !important;
  opacity: 1 !important;
}

/* Force hamburger menu visibility */
.mobile-menu-icon {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.app-title {
  font-size: 1.1rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.5px !important;
}

.app-title-mobile {
  font-size: 0.9rem !important;
  font-weight: 600 !important;
}

.mobile-menu-icon {
  margin-right: 8px;
}

/* Desktop Navigation - Unified Flow */
.desktop-tabs {
  margin-left: 16px;
  margin-right: 16px;
}

.nav-tab {
  min-width: auto !important;
  padding: 0 12px !important;
  font-size: 0.8rem !important;
  text-transform: none !important;
  letter-spacing: 0.5px !important;
}

/* ==========================================================================
   MOBILE DRAWER
   ========================================================================== */

.mobile-drawer {
  width: 280px !important;
  box-shadow: 2px 0 8px rgba(0,0,0,0.1) !important;
}

.drawer-header {
  border-bottom: 1px solid #e5e7eb;
}

.drawer-list {
  padding: 8px 0;
}

.drawer-item {
  margin: 2px 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.drawer-item:hover {
  background: #f3f4f6;
}

.drawer-item--active {
  background: #1976d2 !important;
  color: white !important;
}

/* ==========================================================================
   MAIN CONTENT AREA
   ========================================================================== */

.main-content {
  width: 100vw;
  min-height: calc(100vh - 64px);
  padding-top: 80px !important; /* Account for fixed app bar + spacing */
  background: #f8fafc;
  position: relative;
  z-index: 1;
}

.content-wrapper {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

/* Content Sections */
.content-section {
  width: 100%;
  margin-bottom: 16px;
}

/* Section Headers */
.section-header {
  margin-bottom: 16px;
}

.section-header h1 {
  margin: 0 0 4px 0;
  color: #1e293b;
  font-weight: 600;
}

.section-header p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}

/* ==========================================================================
   COMPONENT SPECIFIC STYLES
   ========================================================================== */

/* Loading States */
.loading-state {
  padding: 32px 16px;
}

/* Error States */
.error-alert {
  margin-bottom: 16px;
}

/* Tabs */
.billing-tabs,
.payroll-tabs {
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 16px;
}

.tab-item {
  font-size: 0.85rem !important;
  text-transform: none !important;
  letter-spacing: 0.5px !important;
  min-width: auto !important;
}

/* Windows */
.billing-window,
.payroll-window {
  width: 100%;
}

/* Cards */
.fuel-card,
.maintenance-card {
  width: 100%;
  margin: 0 auto;
  max-width: 600px;
}

.fuel-alert,
.maintenance-alert {
  margin-top: 16px;
}

/* ==========================================================================
   RESPONSIVE BREAKPOINTS
   ========================================================================== */

/* Extra small devices (phones, < 576px) */
@media (max-width: 575.98px) {
  .content-wrapper {
    padding: 8px;
  }

  .section-header h1 {
    font-size: 1.25rem;
  }

  .section-header p {
    font-size: 0.8rem;
  }
}

/* Small devices (phones, 576px and up) */
@media (min-width: 576px) {
  .content-wrapper {
    padding: 16px;
  }

  .section-header h1 {
    font-size: 1.5rem;
  }

  .section-header p {
    font-size: 0.9rem;
  }
}

/* Medium devices (tablets, 768px and up) */
@media (min-width: 768px) {
  .content-wrapper {
    padding: 24px;
  }

  .section-header {
    margin-bottom: 20px;
  }

  .section-header h1 {
    font-size: 1.75rem;
  }

  .section-header p {
    font-size: 1rem;
  }

  .fuel-card,
  .maintenance-card {
    max-width: 700px;
  }

  .nav-tab span {
    display: inline !important;
  }
}

/* Large devices (desktops, 992px and up) */
@media (min-width: 992px) {
  .content-wrapper {
    padding: 32px;
  }

  .section-header h1 {
    font-size: 2rem;
  }

  .fuel-card,
  .maintenance-card {
    max-width: 800px;
  }
}

/* Extra large devices (large desktops, 1200px and up) */
@media (min-width: 1200px) {
  .content-wrapper {
    max-width: 1400px;
  }
}

/* 2XL devices (larger desktops, 1400px and up) */
@media (min-width: 1400px) {
  .content-wrapper {
    max-width: 1600px;
    padding: 40px;
  }
}

/* ==========================================================================
   DIALOG/MODAL STYLES
   ========================================================================== */

.edit-dialog .v-overlay__content {
  width: 95vw;
  max-width: 800px;
  margin: 16px;
}

@media (min-width: 640px) {
  .edit-dialog .v-overlay__content {
    width: 90vw;
    margin: 24px;
  }
}

@media (min-width: 768px) {
  .edit-dialog .v-overlay__content {
    width: auto;
    margin: 32px;
  }
}

/* ==========================================================================
   UTILITY CLASSES
   ========================================================================== */

.action-btn {
  white-space: nowrap;
}

/* Responsive utilities */
.d-none { display: none !important; }
.d-block { display: block !important; }
.d-flex { display: flex !important; }

.d-sm-none { display: none !important; }
.d-sm-block { display: block !important; }
.d-sm-flex { display: flex !important; }

.d-md-none { display: none !important; }
.d-md-block { display: block !important; }
.d-md-flex { display: flex !important; }

.d-lg-none { display: none !important; }
.d-lg-block { display: block !important; }
.d-lg-flex { display: flex !important; }

.d-xl-none { display: none !important; }
.d-xl-block { display: block !important; }
.d-xl-flex { display: flex !important; }

@media (min-width: 576px) {
  .d-sm-none { display: none !important; }
  .d-sm-block { display: block !important; }
  .d-sm-flex { display: flex !important; }
}

@media (min-width: 768px) {
  .d-md-none { display: none !important; }
  .d-md-block { display: block !important; }
  .d-md-flex { display: flex !important; }
}

@media (min-width: 992px) {
  .d-lg-none { display: none !important; }
  .d-lg-block { display: block !important; }
  .d-lg-flex { display: flex !important; }
}

@media (min-width: 1200px) {
  .d-xl-none { display: none !important; }
  .d-xl-block { display: block !important; }
  .d-xl-flex { display: flex !important; }
}

/* Flex utilities */
.flex-column { flex-direction: column !important; }
.flex-row { flex-direction: row !important; }
.flex-wrap { flex-wrap: wrap !important; }
.flex-nowrap { flex-wrap: nowrap !important; }

.justify-center { justify-content: center !important; }
.justify-between { justify-content: space-between !important; }
.justify-around { justify-content: space-around !important; }
.justify-end { justify-content: flex-end !important; }

.align-center { align-items: center !important; }
.align-start { align-items: flex-start !important; }
.align-end { align-items: flex-end !important; }

.text-center { text-align: center !important; }
.text-left { text-align: left !important; }
.text-right { text-align: right !important; }

/* Spacing utilities */
.gap-1 { gap: 0.25rem !important; }
.gap-2 { gap: 0.5rem !important; }
.gap-3 { gap: 1rem !important; }
.gap-4 { gap: 1.5rem !important; }

.m-0 { margin: 0 !important; }
.mt-1 { margin-top: 0.25rem !important; }
.mt-2 { margin-top: 0.5rem !important; }
.mt-3 { margin-top: 1rem !important; }
.mt-4 { margin-top: 1.5rem !important; }

.mb-1 { margin-bottom: 0.25rem !important; }
.mb-2 { margin-bottom: 0.5rem !important; }
.mb-3 { margin-bottom: 1rem !important; }
.mb-4 { margin-bottom: 1.5rem !important; }

.p-1 { padding: 0.25rem !important; }
.p-2 { padding: 0.5rem !important; }
.p-3 { padding: 1rem !important; }
.p-4 { padding: 1.5rem !important; }

/* Width utilities */
.w-full { width: 100% !important; }
.w-auto { width: auto !important; }

/* Height utilities */
.h-full { height: 100% !important; }
.h-auto { height: auto !important; }

/* Position utilities */
.relative { position: relative !important; }
.absolute { position: absolute !important; }
.fixed { position: fixed !important; }

/* Overflow utilities */
.overflow-hidden { overflow: hidden !important; }
.overflow-auto { overflow: auto !important; }
.overflow-scroll { overflow: scroll !important; }

/* ==========================================================================
   OVERRIDE VUETIFY DEFAULTS FOR MOBILE
   ========================================================================== */

/* Ensure no horizontal overflow */
.v-app {
  overflow-x: hidden !important;
}

.v-main {
  overflow-x: hidden !important;
}

/* Fix app bar positioning */
.v-app-bar {
  width: 100vw !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 1000 !important;
}

/* Ensure navigation drawer doesn't cause overflow */
.v-navigation-drawer {
  position: fixed !important;
  z-index: 1100 !important;
}

/* Fix any Vuetify component that might cause overflow */
.v-card,
.v-sheet,
.v-window,
.v-tabs {
  width: 100% !important;
  max-width: 100% !important;
}

/* Ensure tables don't overflow */
table {
  width: 100% !important;
  table-layout: fixed !important;
}

/* Prevent any component from causing horizontal scroll */
* {
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* Force viewport containment */
html {
  width: 100vw;
  overflow-x: hidden;
}

body {
  width: 100vw;
  overflow-x: hidden;
}
</style>

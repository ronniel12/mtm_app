<script setup>
import { ref, provide, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TripForm from './components/TripForm.vue'

const router = useRouter()
const route = useRoute()

// Check if current route is employee-only
const isEmployeeRoute = computed(() => {
  return route.path && route.path.startsWith('/employee/')
})

// Restore the edit trip functionality that was removed
const showEditTripDialog = ref(false)
const editTripData = ref(null)

// Restore the add trip functionality that was removed
const showAddTripDialog = ref(false)

// Global add trip functions (newly restored)
const openAddTripDialog = () => {
  showAddTripDialog.value = true
}

const closeAddTripDialog = () => {
  showAddTripDialog.value = false
}

const handleTripAddComplete = () => {
  showAddTripDialog.value = false
  // Reset any form data if needed
}

const mobileMenuOpen = ref(false)

// Global edit trip functions (needed for TripList communication)
const openEditTripDialog = (trip) => {
  editTripData.value = trip
  showEditTripDialog.value = true
}

const closeEditTripDialog = () => {
  showEditTripDialog.value = false
  editTripData.value = null
}

const handleTripEditComplete = () => {
  showEditTripDialog.value = false
  editTripData.value = null
  // Emit event or provide function to refresh data in other components
  // This will be handled by the individual components that need to refresh
}

// Provide global functions to child components
provide('globalEditTrip', {
  openEditTripDialog,
  closeEditTripDialog,
  handleTripEditComplete
})

// Provide global add trip functions
provide('globalAddTrip', {
  openAddTripDialog,
  closeAddTripDialog,
  handleTripAddComplete
})



// Mobile menu functions
const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const setActiveSectionMobile = (section) => {
  router.push('/' + section)
  mobileMenuOpen.value = false // Close mobile menu after selection
}
</script>

<template>
  <v-app :class="{ 'app-container': true, 'employee-route': isEmployeeRoute }">
    <!-- App Bar - Only show for admin routes -->
    <v-app-bar
      v-if="!isEmployeeRoute"
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
        class="d-none d-md-flex desktop-tabs"
        bg-color="transparent"
        slider-color="white"
        hide-slider
        density="compact"
        grow
      >
        <v-tab to="/" class="nav-tab">
          <v-icon size="16" start>mdi-view-dashboard</v-icon>
          <span class="d-none d-md-inline">Dashboard</span>
        </v-tab>
        <v-tab to="/payroll" class="nav-tab">
          <v-icon size="16" start>mdi-cash-multiple</v-icon>
          <span class="d-none d-md-inline">Payroll</span>
        </v-tab>
        <v-tab to="/trips" class="nav-tab">
          <v-icon size="16" start>mdi-truck</v-icon>
          <span class="d-none d-md-inline">Trips</span>
        </v-tab>
        <v-tab to="/billing" class="nav-tab">
          <v-icon size="16" start>mdi-receipt</v-icon>
          <span class="d-none d-md-inline">Billing</span>
        </v-tab>
        <v-tab to="/tolls" class="nav-tab">
          <v-icon size="16" start>mdi-road-variant</v-icon>
          <span class="d-none d-md-inline">Tolls</span>
        </v-tab>
        <v-tab to="/fuel" class="nav-tab">
          <v-icon size="16" start>mdi-gas-station</v-icon>
          <span class="d-none d-md-inline">Fuel</span>
        </v-tab>
        <v-tab to="/expenses" class="nav-tab">
          <v-icon size="16" start>mdi-cash-minus</v-icon>
          <span class="d-none d-md-inline">Expenses</span>
        </v-tab>
        <v-tab to="/maintenance" class="nav-tab">
          <v-icon size="16" start>mdi-wrench</v-icon>
          <span class="d-none d-md-inline">Maintenance</span>
        </v-tab>
        <v-tab to="/settings" class="nav-tab">
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

    <!-- Mobile Navigation Drawer - Only show for admin routes -->
    <v-navigation-drawer
      v-if="!isEmployeeRoute"
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
          @click="setActiveSectionMobile('')"
          value="dashboard"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-view-dashboard</v-icon></template>
          <v-list-item-title>Dashboard</v-list-item-title>
        </v-list-item>
        <v-list-item
          @click="setActiveSectionMobile('payroll')"
          value="payroll"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-cash-multiple</v-icon></template>
          <v-list-item-title>Payroll</v-list-item-title>
        </v-list-item>
        <v-list-item
          @click="setActiveSectionMobile('trips')"
          value="trips"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-truck</v-icon></template>
          <v-list-item-title>Trips</v-list-item-title>
        </v-list-item>
        <v-list-item
          @click="setActiveSectionMobile('billing')"
          value="billing"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-receipt</v-icon></template>
          <v-list-item-title>Billing</v-list-item-title>
        </v-list-item>
        <v-list-item
          @click="setActiveSectionMobile('tolls')"
          value="tolls"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-road-variant</v-icon></template>
          <v-list-item-title>Tolls</v-list-item-title>
        </v-list-item>
        <v-list-item
          @click="setActiveSectionMobile('fuel')"
          value="fuel"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-gas-station</v-icon></template>
          <v-list-item-title>Fuel</v-list-item-title>
        </v-list-item>
        <v-list-item
          @click="setActiveSectionMobile('expenses')"
          value="expenses"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-cash-minus</v-icon></template>
          <v-list-item-title>Expenses</v-list-item-title>
        </v-list-item>
        <v-list-item
          @click="setActiveSectionMobile('maintenance')"
          value="maintenance"
          class="drawer-item"
        >
          <template #prepend><v-icon>mdi-wrench</v-icon></template>
          <v-list-item-title>Maintenance</v-list-item-title>
        </v-list-item>
        <v-list-item
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
      <!-- This will render the matched route component -->
      <router-view />
    </v-main>

    <!-- Global Add Trip Dialog -->
    <v-dialog v-model="showAddTripDialog" max-width="90vw" width="800" persistent class="edit-dialog">
      <v-card>
        <v-card-title class="d-flex align-center pa-3 pa-md-6">
          <v-icon start>mdi-plus</v-icon>
          <span class="text-h6 text-md-h5">Add New Trip</span>
        </v-card-title>
        <v-card-text class="pa-3 pa-md-6">
          <TripForm
            :key="`add-${Date.now()}`"
            @tripAdded="handleTripAddComplete"
            @cancel="closeAddTripDialog"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Global Edit Trip Dialog -->
    <v-dialog v-model="showEditTripDialog" max-width="90vw" width="800" persistent class="edit-dialog">
      <v-card>
        <v-card-title class="d-flex align-center pa-3 pa-md-6">
          <v-icon start>mdi-pencil</v-icon>
          <span class="text-h6 text-md-h5">Edit Trip</span>
        </v-card-title>
        <v-card-text class="pa-3 pa-md-6">
          <TripForm
            :key="`edit-${editTripData?.id || 'none'}`"
            :editTrip="editTripData"
            @tripAdded="handleTripEditComplete"
            @cancel="closeEditTripDialog"
          />
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
  padding-top: 80px !important; /* Account for fixed app bar + spacing for admin routes */
  background: #f8fafc;
  position: relative;
  z-index: 1;
}

/* Employee routes don't have admin navigation, so remove padding-top */
.employee-route .main-content {
  padding-top: 0 !important;
  min-height: 100vh;
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

/* Prevent any component from causing horizontal scroll - but allow Vuetify scroll targets */
/* Exclude Vuetify components that need proper scroll behavior */
*:not(.v-overlay):not(.v-overlay__content):not(.v-menu):not(.v-menu__content):not(.v-dialog):not(.v-dialog__content) {
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

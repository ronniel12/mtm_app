<template>
<div class="content-section">
  <v-tabs v-model="activeTab" class="mb-3 mb-md-4 billing-tabs">
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
  <v-window v-model="activeTab" class="billing-window">
    <v-window-item value="create">
      <router-view />
    </v-window-item>
    <v-window-item value="history">
      <router-view />
    </v-window-item>
  </v-window>
</div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeTab = ref('create')

const updateTabFromRoute = () => {
  // Set activeTab based on the current child route
  if (route.path.includes('/history')) {
    activeTab.value = 'history'
  } else {
    activeTab.value = 'create'
  }
}

const navigateToTab = (tab) => {
  if (tab === 'create') {
    router.push('/billing/create')
  } else if (tab === 'history') {
    router.push('/billing/history')
  }
}

// Watch for route changes to update active tab
watch(() => route.path, updateTabFromRoute)

// Watch for tab changes to navigate
watch(activeTab, (newTab) => {
  navigateToTab(newTab)
})

// Initialize on mount
onMounted(() => {
  updateTabFromRoute()
})
</script>

<style scoped>
.billing-tabs {
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

.billing-window {
  width: 100%;
}
</style>

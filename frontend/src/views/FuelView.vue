<template>
  <div class="content-wrapper">
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
</template>

<style scoped>
.content-wrapper {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.fuel-card {
  width: 100%;
  margin: 0 auto;
  max-width: 600px;
}

.fuel-alert {
  margin-top: 16px;
}
</style>

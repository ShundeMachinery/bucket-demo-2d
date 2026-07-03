<script setup lang="ts">
import { watchEffect } from 'vue'
import { currentRoute } from './router'
import ConfiguratorView from './views/ConfiguratorView.vue'
import DataManagerView from './views/DataManagerView.vue'

watchEffect(() => {
  document.title = `${currentRoute.value.title} | Bucket Demo`
})
</script>

<template>
  <ConfiguratorView v-if="currentRoute.name === 'configurator'" />
  <DataManagerView v-else />
</template>

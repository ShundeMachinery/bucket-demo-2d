<script setup lang="ts">
import DataManager from '../components/DataManager.vue'
import { navigateTo } from '../router'
</script>

<template>
  <main class="min-h-screen bg-iron-950">
    <div class="border-b border-white/10 bg-iron-950 px-6 py-4">
      <button type="button" class="tool-button" @click="navigateTo('configurator')">返回展示台</button>
    </div>
    <DataManager />
  </main>
</template>

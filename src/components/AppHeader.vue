<script setup lang="ts">
</script>

<template>
  <header id="app-header" class="app-header">
    <span id="pro-badge" class="pro-badge">PRO</span>
    <div id="avatar" class="avatar">
      <span id="avatar-text" class="avatar-text">锋</span>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
}

.pro-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--badge-bg);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--badge-text);
  letter-spacing: 0.02em;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--avatar-from), var(--avatar-to));
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  line-height: 1;
}
</style>

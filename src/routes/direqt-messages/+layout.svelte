<script lang="ts">
  let { children } = $props();
</script>

<div class="h-full flex flex-col min-h-0">
  {@render children()}
</div>

<script lang="ts">
  import { _ } from '../i18n';
  
  interface Props {
    key?: string;
    fallback?: string;
    values?: Record<string, any>;
  }
  
  let { key, fallback, values }: Props = $props();
  
  // Get the translation text
  const text = $derived(() => {
    // If only fallback is provided, use it as both key and fallback
    const translationKey = key || fallback || '';
    const defaultText = fallback || key || '';
    
    if (!translationKey) return defaultText;
    
    // Use svelte-i18n's $_ function with default fallback
    return $_(`${translationKey}`, { default: defaultText, values });
  });
</script>

{text()}

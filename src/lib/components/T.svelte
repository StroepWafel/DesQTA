<script lang="ts">
  import { _, locale } from '../i18n';

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

    // Check if locale is initialized, if not return fallback
    if (!$locale) return defaultText;

    try {
      // Use svelte-i18n's $_ function with default fallback
      return $_(`${translationKey}`, { default: defaultText, values });
    } catch (error) {
      // If translation fails, return fallback
      return defaultText;
    }
  });
</script>

{text()}

import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

export interface SidebarState {
  open: boolean;
  autoCollapse: boolean;
  autoExpandOnHover: boolean;
}

/**
 * Sidebar composable for managing sidebar state and behavior
 * Returns state object that can be used with $state() in Svelte components
 */
export function useSidebar() {
  const state: SidebarState = {
    open: true,
    autoCollapse: false,
    autoExpandOnHover: false,
  };

  const loadSettings = async () => {
    try {
      const subset = await invoke<{
        auto_collapse_sidebar?: boolean;
        auto_expand_sidebar_hover?: boolean;
      }>('get_settings_subset', {
        keys: ['auto_collapse_sidebar', 'auto_expand_sidebar_hover'],
      });
      state.autoCollapse = subset?.auto_collapse_sidebar ?? false;
      state.autoExpandOnHover = subset?.auto_expand_sidebar_hover ?? false;
    } catch (e) {
      logger.error('sidebar', 'loadSettings', `Failed to load sidebar settings: ${e}`, { error: e });
    }
  };

  const handlePageNavigation = () => {
    if (state.autoCollapse) {
      state.open = false;
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (state.autoExpandOnHover) {
      const x = event.clientX;
      if (!state.open && x <= 20) {
        state.open = true;
      } else if (state.open && x > 280) {
        state.open = false;
      }
    }
  };

  return {
    state,
    loadSettings,
    handlePageNavigation,
    handleMouseMove,
  };
}


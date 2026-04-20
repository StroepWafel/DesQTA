import { invoke } from '@tauri-apps/api/core';
import { weatherService, type WeatherData } from '$lib/services/weatherService';
import { logger } from '../../utils/logger';

export interface WeatherState {
  enabled: boolean;
  forceUseLocation: boolean;
  city: string;
  country: string;
  data: WeatherData | null;
  loading: boolean;
  error: string;
}

/** Mock weather data for demo/sensitive-info-hider mode */
const MOCK_WEATHER_DATA: WeatherData = {
  temperature: 22,
  weathercode: 0,
  location: 'Demo City',
  country: 'AU',
  forecast: [
    { date: '2025-12-31', tempMax: 24, tempMin: 18, weathercode: 0 },
    { date: '2026-01-01', tempMax: 23, tempMin: 17, weathercode: 1 },
    { date: '2026-01-02', tempMax: 25, tempMin: 19, weathercode: 2 },
  ],
};

/**
 * Weather composable for managing weather state and fetching
 * Returns reactive state object that can be used with $state() in Svelte components
 */
export function useWeather() {
  const state: WeatherState = {
    enabled: false,
    forceUseLocation: true,
    city: '',
    country: '',
    data: null,
    loading: false,
    error: '',
  };

  const loadSettings = async () => {
    const settings = await weatherService.loadWeatherSettings();
    state.enabled = settings.weather_enabled;
    state.city = settings.weather_city;
    state.country = settings.weather_country ?? '';
    state.forceUseLocation = settings.force_use_location;

    // When mock/demo mode is on, always show weather widget with mock data
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['dev_sensitive_info_hider'],
      });
      if (subset?.dev_sensitive_info_hider) {
        state.enabled = true;
        state.data = MOCK_WEATHER_DATA;
      }
    } catch {
      // Ignore - use normal settings
    }
  };

  const fetchWeather = async (useIP = false) => {
    if (!state.enabled || (!useIP && !state.city)) {
      state.data = null;
      return;
    }

    state.loading = true;
    state.error = '';
    try {
      state.data = useIP
        ? await weatherService.fetchWeatherWithIP()
        : await weatherService.fetchWeather(state.city, state.country);
    } catch (e) {
      state.error = `Failed to load weather: ${e}`;
      state.data = null;
      logger.error('weather', 'fetchWeather', `Failed to load weather: ${e}`, { error: e });
    } finally {
      state.loading = false;
    }
  };

  return {
    state,
    loadSettings,
    fetchWeather,
  };
}


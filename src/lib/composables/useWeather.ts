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


<script lang="ts">
  import { onMount } from 'svelte';
  import { Cloud } from 'svelte-hero-icons';
  import { weatherService } from '../../services/weatherService';
  import type { WeatherData } from '../../services/weatherService';
  import { logger } from '../../../utils/logger';
  import WidgetCard from '../dashboard/WidgetCard.svelte';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  let weatherData = $state<WeatherData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const location = $derived(settings.location || '');
  const units = $derived(settings.units || 'celsius');
  const showForecast = $derived(settings.showForecast !== false);
  const gridH = $derived(widget?.position?.h ?? 3);
  const isCompact = $derived(gridH <= 3);
  const isTall = $derived(gridH >= 5);

  function getWeatherIcon(code: number): string {
    if (code === 0) return '☀️';
    if (code === 1 || code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '⛈️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95 && code <= 99) return '⛈️';
    return '☁️';
  }

  function convertTemperature(temp: number): number {
    if (units === 'fahrenheit') return Math.round((temp * 9) / 5 + 32);
    return Math.round(temp);
  }

  function getTemperatureUnit(): string {
    return units === 'fahrenheit' ? '°F' : '°C';
  }

  function formatForecastDate(isoDate: string): string {
    const d = new Date(isoDate + 'T12:00:00');
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  async function loadWeather() {
    loading = true;
    error = null;
    try {
      if (location) {
        const [city, country] = location.split(',').map((s: string) => s.trim());
        weatherData = await weatherService.fetchWeather(city, country || '');
      } else {
        weatherData = await weatherService.fetchWeatherWithIP();
      }
      if (!weatherData) error = 'Unable to load weather data';
    } catch (e) {
      logger.error('WeatherWidget', 'loadWeather', `Failed to load weather: ${e}`, { error: e });
      error = 'Failed to load weather';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadWeather();
  });

  $effect(() => {
    if (location || !location) loadWeather();
  });
</script>

<WidgetCard
  icon={Cloud}
  title="Weather"
  {loading}
  empty={!loading && !error && !weatherData}
  emptyTitle="No weather data"
  emptyIcon={Cloud}
  class={isCompact ? 'weather-compact' : ''}>
  {#if error}
    <div class="flex flex-col items-center justify-center h-full min-h-0">
      <p class="text-sm text-destructive">{error}</p>
      <button
        onclick={loadWeather}
        class="mt-2 inline-flex items-center justify-center h-7 px-3 text-xs font-medium rounded-md bg-surface-muted text-foreground hover:bg-surface-3 transition-colors duration-150">
        Retry
      </button>
    </div>
  {:else if weatherData}
    <div class="flex flex-col h-full min-h-0 {isTall ? 'gap-4' : 'gap-2'}">
      <div class="flex items-center gap-2.5 shrink-0 {isTall ? 'sm:gap-4' : ''}">
        <div class="{isCompact ? 'text-2xl' : isTall ? 'text-4xl' : 'text-3xl'} leading-none shrink-0">
          {getWeatherIcon(weatherData.weathercode)}
        </div>
        <div class="flex-1 min-w-0">
          <div
            class="font-semibold tracking-tight text-foreground nums-tabular leading-none {isCompact
              ? 'text-xl'
              : isTall
                ? 'text-3xl'
                : 'text-2xl'}">
            {convertTemperature(weatherData.temperature)}{getTemperatureUnit()}
          </div>
          <div class="text-[11px] text-muted-foreground truncate mt-0.5">
            {weatherData.location}, {weatherData.country}
          </div>
        </div>
        {#if isTall && weatherData.forecast?.[0]}
          <div class="hidden sm:block text-right shrink-0 pl-2">
            <p class="text-[10px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
              Today
            </p>
            <p class="text-sm font-semibold text-foreground nums-tabular">
              {convertTemperature(weatherData.forecast[0].tempMax)}° /
              {convertTemperature(weatherData.forecast[0].tempMin)}°
            </p>
          </div>
        {/if}
      </div>

      {#if showForecast && weatherData.forecast?.length}
        <div
          class="border-t border-border-subtle flex-1 min-h-0 flex flex-col {isCompact
            ? 'pt-1.5'
            : 'pt-2'}">
          <p
            class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground shrink-0 {isCompact
              ? 'mb-1'
              : 'mb-1.5'}">
            7-day forecast
          </p>
          <div
            class="grid grid-cols-7 gap-0.5 flex-1 min-h-0 min-w-0 {isTall ? 'gap-1' : ''}"
            style="grid-template-rows: 1fr;">
            {#each weatherData.forecast.slice(0, 7) as day}
              <div
                class="flex flex-col items-center justify-center min-w-0 min-h-0 w-full rounded-md bg-surface-muted {isCompact
                  ? 'px-0.5 py-1'
                  : 'px-1 py-1.5'}">
                <span class="text-[9px] sm:text-[10px] text-muted-foreground truncate w-full text-center leading-tight">
                  {formatForecastDate(day.date)}
                </span>
                <span class="{isCompact ? 'text-xs' : 'text-sm'} leading-none {isCompact ? 'my-0.5' : 'mt-0.5'}">
                  {getWeatherIcon(day.weathercode)}
                </span>
                <span class="text-[10px] font-semibold text-foreground nums-tabular leading-tight">
                  {convertTemperature(day.tempMax)}°
                </span>
                {#if !isCompact}
                  <span class="text-[9px] text-muted-foreground nums-tabular leading-tight">
                    {convertTemperature(day.tempMin)}°
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</WidgetCard>

<style>
  :global(.weather-compact .flex-1.min-h-0.overflow-hidden) {
    padding-top: 0.5rem;
    padding-bottom: 0.625rem;
  }
</style>

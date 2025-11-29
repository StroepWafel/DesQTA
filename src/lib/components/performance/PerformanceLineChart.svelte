<script lang="ts">
  import { onMount } from 'svelte';
  
  interface DataPoint {
    name: string;
    value: number;
    time?: number;
  }

  interface Props {
    data: DataPoint[];
    title: string;
    valueLabel: string;
    color?: string;
    height?: number;
    showGrid?: boolean;
  }

  let { 
    data, 
    title, 
    valueLabel, 
    color = 'rgb(var(--accent-color-value))', 
    height = 200,
    showGrid = true 
  }: Props = $props();

  let svgElement: SVGSVGElement;
  let width = $state(0);
  let mounted = $state(false);

  onMount(() => {
    mounted = true;
    const resizeObserver = new ResizeObserver(() => {
      if (svgElement) {
        width = svgElement.clientWidth;
      }
    });
    
    if (svgElement) {
      resizeObserver.observe(svgElement);
      width = svgElement.clientWidth;
    }
    
    return () => resizeObserver.disconnect();
  });

  // Chart dimensions and padding
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  
  const chartWidth = $derived(width - padding.left - padding.right);
  const chartHeight = $derived(height - padding.top - padding.bottom);

  // Calculate scales
  const xScale = $derived(data.length > 1 ? chartWidth / (data.length - 1) : 0);
  const maxValue = $derived(Math.max(...data.map(d => d.value), 0));
  const minValue = $derived(Math.min(...data.map(d => d.value), 0));
  const valueRange = $derived(maxValue - minValue || 1);
  const yScale = $derived((value: number) => chartHeight - ((value - minValue) / valueRange) * chartHeight);

  // Generate path data
  const pathData = $derived(data.length > 0 ? 
    `M ${data.map((d, i) => `${i * xScale},${yScale(d.value)}`).join(' L ')}` : '');

  // Generate area path data
  const areaData = $derived(data.length > 0 ? 
    `M ${data.map((d, i) => `${i * xScale},${yScale(d.value)}`).join(' L ')} L ${(data.length - 1) * xScale},${chartHeight} L 0,${chartHeight} Z` : '');

  // Y-axis ticks
  const yTicks = $derived(Array.from({ length: 6 }, (_, i) => {
    const value = minValue + (valueRange * i) / 5;
    return {
      value,
      y: yScale(value),
      label: formatValue(value)
    };
  }));

  function formatValue(value: number): string {
    if (valueLabel.includes('ms') || valueLabel.includes('time')) {
      return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
    }
    if (valueLabel.includes('MB') || valueLabel.includes('memory')) {
      return `${value.toFixed(1)}MB`;
    }
    if (valueLabel.includes('%')) {
      return `${Math.round(value)}%`;
    }
    return Math.round(value).toString();
  }

  function formatXLabel(index: number): string {
    if (data[index]?.name) {
      // Truncate long page names
      const name = data[index].name;
      return name.length > 8 ? name.slice(0, 8) + '...' : name;
    }
    return `${index + 1}`;
  }
</script>

<div class="w-full">
  <h3 class="text-sm font-semibold text-zinc-900 dark:text-white mb-3">{title}</h3>
  <div class="relative">
    <svg
      bind:this={svgElement}
      class="w-full"
      {height}
      viewBox="0 0 {width} {height}"
      style="background: transparent;"
    >
      {#if mounted && width > 0 && data.length > 0}
        <g transform="translate({padding.left}, {padding.top})">
          <!-- Grid lines -->
          {#if showGrid}
            {#each yTicks as tick}
              <line
                x1="0"
                y1={tick.y}
                x2={chartWidth}
                y2={tick.y}
                stroke="rgb(156 163 175 / 0.3)"
                stroke-width="1"
                stroke-dasharray="2,2"
              />
            {/each}
          {/if}

          <!-- Area fill -->
          <path
            d={areaData}
            fill="url(#gradient-{title.replace(/\s+/g, '-')})"
            opacity="0.3"
          />

          <!-- Line -->
          <path
            d={pathData}
            fill="none"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Data points -->
          {#each data as point, i}
            <circle
              cx={i * xScale}
              cy={yScale(point.value)}
              r="4"
              fill={color}
              stroke="white"
              stroke-width="2"
              class="hover:r-6 transition-all duration-200"
            >
              <title>{point.name}: {formatValue(point.value)}</title>
            </circle>
          {/each}

          <!-- Y-axis -->
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={chartHeight}
            stroke="rgb(156 163 175)"
            stroke-width="1"
          />

          <!-- Y-axis labels -->
          {#each yTicks as tick}
            <text
              x="-10"
              y={tick.y}
              text-anchor="end"
              dominant-baseline="middle"
              class="text-xs fill-zinc-600 dark:fill-zinc-400"
            >
              {tick.label}
            </text>
          {/each}

          <!-- X-axis -->
          <line
            x1="0"
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="rgb(156 163 175)"
            stroke-width="1"
          />

          <!-- X-axis labels -->
          {#each data as point, i}
            {#if i % Math.ceil(data.length / 8) === 0 || i === data.length - 1}
              <text
                x={i * xScale}
                y={chartHeight + 20}
                text-anchor="middle"
                class="text-xs fill-zinc-600 dark:fill-zinc-400"
              >
                {formatXLabel(i)}
              </text>
            {/if}
          {/each}
        </g>

        <!-- Gradient definition -->
        <defs>
          <linearGradient id="gradient-{title.replace(/\s+/g, '-')}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color={color} stop-opacity="0.8" />
            <stop offset="100%" stop-color={color} stop-opacity="0.1" />
          </linearGradient>
        </defs>
      {:else if data.length === 0}
        <g transform="translate({width/2}, {height/2})">
          <text
            text-anchor="middle"
            dominant-baseline="middle"
            class="text-sm fill-zinc-500 dark:fill-zinc-400"
          >
            No data available
          </text>
        </g>
      {/if}
    </svg>
  </div>
</div>

<style>
  svg {
    overflow: visible;
  }
</style>

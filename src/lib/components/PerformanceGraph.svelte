<script lang="ts">
  interface Props {
    data: Array<{ timestamp: number; value: number }>;
    label: string;
    color?: string;
    height?: number;
    maxValue?: number;
  }

  let {
    data = $bindable([]),
    label,
    color = '#3b82f6',
    height = 150,
    maxValue,
  }: Props = $props();

  let width = $state(600);
  let svgRef: SVGSVGElement;

  $effect(() => {
    if (svgRef) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          width = entry.contentRect.width;
        }
      });
      resizeObserver.observe(svgRef);
      return () => resizeObserver.disconnect();
    }
  });

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  
  let chartWidth = $derived(width - padding.left - padding.right);
  let chartHeight = $derived(height - padding.top - padding.bottom);

  let maxVal = $derived(maxValue ?? (data.length > 0 ? Math.max(...data.map(d => d.value), 100) : 100));
  let minVal = $derived(data.length > 0 ? Math.min(...data.map(d => d.value), 0) : 0);

  function xScale(val: number): number {
    if (data.length === 0) return 0;
    const minTime = Math.min(...data.map(d => d.timestamp));
    const maxTime = Math.max(...data.map(d => d.timestamp));
    const range = maxTime - minTime || 1;
    return ((val - minTime) / range) * chartWidth;
  }

  function yScale(val: number): number {
    const range = maxVal - minVal || 1;
    return chartHeight - ((val - minVal) / range) * chartHeight;
  }

  let pathData = $derived(() => {
    if (data.length === 0) return '';
    const points = data.map((d, i) => {
      const x = padding.left + xScale(d.timestamp);
      const y = padding.top + yScale(d.value);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return points.join(' ');
  });

  let areaPathData = $derived(() => {
    if (data.length === 0) return '';
    const points = data.map((d, i) => {
      const x = padding.left + xScale(d.timestamp);
      const y = padding.top + yScale(d.value);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    const lastPoint = data[data.length - 1];
    const firstPoint = data[0];
    return `${points.join(' ')} L ${padding.left + xScale(lastPoint.timestamp)} ${padding.top + chartHeight} L ${padding.left + xScale(firstPoint.timestamp)} ${padding.top + chartHeight} Z`;
  });
</script>

<div class="w-full">
  <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</div>
  <svg
    bind:this={svgRef}
    class="w-full"
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none">
    <!-- Grid lines -->
    {#each Array(5) as _, i}
      {@const y = padding.top + (chartHeight / 4) * i}
      <line
        x1={padding.left}
        y1={y}
        x2={width - padding.right}
        y2={y}
        stroke="currentColor"
        stroke-opacity="0.1"
        stroke-width="1" />
      {@const value = maxVal - (maxVal - minVal) * (i / 4)}
      <text
        x={padding.left - 10}
        y={y + 4}
        class="text-xs fill-white"
        text-anchor="end">{value.toFixed(1)}</text>
    {/each}

    <!-- Y-axis label -->
    <text
      x={padding.left / 2}
      y={height / 2}
      class="text-xs fill-white"
      text-anchor="middle"
      transform="rotate(-90 {padding.left / 2} {height / 2})">Value</text>

    <!-- Area fill -->
    {#if data.length > 0}
      <path
        d={areaPathData}
        fill={color}
        fill-opacity="0.2" />
    {/if}

    <!-- Line -->
    {#if data.length > 0}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round" />
    {/if}

    <!-- Data points -->
    {#each data as point, i}
      {@const x = padding.left + xScale(point.timestamp)}
      {@const y = padding.top + yScale(point.value)}
      <circle
        cx={x}
        cy={y}
        r="3"
        fill={color}
        stroke="white"
        stroke-width="1" />
    {/each}

    <!-- X-axis -->
    <line
      x1={padding.left}
      y1={height - padding.bottom}
      x2={width - padding.right}
      y2={height - padding.bottom}
      stroke="currentColor"
      stroke-opacity="0.3"
      stroke-width="1" />

    <!-- Y-axis -->
    <line
      x1={padding.left}
      y1={padding.top}
      x2={padding.left}
      y2={height - padding.bottom}
      stroke="currentColor"
      stroke-opacity="0.3"
      stroke-width="1" />
  </svg>
</div>

<style>
  svg {
    color: rgb(161 161 170); /* zinc-400 */
  }
</style>


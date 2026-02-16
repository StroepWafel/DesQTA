<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import SelectScrollUpButton from "./select-scroll-up-button.svelte";
	import SelectScrollDownButton from "./select-scroll-down-button.svelte";
	import { cn, type WithoutChild } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		portalProps,
		children,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: SelectPrimitive.PortalProps;
	} = $props();
</script>

<SelectPrimitive.Portal {...portalProps}>
	<SelectPrimitive.Content
		bind:ref
		{sideOffset}
		data-slot="select-content"
		class={cn(
			"text-zinc-900 dark:text-white backdrop-blur-md bg-white/95 dark:bg-zinc-800/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 h-24 origin-(--bits-select-content-transform-origin) relative z-50 min-w-32 max-w-80 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
			className
		)}
		style="animation-duration: 200ms; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);"
		{...restProps}
	>
		<SelectScrollUpButton />
		<SelectPrimitive.Viewport
			class={cn(
				"p-1 h-full overflow-y-auto overflow-x-hidden"
			)}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
		<SelectScrollDownButton />
	</SelectPrimitive.Content>
</SelectPrimitive.Portal>

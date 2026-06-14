/**
 * Move an element to a portal target (default: document.body) so fixed overlays
 * escape nested stacking contexts (e.g. grid-stack transforms, `isolate` on main).
 */
export function portal(node: HTMLElement, target: string | HTMLElement = 'body') {
  const resolveTarget = () => {
    if (typeof target === 'string') {
      return (document.querySelector(target) as HTMLElement | null) ?? document.body;
    }
    return target;
  };

  let targetEl = resolveTarget();
  targetEl.appendChild(node);

  return {
    update(next: string | HTMLElement = 'body') {
      target = next;
      const nextTarget = resolveTarget();
      if (nextTarget !== targetEl) {
        nextTarget.appendChild(node);
        targetEl = nextTarget;
      }
    },
    destroy() {
      node.remove();
    },
  };
}

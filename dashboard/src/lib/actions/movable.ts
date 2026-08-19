import type { Action } from 'svelte/action';

type MovableOptions = {
	/**
	 * Restrict dragging to a single axis.
	 */
	axis?: 'x' | 'y' | 'xy';

	onMoveStart?: (event: CustomEvent<{ x: number; y: number }>) => void;
	onMove?: (event: CustomEvent<{ x: number; y: number; dx: number; dy: number }>) => void;
	onMoveEnd?: (event: CustomEvent<{ x: number; y: number }>) => void;
};

/**
 * Svelte action that makes an element draggable. Dispatches CustomEvents with
 * `detail` payloads on move start / move / move end (matching LayerChart's
 * `movable` action used in the ForceSimulation graph-drag example).
 *
 * Uses pointer events and stops `pointerdown` propagation so it can be used
 * inside a LayerChart `TransformContext` without also starting a background
 * pan when grabbing a node.
 */
export const movable: Action<HTMLElement | SVGElement, MovableOptions | undefined> = (
	node,
	options = {}
) => {
	let lastX = 0;
	let lastY = 0;
	let moved = false;

	function onPointerDown(event: PointerEvent) {
		lastX = event.clientX;
		lastY = event.clientY;
		moved = false;
		// Don't let the chart's TransformContext start a pan when grabbing a node.
		event.stopPropagation();
		options?.onMoveStart?.(new CustomEvent('movestart', { detail: { x: lastX, y: lastY } }));
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	}

	function onPointerMove(event: PointerEvent) {
		moved = true;
		const dx = event.clientX - lastX;
		const dy = event.clientY - lastY;
		const xEnabled = options?.axis?.includes('x') ?? true;
		const yEnabled = options?.axis?.includes('y') ?? true;
		lastX = event.clientX;
		lastY = event.clientY;
		if ((xEnabled && dx) || (yEnabled && dy)) {
			options?.onMove?.(
				new CustomEvent('move', {
					detail: { x: lastX, y: lastY, dx: xEnabled ? dx : 0, dy: yEnabled ? dy : 0 }
				})
			);
		}
	}

	function onPointerUp(event: PointerEvent) {
		lastX = event.clientX;
		lastY = event.clientY;
		options?.onMoveEnd?.(new CustomEvent('moveend', { detail: { x: lastX, y: lastY } }));
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
	}

	function onClick(event: MouseEvent) {
		if (moved) event.stopImmediatePropagation();
	}

	// Cast to HTMLElement so the DOM overloads resolve cleanly for the
	// `HTMLElement | SVGElement` union.
	const el = node as HTMLElement;
	el.addEventListener('pointerdown', onPointerDown);
	el.addEventListener('click', onClick);

	return {
		destroy() {
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('click', onClick);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		}
	};
};

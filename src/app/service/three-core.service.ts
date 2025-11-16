import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ViewportSize } from '../models/view.model';

@Injectable({
	providedIn: 'root',
})
export class ThreeCoreService {

	/**
	 * Creates and returns a new Three.js Scene.
	 * The scene acts as the root container for all 3D objects.
	 */
	createScene(): THREE.Scene {
		return new THREE.Scene();
	}

	/**
	 * Creates a PerspectiveCamera with the given field of view
	 * and screen aspect ratio. The caller is responsible for positioning it.
	 *
	 * @param fov - Field of view in degrees.
	 * @param sizes - Viewport width and height.
	 */
	createPerspectiveCamera(
		fov: number,
		sizes: ViewportSize,
	): THREE.PerspectiveCamera {
		return new THREE.PerspectiveCamera(fov, sizes.width / sizes.height);
	}

	/**
	 * Creates a WebGL renderer using the provided canvas.
	 * Sets the renderer resolution based on the viewport size.
	 *
	 * @param canvas - The canvas where WebGL will draw.
	 * @param sizes - Width and height for the renderer.
	 */
	createRenderer(
		canvas: HTMLCanvasElement,
		sizes: ViewportSize,
	): THREE.WebGLRenderer {
		try {
			const renderer = new THREE.WebGLRenderer({ canvas });

			// Set renderer resolution
			renderer.setSize(sizes.width, sizes.height);

			// Optional: improve sharpness on high-DPI screens
			// renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

			return renderer;
		} catch (e) {
			console.error('Failed to create WebGLRenderer', e);
			throw e;
		}
	}

	/**
	 * Creates OrbitControls bound to the given camera and canvas.
	 * Enables damping for smoother interactions.
	 *
	 * @param camera - Camera to control.
	 * @param canvas - Canvas used for mouse / touch interaction.
	 */
	createOrbitControls(
		camera: THREE.PerspectiveCamera,
		canvas: HTMLCanvasElement,
	): OrbitControls {
		const controls = new OrbitControls(camera, canvas);
		controls.enableDamping = true;
		return controls;
	}

	/**
	 * Updates camera and renderer when the viewport size changes.
	 * If sizes are not provided, it falls back to window dimensions.
	 *
	 * @param camera - Camera whose projection needs to be updated.
	 * @param renderer - Renderer whose size needs to be updated.
	 * @param sizes - Optional explicit width/height.
	 */
	updateOnResize(
		camera: THREE.PerspectiveCamera,
		renderer: THREE.WebGLRenderer,
		sizes?: ViewportSize,
	): void {
		const width = sizes?.width ?? window.innerWidth;
		const height = sizes?.height ?? window.innerHeight;

		camera.aspect = width / height;
		camera.updateProjectionMatrix();

		renderer.setSize(width, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	}
}

import { Injectable } from '@angular/core';
import * as THREE from 'three';
import GUI from 'lil-gui';
import gsap from 'gsap';

@Injectable({
	providedIn: 'root',
})
export class DebugGuiService {
	/**
	 * Creates a lil-gui instance configured to control a group
	 * (position, scale, rotation), toggle axes visibility and
	 * make the camera look at the group's position.
	 *
	 * @param group - Target group to transform.
	 * @param axesHelper - Axes helper that can be shown/hidden.
	 * @param camera - Camera used for lookAt() helper.
	 */
	createTransformGui(
		group: THREE.Group,
		axesHelper: THREE.AxesHelper,
		camera: THREE.PerspectiveCamera,
	): GUI {
		const gui = new GUI();

		const debugObject = {
			axesVisible: true,
			lookAtGroup: () => {
				camera.lookAt(group.position);
			},
		};

		const groupFolder = gui.addFolder('Group');

		// Position controls
		const posFolder = groupFolder.addFolder('Position');
		posFolder.add(group.position, 'x', -5, 5, 0.01);
		posFolder.add(group.position, 'y', -5, 5, 0.01);
		posFolder.add(group.position, 'z', -5, 5, 0.01);

		// Scale controls
		const scaleFolder = groupFolder.addFolder('Scale');
		scaleFolder.add(group.scale, 'x', 0.1, 5, 0.01);
		scaleFolder.add(group.scale, 'y', 0.1, 5, 0.01);
		scaleFolder.add(group.scale, 'z', 0.1, 5, 0.01);

		// Rotation controls (radians)
		const rotFolder = groupFolder.addFolder('Rotation (rad)');
		rotFolder.add(group.rotation, 'x', 0, Math.PI * 2, 0.01);
		rotFolder.add(group.rotation, 'y', 0, Math.PI * 2, 0.01);
		rotFolder.add(group.rotation, 'z', 0, Math.PI * 2, 0.01);

		// Axes visibility toggle
		groupFolder
			.add(debugObject, 'axesVisible')
			.name('Show axes')
			.onChange((value: boolean) => (axesHelper.visible = value));

		// Camera lookAt helper
		groupFolder.add(debugObject, 'lookAtGroup').name('Camera lookAt group');

		groupFolder.open();

		return gui;
	}


	/**
   * GUI specifically for animations:
   * - spin speed
   * - circular motion
   * - orbit radius
   * - GSAP tweens
   */
	createAnimationGui(
		gui: GUI,
		targetMesh: THREE.Mesh,
		animationConfig: {
			spinSpeed: number;
			circularMotion: boolean;
			orbitRadius: number;
		}
	): GUI {
		const animFolder = gui.addFolder('Animation');

		animFolder
			.add(animationConfig, 'spinSpeed', -5, 5, 0.1)
			.name('Spin speed (rad/s)');

		animFolder
			.add(animationConfig, 'circularMotion')
			.name('Circular motion');

		animFolder
			.add(animationConfig, 'orbitRadius', 0, 5, 0.1)
			.name('Orbit radius');

		// GSAP tween actions
		const gsapActions = {
			moveX: () => {
				gsap.to(targetMesh.position, {
					duration: 1,
					delay: 0.3,
					x: 2,
					yoyo: true,
					repeat: 1,
					ease: 'power2.inOut',
				});
			},
			bounceY: () => {
				gsap.to(targetMesh.position, {
					duration: 0.8,
					y: 1.5,
					yoyo: true,
					repeat: 2,
					ease: 'bounce.out',
				});
			}
		};

		animFolder.add(gsapActions, 'moveX').name('GSAP: move X');
		animFolder.add(gsapActions, 'bounceY').name('GSAP: bounce Y');
		animFolder.open();

		return animFolder;
	}
}

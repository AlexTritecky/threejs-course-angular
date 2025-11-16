import { Injectable } from '@angular/core';
import * as THREE from 'three';
import GUI from 'lil-gui';
import gsap from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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


	/**
   * Creates a lil-gui instance for camera exploration:
   * - field of view
   * - position (x, y, z)
   * - quick "look at origin" helper
   */
	createCameraGui(
		camera: THREE.PerspectiveCamera,
		controls?: OrbitControls,
	): GUI {
		const gui = new GUI();

		// запам’ятаємо дефолтну позицію камери (як в initThree)
		const defaultPos = camera.position.clone();
		const defaultTarget = new THREE.Vector3(0, 0, 0);

		const params = {
			fov: camera.fov,
			posX: camera.position.x,
			posY: camera.position.y,
			posZ: camera.position.z,
			lookAtOrigin: () => {
				if (controls) {
					// reset camera position
					camera.position.copy(defaultPos);

					// reset target
					controls.target.copy(defaultTarget);

					// перерахувати матриці
					controls.update();
				} else {
					camera.position.copy(defaultPos);
					camera.lookAt(defaultTarget);
				}

				// оновити слайдери в GUI (опційно)
				params.posX = camera.position.x;
				params.posY = camera.position.y;
				params.posZ = camera.position.z;
			},
		};

		const folder = gui.addFolder('Camera');

		folder
			.add(params, 'fov', 20, 120, 1)
			.name('FOV')
			.onChange((value: number) => {
				camera.fov = value;
				camera.updateProjectionMatrix();
			});

		folder
			.add(params, 'posX', -10, 10, 0.1)
			.name('Position X')
			.onChange((value: number) => {
				camera.position.x = value;
			});

		folder
			.add(params, 'posY', -10, 10, 0.1)
			.name('Position Y')
			.onChange((value: number) => {
				camera.position.y = value;
			});

		folder
			.add(params, 'posZ', 0.5, 20, 0.1)
			.name('Position Z')
			.onChange((value: number) => {
				camera.position.z = value;
			});

		folder.add(params, 'lookAtOrigin').name('Reset & look at (0,0,0)');

		folder.open();

		return gui;
	}


	/**
 * GUI for custom BufferGeometry-based meshes:
 * - color
 * - wireframe toggle
 * - triangle count + "Regenerate" button
 *
 * @param mesh - Target mesh (assumed MeshBasicMaterial).
 * @param initialTriangleCount - Initial number of triangles used for geometry.
 * @param regenerateGeometry - Callback that will be called when user hits "Regenerate".
 *                             Receives the current triangleCount from GUI.
 */
	createGeometryGui(
		mesh: THREE.Mesh,
		initialTriangleCount: number,
		regenerateGeometry: (triangleCount: number) => void,
	): GUI {
		const gui = new GUI();
		const folder = gui.addFolder('Geometry');

		const material = mesh.material as THREE.MeshBasicMaterial;

		const params = {
			color: material.color.getStyle(),     // initial color
			wireframe: material.wireframe,       // initial wireframe flag
			triangleCount: initialTriangleCount,  // how many triangles to generate
			regenerate: () => {
				regenerateGeometry(params.triangleCount);
			},
		};

		// Color picker
		folder
			.addColor(params, 'color')
			.name('Color')
			.onChange((value: string) => {
				material.color.setStyle(value);
			});

		// Wireframe toggle
		folder
			.add(params, 'wireframe')
			.name('Wireframe')
			.onChange((value: boolean) => {
				material.wireframe = value;
			});

		// Triangle count slider
		folder
			.add(params, 'triangleCount', 10, 500, 10)
			.name('Triangles');

		// Button to regenerate geometry
		folder
			.add(params, 'regenerate')
			.name('Regenerate geometry');

		folder.open();

		return gui;
	}


	/**
	 * Creates a full-featured debug GUI for a single cube:
	 * - "Awesome cube" folder with:
	 *   - elevation (position.y)
	 *   - visible
	 *   - wireframe
	 *   - color
	 *   - spin() GSAP animation
	 *   - subdivision (regenerates BoxGeometry with new segments)
	 * - panel configured with width/title/closeFolders
	 * - 'h' key toggles GUI visibility
	 */
	createDebugCubeGui(
		mesh: THREE.Mesh,
		material: THREE.MeshBasicMaterial,
	): GUI {
		const gui = new GUI({
			width: 300,
			title: 'Nice debug UI',
			closeFolders: false,
		});

		// Parameters object used only for GUI-bound values and actions
		const debugObject: {
			color: string;
			spin: () => void;
			subdivision: number;
		} = {
			color: '#a778d8',
			spin: () => {
				gsap.to(mesh.rotation, {
					duration: 1,
					y: mesh.rotation.y + Math.PI * 2,
				});
			},
			subdivision: 2,
		};

		// Ensure material starts with the same color as the GUI
		material.color.set(debugObject.color);

		const cubeTweaks = gui.addFolder('Awesome cube');

		// Elevation (Y position)
		cubeTweaks
			.add(mesh.position, 'y')
			.min(-3)
			.max(3)
			.step(0.01)
			.name('elevation');

		// Visibility
		cubeTweaks.add(mesh, 'visible');

		// Wireframe toggle
		cubeTweaks.add(material, 'wireframe');

		// Color picker (syncs back into material.color)
		cubeTweaks
			.addColor(debugObject, 'color')
			.name('color')
			.onChange(() => {
				material.color.set(debugObject.color);
			});

		// Spin action (GSAP)
		cubeTweaks.add(debugObject, 'spin').name('spin');

		// Subdivision — rebuilds BoxGeometry with new segments
		cubeTweaks
			.add(debugObject, 'subdivision')
			.min(1)
			.max(20)
			.step(1)
			.name('subdivision')
			.onFinishChange(() => {
				mesh.geometry.dispose();
				mesh.geometry = new THREE.BoxGeometry(
					1,
					1,
					1,
					debugObject.subdivision,
					debugObject.subdivision,
					debugObject.subdivision,
				);
			});

		cubeTweaks.open();

		// Optional: toggle GUI with 'h' key (hide/show)
		window.addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key === 'h') {
				// lil-gui stores hidden state in a private property _hidden
				const anyGui = gui as any;
				gui.show(anyGui._hidden);
			}
		});

		return gui;
	}


	/**
	 * Creates a GUI to explore texture parameters:
	 * - switch current color map
	 * - change wrapping mode
	 * - tweak repeat.x / repeat.y
	 * - toggle between Nearest / Linear filters
	 *
	 * @param material - target material whose map will be updated
	 * @param textures - dictionary of textures (key -> THREE.Texture)
	 */
	createTexturesGui(
		material: THREE.MeshBasicMaterial,
		textures: Record<string, THREE.Texture>,
	): GUI {
		const gui = new GUI({
			width: 320,
			title: 'Textures debug',
			closeFolders: false,
		});

		const textureKeys = Object.keys(textures);
		if (textureKeys.length === 0) {
			console.warn('DebugGuiService.createTexturesGui: no textures provided');
			return gui;
		}

		const params = {
			currentMapKey: textureKeys[0],
			wrap: 'MirrorRepeat' as 'Clamp' | 'Repeat' | 'MirrorRepeat',
			repeatX: 1,
			repeatY: 1,
			minFilter: 'Nearest' as 'Nearest' | 'Linear',
			magFilter: 'Nearest' as 'Nearest' | 'Linear',
		};

		const applySettings = () => {
			const map = textures[params.currentMapKey];
			if (!map) {
				console.warn(
					`DebugGuiService.createTexturesGui: texture "${params.currentMapKey}" not found`,
				);
				return;
			}

			// Assign map to material
			material.map = map;

			// Wrap mode
			const wrapMap: Record<string, THREE.Wrapping> = {
				Clamp: THREE.ClampToEdgeWrapping,
				Repeat: THREE.RepeatWrapping,
				MirrorRepeat: THREE.MirroredRepeatWrapping,
			};
			const wrapping = wrapMap[params.wrap] ?? THREE.RepeatWrapping;
			map.wrapS = wrapping;
			map.wrapT = wrapping;

			// Repeat
			map.repeat.set(params.repeatX, params.repeatY);

			// Color space + filtering
			map.colorSpace = THREE.SRGBColorSpace;

			map.minFilter =
				params.minFilter === 'Nearest'
					? THREE.NearestFilter
					: THREE.LinearMipmapLinearFilter;
			map.magFilter =
				params.magFilter === 'Nearest'
					? THREE.NearestFilter
					: THREE.LinearFilter;

			map.generateMipmaps = params.minFilter !== 'Nearest';

			map.needsUpdate = true;
			material.needsUpdate = true;
		};

		// Initial apply
		applySettings();

		const folder = gui.addFolder('Textures');

		folder
			.add(params, 'currentMapKey', textureKeys)
			.name('Active map')
			.onChange(applySettings);

		folder
			.add(params, 'wrap', ['Clamp', 'Repeat', 'MirrorRepeat'])
			.name('Wrap mode')
			.onChange(applySettings);

		folder
			.add(params, 'repeatX', 0.25, 5, 0.25)
			.name('Repeat X')
			.onChange(applySettings);

		folder
			.add(params, 'repeatY', 0.25, 5, 0.25)
			.name('Repeat Y')
			.onChange(applySettings);

		folder
			.add(params, 'minFilter', ['Nearest', 'Linear'])
			.name('Min filter')
			.onChange(applySettings);

		folder
			.add(params, 'magFilter', ['Nearest', 'Linear'])
			.name('Mag filter')
			.onChange(applySettings);

		folder.open();

		return gui;
	}
}

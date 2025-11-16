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


	/**
 * Creates a Materials GUI panel with:
 * - dropdown to choose material type
 * - Standard-material controls (if exists)
 * - Physical-material controls (if exists)
 *
 * @param materials Object where keys = names, values = THREE.Material instances
 * @param onMaterialChange Callback that receives selected material from dropdown
 */
	createMaterialsGui(
		materials: Record<string, THREE.Material>,
		onMaterialChange: (material: THREE.Material) => void,
	): GUI {
		const gui = new GUI({
			width: 320,
			title: 'Materials Debug',
			closeFolders: false,
		});

		const materialKeys = Object.keys(materials);

		if (!materialKeys.length) {
			console.warn('DebugGuiService.createMaterialsGui: no materials provided.');
			return gui;
		}

		const params = {
			current: materialKeys[0], // default=first material
		};

		/** Apply material to scene */
		const applyMaterial = () => {
			const mat = materials[params.current];
			if (!mat) return;

			onMaterialChange(mat);
		};

		// Initial apply
		applyMaterial();

		/** MAIN FOLDER */
		const mainFolder = gui.addFolder('Material type');
		mainFolder
			.add(params, 'current', materialKeys)
			.name('Active material')
			.onChange(applyMaterial);
		mainFolder.open();

		/**
		 * Helper for adding GUI controls by checking property existence
		 */
		const addIfProp = (
			folder: GUI,
			material: any,
			prop: string,
			min: number,
			max: number,
			step = 0.0001,
		) => {
			if (material[prop] !== undefined) {
				folder.add(material, prop).min(min).max(max).step(step);
			}
		};

		/**
		 * STANDARD MATERIAL TWEAKS
		 */
		const standardMat = Object.values(materials).find(
			(m) => m instanceof THREE.MeshStandardMaterial,
		) as THREE.MeshStandardMaterial | undefined;

		if (standardMat) {
			const f = gui.addFolder('Standard Material (PBR)');
			addIfProp(f, standardMat, 'metalness', 0, 1);
			addIfProp(f, standardMat, 'roughness', 0, 1);
			addIfProp(f, standardMat, 'displacementScale', 0, 0.5, 0.001);
			addIfProp(f, standardMat, 'aoMapIntensity', 0, 5, 0.01);

			// Normal scale
			if (standardMat.normalScale instanceof THREE.Vector2) {
				f.add(standardMat.normalScale, 'x', 0, 1, 0.01).name('normalScale.x');
				f.add(standardMat.normalScale, 'y', 0, 1, 0.01).name('normalScale.y');
			}

			f.open();
		}

		/**
		 * PHYSICAL MATERIAL TWEAKS
		 */
		const physicalMat = Object.values(materials).find(
			(m) => m instanceof THREE.MeshPhysicalMaterial,
		) as THREE.MeshPhysicalMaterial | undefined;

		if (physicalMat) {
			const f = gui.addFolder('Physical Material (Glass-like)');
			addIfProp(f, physicalMat, 'metalness', 0, 1);
			addIfProp(f, physicalMat, 'roughness', 0, 1);

			// Transmission
			addIfProp(f, physicalMat, 'transmission', 0, 1);
			addIfProp(f, physicalMat, 'ior', 1, 10);
			addIfProp(f, physicalMat, 'thickness', 0, 5, 0.001);

			// Optional advanced features:
			addIfProp(f, physicalMat, 'clearcoat', 0, 1);
			addIfProp(f, physicalMat, 'clearcoatRoughness', 0, 1);
			addIfProp(f, physicalMat, 'sheen', 0, 1);
			f.addColor(physicalMat, 'sheenColor');

			f.open();
		}

		return gui;
	}


	/**
	 * Створює GUI для роботи з 3D-текстом:
	 * - зміна контенту тексту
	 * - розмір / глибина / bevel
	 * - кількість "donuts"
	 * - автоспін групи з текстом
	 *
	 * @param textConfig – обʼєкт з поточними параметрами тексту й анімації
	 * @param rebuildCallback – колбек, який має заново побудувати text + donuts
	 */
	createTextGui(
		textConfig: {
			content: string;
			size: number;
			depth: number;
			bevelEnabled: boolean;
			bevelThickness: number;
			bevelSize: number;
			curveSegments: number;
			bevelSegments: number;
			donutsCount: number;
			autoRotate: boolean;
			rotationSpeed: number;
		},
		rebuildCallback: () => void,
	): GUI {
		const gui = new GUI({
			width: 320,
			title: 'Text Debug',
			closeFolders: false,
		});

		/**
		 * FOLDER: Text geometry
		 * Всі параметри, які вимагають перебудови геометрії, викликають rebuildCallback
		 */
		const geoFolder = gui.addFolder('Text geometry');

		geoFolder
			.add(textConfig, 'content')
			.name('Text')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'size', 0.1, 2, 0.01)
			.name('Size')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'depth', 0.01, 1, 0.01)
			.name('Depth')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'curveSegments', 1, 32, 1)
			.name('Curve segs')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'bevelEnabled')
			.name('Bevel')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'bevelThickness', 0, 0.2, 0.005)
			.name('Bevel thickness')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'bevelSize', 0, 0.2, 0.005)
			.name('Bevel size')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'bevelSegments', 0, 10, 1)
			.name('Bevel segs')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add(textConfig, 'donutsCount', 0, 500, 1)
			.name('Donuts count')
			.onFinishChange(rebuildCallback);

		geoFolder
			.add({ rebuild: rebuildCallback }, 'rebuild')
			.name('Rebuild now');

		geoFolder.open();

		/**
		 * FOLDER: Rotation
		 * Просто змінює поля в textConfig, а компонент вже читає їх у своєму лупі
		 */
		const rotFolder = gui.addFolder('Rotation');

		rotFolder
			.add(textConfig, 'autoRotate')
			.name('Auto-rotate group');

		rotFolder
			.add(textConfig, 'rotationSpeed', -2, 2, 0.01)
			.name('Speed (rad/s)');

		rotFolder.open();

		return gui;
	}


	createLightsGui(lights: {
		ambientLight: THREE.AmbientLight;
		directionalLight: THREE.DirectionalLight;
		hemisphereLight: THREE.HemisphereLight;
		pointLight: THREE.PointLight;
		rectAreaLight: THREE.RectAreaLight;
		spotLight: THREE.SpotLight;
		helpers: {
			hemisphere: THREE.HemisphereLightHelper;
			directional: THREE.DirectionalLightHelper;
			point: THREE.PointLightHelper;
			spot: THREE.SpotLightHelper;
			rectArea: any; // RectAreaLightHelper
		};
	}): GUI {
		const gui = new GUI({ width: 340, title: 'Lights Debug' });

		// -------------------------
		// AMBIENT
		// -------------------------
		const ambient = gui.addFolder('Ambient');
		ambient.addColor(lights.ambientLight, 'color');
		ambient.add(lights.ambientLight, 'intensity', 0, 3, 0.001);

		// -------------------------
		// DIRECTIONAL
		// -------------------------
		const dir = gui.addFolder('Directional');
		dir.add(lights.directionalLight, 'intensity', 0, 3, 0.001);
		dir.addColor(lights.directionalLight, 'color');
		dir.add(lights.directionalLight.position, 'x', -5, 5);
		dir.add(lights.directionalLight.position, 'y', -5, 5);
		dir.add(lights.directionalLight.position, 'z', -5, 5);

		// -------------------------
		// HEMISPHERE
		// -------------------------
		const hemi = gui.addFolder('Hemisphere');
		hemi.addColor(lights.hemisphereLight, 'color').name('Sky color');
		hemi.addColor(lights.hemisphereLight, 'groundColor').name('Ground color');
		hemi.add(lights.hemisphereLight, 'intensity', 0, 3, 0.001);

		// -------------------------
		// POINT
		// -------------------------
		const point = gui.addFolder('Point Light');
		point.addColor(lights.pointLight, 'color');
		point.add(lights.pointLight, 'intensity', 0, 10, 0.01);
		point.add(lights.pointLight, 'distance', 0, 20, 0.1);
		point.add(lights.pointLight, 'decay', 0, 5, 0.01);
		point.add(lights.pointLight.position, 'x', -5, 5);
		point.add(lights.pointLight.position, 'y', -5, 5);
		point.add(lights.pointLight.position, 'z', -5, 5);

		// -------------------------
		// RECT AREA
		// -------------------------
		const rect = gui.addFolder('Rect Area');
		rect.addColor(lights.rectAreaLight, 'color');
		rect.add(lights.rectAreaLight, 'intensity', 0, 50, 0.1);
		rect.add(lights.rectAreaLight, 'width', 0.1, 5, 0.1);
		rect.add(lights.rectAreaLight, 'height', 0.1, 5, 0.1);
		rect.add(lights.rectAreaLight.position, 'x', -5, 5);
		rect.add(lights.rectAreaLight.position, 'y', -5, 5);
		rect.add(lights.rectAreaLight.position, 'z', -5, 5);

		// -------------------------
		// SPOT LIGHT
		// -------------------------
		const spot = gui.addFolder('Spotlight');
		spot.addColor(lights.spotLight, 'color');
		const spotIntensity = spot.add(lights.spotLight, 'intensity', 0, 20, 0.1);
		const spotDistance = spot.add(lights.spotLight, 'distance', 0, 30, 0.1);
		const spotAngle = spot.add(lights.spotLight, 'angle', 0, Math.PI / 2, 0.001);
		const spotPenumbra = spot.add(lights.spotLight, 'penumbra', 0, 1, 0.01);
		const spotDecay = spot.add(lights.spotLight, 'decay', 0, 5, 0.01);

		const spotPosX = spot.add(lights.spotLight.position, 'x', -5, 5);
		const spotPosY = spot.add(lights.spotLight.position, 'y', -5, 5);
		const spotPosZ = spot.add(lights.spotLight.position, 'z', -5, 5);

		// TARGET
		const spotTarget = spot.addFolder('Spot Target');
		const targetX = spotTarget.add(lights.spotLight.target.position, 'x', -5, 5);
		const targetY = spotTarget.add(lights.spotLight.target.position, 'y', -5, 5);
		const targetZ = spotTarget.add(lights.spotLight.target.position, 'z', -5, 5);

		// helper updater for any spotlight-related controller
		const updateSpotHelper = () => {
			lights.helpers.spot.update();
		};

		[
			spotIntensity,
			spotDistance,
			spotAngle,
			spotPenumbra,
			spotDecay,
			spotPosX,
			spotPosY,
			spotPosZ,
			targetX,
			targetY,
			targetZ,
		].forEach((ctrl) => ctrl.onChange(updateSpotHelper));

		// -------------------------
		// HELPERS TOGGLE
		// -------------------------
		const helpers = gui.addFolder('Helpers visibility');
		const flags = {
			hemisphere: true,
			directional: true,
			point: true,
			spot: true,
			rectArea: true,
		};

		helpers
			.add(flags, 'hemisphere')
			.onChange((v: boolean) => (lights.helpers.hemisphere.visible = v));
		helpers
			.add(flags, 'directional')
			.onChange((v: boolean) => (lights.helpers.directional.visible = v));
		helpers
			.add(flags, 'point')
			.onChange((v: boolean) => (lights.helpers.point.visible = v));
		helpers
			.add(flags, 'spot')
			.onChange((v: boolean) => (lights.helpers.spot.visible = v));
		helpers
			.add(flags, 'rectArea')
			.onChange((v: boolean) => (lights.helpers.rectArea.visible = v));

		return gui;
	}


	createShadowsGui(params: {
		renderer: THREE.WebGLRenderer;
		ambientLight: THREE.AmbientLight;
		directionalLight: THREE.DirectionalLight;
		spotLight: THREE.SpotLight;
		pointLight: THREE.PointLight;
		material: THREE.MeshStandardMaterial;
		sphere: THREE.Mesh;
		plane: THREE.Mesh;
		sphereShadow: THREE.Mesh;
		helpers: {
			directional: THREE.CameraHelper;
			spot: THREE.CameraHelper;
			point: THREE.CameraHelper;
		};
	}): GUI {
		const {
			renderer,
			ambientLight,
			directionalLight,
			spotLight,
			pointLight,
			material,
			sphere,
			plane,
			sphereShadow,
			helpers,
		} = params;

		const gui = new GUI({
			width: 340,
			title: 'Shadows debug',
			closeFolders: false,
		});

		// Local debug flags (not exposed outside)
		const debugConfig = {
			useRealShadows: false,
			showDirectionalHelper: false,
			showSpotHelper: false,
			showPointHelper: false,
		};

		// -------------------------
		// AMBIENT LIGHT
		// -------------------------
		const ambientFolder = gui.addFolder('Ambient light');
		ambientFolder
			.add(ambientLight, 'intensity', 0, 3, 0.001)
			.name('Intensity');
		ambientFolder.open();

		// -------------------------
		// DIRECTIONAL LIGHT
		// -------------------------
		const dirFolder = gui.addFolder('Directional light');
		dirFolder
			.add(directionalLight, 'intensity', 0, 3, 0.001)
			.name('Intensity');
		dirFolder
			.add(directionalLight.position, 'x', -5, 5, 0.001)
			.name('Pos X');
		dirFolder
			.add(directionalLight.position, 'y', -5, 5, 0.001)
			.name('Pos Y');
		dirFolder
			.add(directionalLight.position, 'z', -5, 5, 0.001)
			.name('Pos Z');

		// -------------------------
		// MATERIAL
		// -------------------------
		const matFolder = gui.addFolder('Material');
		matFolder
			.add(material, 'metalness', 0, 1, 0.001)
			.name('Metalness');
		matFolder
			.add(material, 'roughness', 0, 1, 0.001)
			.name('Roughness');

		// -------------------------
		// REAL vs FAKE SHADOWS
		// -------------------------
		const shadowsFolder = gui.addFolder('Shadows mode');
		shadowsFolder
			.add(debugConfig, 'useRealShadows')
			.name('Use real shadows')
			.onChange((enabled: boolean) => {
				// Enable/disable real shadow maps on renderer
				renderer.shadowMap.enabled = enabled;

				// Fake blob shadow plane visibility
				sphereShadow.visible = !enabled;

				// Cast/receive flags
				sphere.castShadow = enabled;
				plane.receiveShadow = enabled;

				directionalLight.castShadow = enabled;
				spotLight.castShadow = enabled;
				pointLight.castShadow = enabled;
			});

		// -------------------------
		// HELPERS VISIBILITY
		// -------------------------
		const helpersFolder = gui.addFolder('Shadow camera helpers');
		helpersFolder
			.add(debugConfig, 'showDirectionalHelper')
			.name('Directional')
			.onChange((v: boolean) => {
				helpers.directional.visible = v;
			});

		helpersFolder
			.add(debugConfig, 'showSpotHelper')
			.name('Spot')
			.onChange((v: boolean) => {
				helpers.spot.visible = v;
			});

		helpersFolder
			.add(debugConfig, 'showPointHelper')
			.name('Point')
			.onChange((v: boolean) => {
				helpers.point.visible = v;
			});

		return gui;
	}


	createHauntedHouseGui(config: {
		ambientLight: THREE.AmbientLight;
		directionalLight: THREE.DirectionalLight;
		floorMaterial: THREE.MeshStandardMaterial;
	}): GUI {
		const gui = new GUI({
			width: 320,
			title: 'Haunted House debug',
			closeFolders: false,
		});

		/**
		 * Ambient light folder
		 */
		const ambientFolder = gui.addFolder('Ambient light');
		ambientFolder
			.add(config.ambientLight, 'intensity', 0, 2, 0.001)
			.name('Intensity');

		/**
		 * Directional light folder
		 */
		const dirFolder = gui.addFolder('Directional light');
		dirFolder
			.add(config.directionalLight, 'intensity', 0, 2, 0.001)
			.name('Intensity');
		dirFolder
			.add(config.directionalLight.position, 'x', -10, 10, 0.1)
			.name('Pos X');
		dirFolder
			.add(config.directionalLight.position, 'y', -10, 10, 0.1)
			.name('Pos Y');
		dirFolder
			.add(config.directionalLight.position, 'z', -10, 10, 0.1)
			.name('Pos Z');

		/**
		 * Floor displacement folder
		 */
		const floorFolder = gui.addFolder('Floor displacement');
		floorFolder
			.add(config.floorMaterial, 'displacementScale', 0, 1, 0.001)
			.name('Scale');
		floorFolder
			.add(config.floorMaterial, 'displacementBias', -1, 1, 0.001)
			.name('Bias');

		ambientFolder.open();
		dirFolder.open();
		floorFolder.open();

		return gui;
	}


	/**
 * GUI для партиклів:
 * - колір (material.color)
 * - розмір (material.size)
 *
 * @param material - PointsMaterial партиклів
 * @param config - обʼєкт параметрів, які буде змінювати GUI
 */
	// DebugGuiService

	createParticlesGui(
		material: THREE.PointsMaterial,
		config: {
			color: string;
			size: number;
			count: number;
			mode: 'sphereBasic'
			| 'randomBasic'
			| 'randomAlphaAdditive'
			| 'randomVertexColors'
			| 'rotatePoints'
			| 'waveAttributes';
		},
		onModeOrCountChange: () => void,
	): GUI {
		const gui = new GUI({
			width: 260,
			title: 'Particles debug',
			closeFolders: false,
		});

		const folder = gui.addFolder('Particles');

		// Колір (міняємо material.color)
		folder
			.addColor(config, 'color')
			.name('Color')
			.onChange((value: string) => {
				material.color.set(value);
				material.needsUpdate = true;
			});

		// Розмір (міняємо material.size)
		folder
			.add(config, 'size', 0.01, 2, 0.01) // ширший діапазон
			.name('Size')
			.onChange((value: number) => {
				material.size = value;
				material.needsUpdate = true;
			});

		// Кількість партиклів (потребує перебудови геометрії)
		folder
			.add(config, 'count', 100, 50000, 100)
			.name('Count')
			.onFinishChange(() => {
				onModeOrCountChange();
			});

		// Режим прикладу з уроку
		folder
			.add(config, 'mode', [
				'sphereBasic',          // сфера з партиклів
				'randomBasic',          // рандомні без текстур
				'randomAlphaAdditive',  // alphaMap + Additive + depthWrite=false
				'randomVertexColors',   // vertexColors
				'rotatePoints',         // обертання Points
				'waveAttributes',       // хвиля через атрибути
			])
			.name('Example')
			.onChange(() => {
				onModeOrCountChange();
			});

		folder.open();

		return gui;
	}


}

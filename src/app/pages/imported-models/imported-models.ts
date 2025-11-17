import {
	AfterViewInit,
	Component,
	ElementRef,
	OnDestroy,
	inject,
	viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-imported-models',
	standalone: true,
	imports: [],
	templateUrl: './imported-models.html',
	styleUrl: './imported-models.scss',
})
export class ImportedModels implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** Canvas reference from template: <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** GLTF + DRACO loaders */
	private gltfLoader!: GLTFLoader;
	private dracoLoader!: DRACOLoader;

	/** Currently loaded model root (gltf.scene) */
	private currentModel?: THREE.Object3D;

	/** Animation mixer for animated models (like the Fox) */
	private mixer?: THREE.AnimationMixer;

	/** Clock + delta handling for stable animation playback */
	private clock = new THREE.Clock();
	private previousTime = 0;

	/** rAF id for proper cleanup */
	private animationFrameId?: number;

	/** Debug GUI instance (model switcher + animation + transform) */
	private gui?: GUI;

	/**
	 * Available models configuration:
	 * - id: used by the GUI dropdown
	 * - path: GLTF/GLB path
	 * - scale: optional uniform scale applied on load
	 */
	private readonly modelsConfig: Record<
		string,
		{
			label: string;
			path: string;
			scale?: number;
		}
	> = {
			'duck-gltf': {
				label: 'Duck (glTF)',
				path: '/models/Duck/glTF/Duck.gltf',
			},
			'duck-binary': {
				label: 'Duck (Binary .glb)',
				path: '/models/Duck/glTF-Binary/Duck.glb',
			},
			'duck-embedded': {
				label: 'Duck (Embedded)',
				path: '/models/Duck/glTF-Embedded/Duck.gltf',
			},
			'duck-draco': {
				label: 'Duck (Draco)',
				path: '/models/Duck/glTF-Draco/Duck.gltf',
			},
			'flight-helmet': {
				label: 'Flight Helmet',
				path: '/models/FlightHelmet/glTF/FlightHelmet.gltf',
			},
			'fox-animated': {
				label: 'Fox (animated)',
				path: '/models/Fox/glTF/Fox.gltf',
				scale: 0.025,
			},
		};

	/** ID of the currently active model in the map above */
	private currentModelKey: string = 'fox-animated';

	ngAfterViewInit(): void {
		this.initThree();
		this.initLoaders();
		this.loadModel(this.currentModelKey);
		this.startLoop();

		window.addEventListener('resize', this.handleResize);
	}

	ngOnDestroy(): void {
		cancelAnimationFrame(this.animationFrameId ?? 0);
		window.removeEventListener('resize', this.handleResize);

		this.controls?.dispose();
		this.renderer?.dispose();
		this.gui?.destroy();
	}

	/**
	 * Initializes base Three.js setup:
	 * - scene
	 * - camera
	 * - renderer
	 * - orbit controls
	 * - floor + lights (with shadows enabled)
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		/** Scene */
		this.scene = this.threeCoreService.createScene();

		/** Camera */
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(2, 2, 2);
		this.scene.add(this.camera);

		/** Renderer */
		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		/** OrbitControls */
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.target.set(0, 0.75, 0);
		this.controls.enableDamping = true;

		/** Floor */
		const floor = new THREE.Mesh(
			new THREE.PlaneGeometry(10, 10),
			new THREE.MeshStandardMaterial({
				color: '#444444',
				metalness: 0,
				roughness: 0.5,
			}),
		);
		floor.receiveShadow = true;
		floor.rotation.x = -Math.PI * 0.5;
		this.scene.add(floor);

		/** Lights */
		const ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
		directionalLight.castShadow = true;
		directionalLight.shadow.mapSize.set(1024, 1024);
		directionalLight.shadow.camera.far = 15;
		directionalLight.shadow.camera.left = -7;
		directionalLight.shadow.camera.top = 7;
		directionalLight.shadow.camera.right = 7;
		directionalLight.shadow.camera.bottom = -7;
		directionalLight.position.set(-5, 5, 0);
		this.scene.add(directionalLight);
	}

	/**
	 * Initializes GLTFLoader + DRACOLoader.
	 * DRACO decoder is only used when needed (e.g. Duck Draco).
	 */
	private initLoaders(): void {
		this.dracoLoader = new DRACOLoader();
		this.dracoLoader.setDecoderPath('/draco/');

		this.gltfLoader = new GLTFLoader();
		this.gltfLoader.setDRACOLoader(this.dracoLoader);
	}

	/**
	 * Loads a model by its config key:
	 * - disposes previous model and animation mixer
	 * - loads the new GLTF / GLB
	 * - applies optional scale
	 * - sets up AnimationMixer if animations exist
	 * - attaches a GUI for model switch + animation + transform
	 */
	private loadModel(key: string): void {
		const config = this.modelsConfig[key];
		if (!config) {
			console.warn(`ImportedModels: unknown model key "${key}"`);
			return;
		}

		this.currentModelKey = key;

		// Dispose previous GUI
		this.gui?.destroy();
		this.gui = undefined;

		// Remove previous model from scene and dispose geometries/materials
		if (this.currentModel) {
			this.scene.remove(this.currentModel);

			this.currentModel.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.geometry?.dispose();

					const mat = child.material;
					if (Array.isArray(mat)) {
						mat.forEach((m) => m.dispose());
					} else if (mat) {
						mat.dispose();
					}
				}
			});

			this.currentModel = undefined;
		}

		// Reset mixer
		this.mixer = undefined;

		// Load new model
		this.gltfLoader.load(
			config.path,
			(gltf) => {
				// Save reference to the root scene
				this.currentModel = gltf.scene;

				// Apply optional uniform scale
				if (config.scale !== undefined) {
					gltf.scene.scale.setScalar(config.scale);
				}

				// Enable shadows on meshes
				gltf.scene.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.castShadow = true;
						child.receiveShadow = false;
					}
				});

				this.scene.add(gltf.scene);

				// Setup animation mixer if the model has animations
				if (gltf.animations && gltf.animations.length > 0) {
					this.mixer = new THREE.AnimationMixer(gltf.scene);

					// Start with the first clip by default; GUI can change it
					const defaultClip = gltf.animations[0];
					const action = this.mixer.clipAction(defaultClip);
					action.play();
				}

				// Create debug GUI (model switch + animation + transform)
				this.gui = this.debugGuiService.createImportedModelGui({
					model: gltf.scene,
					mixer: this.mixer,
					animations: gltf.animations,
					modelSelector: {
						currentKey: this.currentModelKey,
						availableKeys: Object.keys(this.modelsConfig),
						onChange: (nextKey: string) => this.loadModel(nextKey),
					},
				});
			},
			undefined,
			(error) => {
				console.error(`Error loading model "${config.label}" from ${config.path}`, error);
			},
		);
	}

	/**
	 * Main render loop:
	 * - updates animation mixer using delta time
	 * - updates orbit controls
	 * - renders the scene
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();
			const deltaTime = elapsedTime - this.previousTime;
			this.previousTime = elapsedTime;

			// Update model animation (if any)
			if (this.mixer) {
				this.mixer.update(deltaTime);
			}

			// Update controls damping
			this.controls.update();

			// Render
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Handles window resize:
	 * - updates camera aspect
	 * - updates renderer size and pixel ratio
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

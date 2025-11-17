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
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

type EnvironmentPreset =
	| 'cube_2'
	| 'hdr_blender'
	| 'hdr_exr_nvidia'
	| 'ldr_blockade_anime'
	| 'hdr_grounded_2k';

@Component({
	selector: 'app-environment-map',
	standalone: true,
	imports: [],
	templateUrl: './environment-map.html',
	styleUrl: './environment-map.scss',
})
export class EnvironmentMap implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Loaders */
	private gltfLoader = new GLTFLoader();
	private rgbeLoader = new RGBELoader();
	private exrLoader = new EXRLoader();
	private textureLoader = new THREE.TextureLoader();
	private cubeTextureLoader = new THREE.CubeTextureLoader();

	/** Scene objects */
	private torusKnot!: THREE.Mesh<
		THREE.TorusKnotGeometry,
		THREE.MeshStandardMaterial
	>;
	private flightHelmet?: THREE.Object3D;
	private skybox?: GroundedSkybox;

	/** Debug GUI */
	private gui!: GUI;

	/** Animation */
	private clock = new THREE.Clock();
	private animationFrameId?: number;

	/** Env map runtime config (active preset) */
	private environmentConfig = {
		preset: 'hdr_grounded_2k' as EnvironmentPreset,
	};

	ngAfterViewInit(): void {
		this.initThree();
		this.initEnvironment();
		this.initObjects();
		this.initModel();
		this.initGui();
		this.startLoop();

		window.addEventListener('resize', this.handleResize);
	}

	ngOnDestroy(): void {
		cancelAnimationFrame(this.animationFrameId ?? 0);
		window.removeEventListener('resize', this.handleResize);

		this.controls?.dispose();
		this.renderer?.dispose();
		this.gui?.destroy();

		// Dispose torus
		if (this.torusKnot) {
			this.scene.remove(this.torusKnot);
			this.torusKnot.geometry.dispose();
			this.torusKnot.material.dispose();
		}

		// Dispose skybox
		if (this.skybox) {
			this.scene.remove(this.skybox);
			this.skybox.geometry.dispose();
			(this.skybox.material as THREE.Material).dispose();
			this.skybox = undefined;
		}

		// Dispose model
		if (this.flightHelmet) {
			this.scene.remove(this.flightHelmet);
			this.flightHelmet.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.geometry.dispose();
					const mat = child.material;
					if (Array.isArray(mat)) {
						mat.forEach((m) => m.dispose());
					} else if (mat) {
						mat.dispose();
					}
				}
			});
		}
	}

	/**
	 * Initializes scene, camera, renderer and orbit controls.
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		// Scene
		this.scene = this.threeCoreService.createScene();

		// Camera
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(4, 5, 4);
		this.scene.add(this.camera);

		// Renderer
		this.renderer = this.threeCoreService.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Controls
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
		this.controls.target.y = 3.5;
	}

	/**
	 * Sets up default environment properties and applies initial preset.
	 */
	private initEnvironment(): void {
		const sceneAny = this.scene as any;
		sceneAny.environmentIntensity = 1;
		sceneAny.backgroundBlurriness = 0;
		sceneAny.backgroundIntensity = 1;

		this.applyEnvironmentPreset(this.environmentConfig.preset);
	}

	/**
	 * Switches between various environment maps (cube, HDR, EXR, LDR, grounded skybox).
	 */
	private applyEnvironmentPreset(preset: EnvironmentPreset): void {
		// Clear previous skybox if any
		if (this.skybox) {
			this.scene.remove(this.skybox);
			this.skybox.geometry.dispose();
			(this.skybox.material as THREE.Material).dispose();
			this.skybox = undefined;
		}

		// Reset scene env/bg
		this.scene.environment = null;
		this.scene.background = null;

		switch (preset) {
			case 'cube_2': {
				const environmentMap = this.cubeTextureLoader.load([
					'/environmentMaps/2/px.png',
					'/environmentMaps/2/nx.png',
					'/environmentMaps/2/py.png',
					'/environmentMaps/2/ny.png',
					'/environmentMaps/2/pz.png',
					'/environmentMaps/2/nz.png',
				]);
				this.scene.environment = environmentMap;
				this.scene.background = environmentMap;
				break;
			}

			case 'hdr_blender': {
				this.rgbeLoader.load('/environmentMaps/blender-2k.hdr', (environmentMap) => {
					environmentMap.mapping = THREE.EquirectangularReflectionMapping;
					this.scene.environment = environmentMap;
					this.scene.background = environmentMap;
				});
				break;
			}

			case 'hdr_exr_nvidia': {
				this.exrLoader.load(
					'/environmentMaps/nvidiaCanvas-4k.exr',
					(environmentMap) => {
						environmentMap.mapping = THREE.EquirectangularReflectionMapping;
						this.scene.environment = environmentMap;
						this.scene.background = environmentMap;
					},
				);
				break;
			}

			case 'ldr_blockade_anime': {
				const environmentMap = this.textureLoader.load(
					'/environmentMaps/blockadesLabsSkybox/anime_art_style_japan_streets_with_cherry_blossom_.jpg',
				);
				environmentMap.mapping = THREE.EquirectangularReflectionMapping;
				environmentMap.colorSpace = THREE.SRGBColorSpace;
				this.scene.environment = environmentMap;
				this.scene.background = environmentMap;
				break;
			}

			case 'hdr_grounded_2k':
			default: {
				this.rgbeLoader.load('/environmentMaps/2/2k.hdr', (environmentMap) => {
					environmentMap.mapping = THREE.EquirectangularReflectionMapping;
					this.scene.environment = environmentMap;

					const skybox = new GroundedSkybox(environmentMap, 15, 70);
					skybox.position.y = 15;
					this.scene.add(skybox);
					this.skybox = skybox;
				});
				break;
			}
		}
	}

	/**
	 * Adds the reflective torus knot.
	 */
	private initObjects(): void {
		this.torusKnot = new THREE.Mesh(
			new THREE.TorusKnotGeometry(1, 0.4, 100, 16),
			new THREE.MeshStandardMaterial({
				roughness: 0,
				metalness: 1,
				color: 0xaaaaaa,
			}),
		);
		this.torusKnot.position.x = -4;
		this.torusKnot.position.y = 4;
		this.scene.add(this.torusKnot);
	}

	/**
	 * Loads the FlightHelmet GLTF model and scales it up.
	 */
	private initModel(): void {
		this.gltfLoader.load(
			'/models/FlightHelmet/glTF/FlightHelmet.gltf',
			(gltf) => {
				this.flightHelmet = gltf.scene;
				this.flightHelmet.scale.set(10, 10, 10);
				this.scene.add(this.flightHelmet);
			},
			undefined,
			(error) => {
				console.error('Error loading FlightHelmet', error);
			},
		);
	}

	/**
	 * Attaches lil-gui controls for environment map tweaking + preset switcher.
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createEnvironmentMapGui(this.scene, {
			presets: [
				{ id: 'cube_2', label: 'LDR Cube #2' },
				{ id: 'hdr_blender', label: 'HDRI Blender 2k' },
				{ id: 'hdr_exr_nvidia', label: 'HDRI NVIDIA EXR' },
				{ id: 'ldr_blockade_anime', label: 'LDR Blockade Anime' },
				{ id: 'hdr_grounded_2k', label: 'HDR Grounded 2k' },
			],
			currentPresetId: this.environmentConfig.preset,
			onPresetChange: (id) => {
				this.environmentConfig.preset = id as EnvironmentPreset;
				this.applyEnvironmentPreset(this.environmentConfig.preset);
			},
		});
	}

	/**
	 * Main animation loop.
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			// const elapsedTime = this.clock.getElapsedTime();
			// тут можна крутити torusKnot, якщо захочеш

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Handles browser window resizes.
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

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
	selector: 'app-blender-models',
	standalone: true,
	imports: [],
	templateUrl: './blender-models.html',
	styleUrl: './blender-models.scss',
})
export class BlenderModels implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Floor + lights */
	private floor!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
	private ambientLight!: THREE.AmbientLight;
	private directionalLight!: THREE.DirectionalLight;

	/** Model / animation */
	private gltfLoader!: GLTFLoader;
	private dracoLoader!: DRACOLoader;
	private mixer: THREE.AnimationMixer | null = null;

	/** Debug GUI */
	private gui!: GUI;

	/** Animation timing */
	private clock = new THREE.Clock();
	private previousTime = 0;
	private animationFrameId?: number;

	ngAfterViewInit(): void {
		this.initThree();
		this.initFloor();
		this.initLights();
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

		// Dispose floor
		if (this.floor) {
			this.scene.remove(this.floor);
			this.floor.geometry.dispose();
			this.floor.material.dispose();
		}

		// Dispose model
		if (this.mixer) {
			this.mixer.uncacheRoot(this.scene);
		}
	}

	/**
	 * Initializes scene, camera, renderer and orbit controls.
	 * Mirrors the base setup from the vanilla lesson.
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
		this.camera = this.threeCoreService.createPerspectiveCamera(75, { width, height });
		this.camera.position.set(-8, 4, 8);
		this.scene.add(this.camera);

		// Renderer
		this.renderer = this.threeCoreService.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Controls
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
		this.controls.target.set(0, 1, 0);
	}

	/**
	 * Creates the large floor plane that receives shadows.
	 */
	private initFloor(): void {
		const geometry = new THREE.PlaneGeometry(50, 50);
		const material = new THREE.MeshStandardMaterial({
			color: '#444444',
			metalness: 0,
			roughness: 0.5,
		});

		this.floor = new THREE.Mesh(geometry, material);
		this.floor.receiveShadow = true;
		this.floor.rotation.x = -Math.PI * 0.5;
		this.scene.add(this.floor);
	}

	/**
	 * Adds ambient and directional lights used by the hamburger model.
	 */
	private initLights(): void {
		this.ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
		this.scene.add(this.ambientLight);

		this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
		this.directionalLight.castShadow = true;
		this.directionalLight.shadow.mapSize.set(1024, 1024);
		this.directionalLight.shadow.camera.far = 15;
		this.directionalLight.shadow.camera.left = -7;
		this.directionalLight.shadow.camera.top = 7;
		this.directionalLight.shadow.camera.right = 7;
		this.directionalLight.shadow.camera.bottom = -7;
		this.directionalLight.position.set(5, 5, 5);
		this.scene.add(this.directionalLight);
	}

	/**
	 * Configures DRACOLoader + GLTFLoader and loads /models/hamburger.glb.
	 * Also sets up shadow casting on loaded meshes.
	 */
	private initModel(): void {
		this.dracoLoader = new DRACOLoader();
		this.dracoLoader.setDecoderPath('/draco/');

		this.gltfLoader = new GLTFLoader();
		this.gltfLoader.setDRACOLoader(this.dracoLoader);

		this.gltfLoader.load(
			'/models/hamburger.glb',
			(gltf) => {
				const root = gltf.scene;
				root.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.castShadow = true;
						child.receiveShadow = false;
					}
				});

				this.scene.add(root);

				// If model has animations – create mixer
				if (gltf.animations && gltf.animations.length > 0) {
					this.mixer = new THREE.AnimationMixer(root);
					const action = this.mixer.clipAction(gltf.animations[0]);
					action.play();
				}
			},
			undefined,
			(error) => {
				console.error('Error loading hamburger model', error);
			},
		);
	}

	/**
	 * Attaches lil-gui controls for floor material and lights.
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createBlenderModelsGui({
			floorMaterial: this.floor.material,
			ambientLight: this.ambientLight,
			directionalLight: this.directionalLight,
		});
	}

	/**
	 * Main render loop: updates mixer, controls and renders the scene.
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();
			const deltaTime = elapsedTime - this.previousTime;
			this.previousTime = elapsedTime;

			if (this.mixer) {
				this.mixer.update(deltaTime);
			}

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Keeps camera aspect and renderer size in sync with window dimensions.
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

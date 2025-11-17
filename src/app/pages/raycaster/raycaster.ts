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

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-raycaster',
	standalone: true,
	imports: [],
	templateUrl: './raycaster.html',
	styleUrl: './raycaster.scss',
})
export class Raycaster implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** Template canvas reference: <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Animated test objects */
	private object1!: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
	private object2!: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
	private object3!: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

	/** Duck model loaded via GLTF */
	private gltfLoader!: GLTFLoader;
	private duckModel?: THREE.Object3D;

	/** Raycasting helpers */
	private raycaster = new THREE.Raycaster();
	private mouse = new THREE.Vector2();
	private currentIntersect: THREE.Intersection | null = null;

	/** Animation clock */
	private clock = new THREE.Clock();

	/** Raycaster debug parameters, controlled from GUI */
	private raycasterParams = {
		mode: 'mouse' as 'mouse' | 'fixed',
		originX: -3,
		originY: 0,
		originZ: 0,
		dirX: 1,
		dirY: 0,
		dirZ: 0,
		spheresBaseColor: '#ff0000',
		spheresHoverColor: '#0000ff',
		duckHoverScale: 1.2,
		enableDuckScale: true,
	};

	/** rAF id for proper cleanup */
	private animationFrameId?: number;

	ngAfterViewInit(): void {
		this.initThree();
		this.initObjects();
		this.initLights();
		this.initModel();

		// Create raycaster debug GUI (mouse/fixed, origin/dir, colors, duck scale)
		this.debugGuiService.createRaycasterGui(this.raycasterParams);

		this.startLoop();

		window.addEventListener('resize', this.handleResize);
		window.addEventListener('mousemove', this.handleMouseMove);
		window.addEventListener('click', this.handleClick);
	}

	ngOnDestroy(): void {
		cancelAnimationFrame(this.animationFrameId ?? 0);

		window.removeEventListener('resize', this.handleResize);
		window.removeEventListener('mousemove', this.handleMouseMove);
		window.removeEventListener('click', this.handleClick);

		this.controls?.dispose();
		this.renderer?.dispose();

		// Dispose geometries/materials of test spheres
		[this.object1, this.object2, this.object3].forEach((obj) => {
			obj.geometry.dispose();
			obj.material.dispose();
		});

		// Dispose duck model if present
		if (this.duckModel) {
			this.scene.remove(this.duckModel);
			this.duckModel.traverse((child) => {
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
	 * Initializes base Three.js setup:
	 * - scene
	 * - camera
	 * - renderer
	 * - orbit controls
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		this.scene = this.threeCoreService.createScene();

		// Camera
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.z = 3;
		this.scene.add(this.camera);

		// Renderer
		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Controls
		this.controls = this.threeCoreService.createOrbitControls(
			this.camera,
			canvas,
		);
		this.controls.enableDamping = true;
	}

	/**
	 * Creates three animated spheres that we will raycast against.
	 */
	private initObjects(): void {
		this.object1 = new THREE.Mesh(
			new THREE.SphereGeometry(0.5, 16, 16),
			new THREE.MeshBasicMaterial({ color: '#ff0000' }),
		);
		this.object1.position.x = -2;

		this.object2 = new THREE.Mesh(
			new THREE.SphereGeometry(0.5, 16, 16),
			new THREE.MeshBasicMaterial({ color: '#ff0000' }),
		);

		this.object3 = new THREE.Mesh(
			new THREE.SphereGeometry(0.5, 16, 16),
			new THREE.MeshBasicMaterial({ color: '#ff0000' }),
		);
		this.object3.position.x = 2;

		this.scene.add(this.object1, this.object2, this.object3);
	}

	/**
	 * Adds simple ambient + directional lighting.
	 */
	private initLights(): void {
		const ambientLight = new THREE.AmbientLight('#ffffff', 0.9);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight('#ffffff', 2.1);
		directionalLight.position.set(1, 2, 3);
		this.scene.add(directionalLight);
	}

	/**
	 * Loads the binary GLTF duck model and places it slightly below the spheres.
	 * We will also test raycasting against this model.
	 */
	private initModel(): void {
		this.gltfLoader = new GLTFLoader();

		this.gltfLoader.load(
			'/models/Duck/glTF-Binary/Duck.glb',
			(gltf) => {
				this.duckModel = gltf.scene;
				this.duckModel.position.y = -1.2;
				this.scene.add(this.duckModel);
			},
			undefined,
			(error) => {
				console.error('Error loading duck model', error);
			},
		);
	}

	/**
	 * Main animation loop:
	 * - animates spheres
	 * - casts ray (mouse / fixed, from GUI)
	 * - updates spheres colors from GUI
	 * - handles mouse enter / leave / click
	 * - scales duck model on hover (GUI-controlled)
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();

			// Animate spheres
			this.object1.position.y = Math.sin(elapsedTime * 0.3) * 1.5;
			this.object2.position.y = Math.sin(elapsedTime * 0.8) * 1.5;
			this.object3.position.y = Math.sin(elapsedTime * 1.4) * 1.5;

			// Choose ray source: mouse vs fixed (from GUI)
			if (this.raycasterParams.mode === 'mouse') {
				this.raycaster.setFromCamera(this.mouse, this.camera);
			} else {
				const origin = new THREE.Vector3(
					this.raycasterParams.originX,
					this.raycasterParams.originY,
					this.raycasterParams.originZ,
				);

				const direction = new THREE.Vector3(
					this.raycasterParams.dirX,
					this.raycasterParams.dirY,
					this.raycasterParams.dirZ,
				).normalize();

				this.raycaster.set(origin, direction);
			}

			const objectsToTest = [this.object1, this.object2, this.object3];
			const intersects = this.raycaster.intersectObjects(objectsToTest);

			// Visual feedback for spheres: base / hover colors from GUI
			for (const object of objectsToTest) {
				const material = object.material as THREE.MeshBasicMaterial;
				material.color.set(this.raycasterParams.spheresBaseColor);
			}

			for (const intersect of intersects) {
				const mesh = intersect.object as THREE.Mesh<
					THREE.SphereGeometry,
					THREE.MeshBasicMaterial
				>;
				mesh.material.color.set(this.raycasterParams.spheresHoverColor);
			}

			// Hover enter / leave events
			if (intersects.length > 0) {
				if (!this.currentIntersect) {
					console.log('mouse enter');
				}
				this.currentIntersect = intersects[0];
			} else {
				if (this.currentIntersect) {
					console.log('mouse leave');
				}
				this.currentIntersect = null;
			}

			// Test intersection with duck model and scale on hover
			if (this.duckModel) {
				const modelIntersects = this.raycaster.intersectObject(
					this.duckModel,
					true,
				);

				if (
					modelIntersects.length > 0 &&
					this.raycasterParams.enableDuckScale
				) {
					const s = this.raycasterParams.duckHoverScale;
					this.duckModel.scale.set(s, s, s);
				} else {
					this.duckModel.scale.set(1, 1, 1);
				}
			}

			// Update controls
			this.controls.update();

			// Render
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Keeps camera aspect ratio and renderer size in sync with window size.
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};

	/**
	 * Tracks mouse position in normalized device coordinates:
	 * -1..1 horizontally and vertically.
	 */
	private handleMouseMove = (event: MouseEvent) => {
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.mouse.x = (event.clientX / width) * 2 - 1;
		this.mouse.y = -((event.clientY / height) * 2 - 1);
	};

	/**
	 * Handles click on current intersected sphere.
	 */
	private handleClick = () => {
		if (!this.currentIntersect) {
			return;
		}

		switch (this.currentIntersect.object) {
			case this.object1:
				console.log('click on object 1');
				break;
			case this.object2:
				console.log('click on object 2');
				break;
			case this.object3:
				console.log('click on object 3');
				break;
		}
	};
}

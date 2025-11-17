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
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-realistic-render',
	standalone: true,
	imports: [],
	templateUrl: './realistic-render.html',
	styleUrl: './realistic-render.scss',
})
export class RealisticRender implements AfterViewInit, OnDestroy {
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
	private textureLoader = new THREE.TextureLoader();

	/** Lights */
	private directionalLight!: THREE.DirectionalLight;
	private directionalLightHelper?: THREE.CameraHelper;

	/** Scene objects */
	private floor!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
	private wall!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
	private flightHelmet?: THREE.Object3D;

	/** Debug GUI */
	private gui!: GUI;

	/** rAF id */
	private animationFrameId?: number;

	ngAfterViewInit(): void {
		this.initThree();
		this.initEnvironment();
		this.initLights();
		this.initGeometry();
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

		if (this.floor) {
			this.scene.remove(this.floor);
			this.floor.geometry.dispose();
			this.floor.material.dispose();
		}

		if (this.wall) {
			this.scene.remove(this.wall);
			this.wall.geometry.dispose();
			this.wall.material.dispose();
		}

		if (this.directionalLightHelper) {
			this.scene.remove(this.directionalLightHelper);
		}

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

	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		this.scene = this.threeCoreService.createScene();

		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(4, 5, 4);
		this.scene.add(this.camera);

		this.renderer = this.threeCoreService.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.renderer.toneMapping = THREE.ReinhardToneMapping;
		this.renderer.toneMappingExposure = 3;

		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.target.y = 3.5;
		this.controls.enableDamping = true;
	}

	private initEnvironment(): void {
		const sceneAny = this.scene as any;
		sceneAny.environmentIntensity = 1;

		this.rgbeLoader.load('/environmentMaps/0/2k.hdr', (environmentMap) => {
			environmentMap.mapping = THREE.EquirectangularReflectionMapping;

			this.scene.background = environmentMap;
			this.scene.environment = environmentMap;
		});
	}

	private initLights(): void {
		this.directionalLight = new THREE.DirectionalLight('#ffffff', 6);
		this.directionalLight.position.set(-4, 6.5, 2.5);
		this.scene.add(this.directionalLight);

		this.directionalLight.castShadow = true;
		this.directionalLight.shadow.camera.far = 15;
		this.directionalLight.shadow.normalBias = 0.027;
		this.directionalLight.shadow.bias = -0.004;
		this.directionalLight.shadow.mapSize.set(512, 512);

		this.directionalLight.target.position.set(0, 4, 0);
		this.directionalLight.target.updateWorldMatrix(true, true);

		this.directionalLightHelper = new THREE.CameraHelper(
			this.directionalLight.shadow.camera,
		);
		this.directionalLightHelper.visible = false;
		this.scene.add(this.directionalLightHelper);
	}

	private initGeometry(): void {
		const floorColorTexture = this.textureLoader.load(
			'/textures/wood_cabinet_worn_long/wood_cabinet_worn_long_diff_1k.jpg',
		);
		const floorNormalTexture = this.textureLoader.load(
			'/textures/wood_cabinet_worn_long/wood_cabinet_worn_long_nor_gl_1k.png',
		);
		const floorAORMTexture = this.textureLoader.load(
			'/textures/wood_cabinet_worn_long/wood_cabinet_worn_long_arm_1k.jpg',
		);

		floorColorTexture.colorSpace = THREE.SRGBColorSpace;

		this.floor = new THREE.Mesh(
			new THREE.PlaneGeometry(8, 8),
			new THREE.MeshStandardMaterial({
				map: floorColorTexture,
				normalMap: floorNormalTexture,
				aoMap: floorAORMTexture,
				roughnessMap: floorAORMTexture,
				metalnessMap: floorAORMTexture,
			}),
		);
		this.floor.rotation.x = -Math.PI * 0.5;
		this.floor.receiveShadow = true;
		this.scene.add(this.floor);

		const wallColorTexture = this.textureLoader.load(
			'/textures/castle_brick_broken_06/castle_brick_broken_06_diff_1k.jpg',
		);
		const wallNormalTexture = this.textureLoader.load(
			'/textures/castle_brick_broken_06/castle_brick_broken_06_nor_gl_1k.png',
		);
		const wallAORMTexture = this.textureLoader.load(
			'/textures/castle_brick_broken_06/castle_brick_broken_06_arm_1k.jpg',
		);

		wallColorTexture.colorSpace = THREE.SRGBColorSpace;

		this.wall = new THREE.Mesh(
			new THREE.PlaneGeometry(8, 8),
			new THREE.MeshStandardMaterial({
				map: wallColorTexture,
				normalMap: wallNormalTexture,
				aoMap: wallAORMTexture,
				roughnessMap: wallAORMTexture,
				metalnessMap: wallAORMTexture,
			}),
		);
		this.wall.position.y = 4;
		this.wall.position.z = -4;
		this.wall.receiveShadow = true;
		this.scene.add(this.wall);
	}

	private initModel(): void {
		this.gltfLoader.load(
			'/models/FlightHelmet/glTF/FlightHelmet.gltf',
			(gltf) => {
				this.flightHelmet = gltf.scene;
				this.flightHelmet.scale.set(10, 10, 10);
				this.scene.add(this.flightHelmet);

				this.updateAllMaterials();
			},
			undefined,
			(error) => {
				console.error('Error loading FlightHelmet', error);
			},
		);
	}

	private updateAllMaterials(): void {
		this.scene.traverse((child) => {
			if ((child as any).isMesh) {
				const mesh = child as THREE.Mesh;
				mesh.castShadow = true;
				mesh.receiveShadow = true;
			}
		});
	}

	private initGui(): void {
		this.gui = this.debugGuiService.createRealisticRenderGui(
			this.scene,
			this.renderer,
			this.directionalLight,
			this.directionalLightHelper,
		);
	}

	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

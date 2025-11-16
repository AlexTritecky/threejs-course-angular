import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-shadows',
	standalone: true,
	imports: [],
	templateUrl: './shadows.html',
	styleUrl: './shadows.scss',
})
export class Shadows implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Lights */
	private ambientLight!: THREE.AmbientLight;
	private directionalLight!: THREE.DirectionalLight;
	private spotLight!: THREE.SpotLight;
	private pointLight!: THREE.PointLight;

	/** Shadow camera helpers */
	private directionalLightCameraHelper!: THREE.CameraHelper;
	private spotLightCameraHelper!: THREE.CameraHelper;
	private pointLightCameraHelper!: THREE.CameraHelper;

	/** Shared material + meshes */
	private material!: THREE.MeshStandardMaterial;
	private sphere!: THREE.Mesh;
	private plane!: THREE.Mesh;
	private sphereShadow!: THREE.Mesh;

	/** Textures */
	private bakedShadow!: THREE.Texture;
	private simpleShadow!: THREE.Texture;

	/** GUI instance */
	private gui?: GUI;

	/** Animation */
	private animationFrameId?: number;
	private clock = new THREE.Clock();

	/** Config exposed to GUI */
	private readonly debugConfig = {
		useRealShadows: false,
		showDirectionalHelper: false,
		showSpotHelper: false,
		showPointHelper: false,
	};

	ngAfterViewInit(): void {
		this.initThree();
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
	}

	/**
	 * Basic Three.js setup:
	 * - scene, camera, renderer, controls
	 * - lights + their shadow configuration
	 * - sphere + plane + fake blob shadow
	 * - shadow maps setup on renderer
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		// Scene
		this.scene = this.threeCoreService.createScene();

		// Textures
		const textureLoader = new THREE.TextureLoader();
		this.bakedShadow = textureLoader.load('/textures/bakedShadow.jpg');
		this.bakedShadow.colorSpace = THREE.SRGBColorSpace;

		this.simpleShadow = textureLoader.load('/textures/simpleShadow.jpg');

		// Lights
		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		this.scene.add(this.ambientLight);

		// Directional light (main shadow caster)
		this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.3);
		this.directionalLight.castShadow = true;
		this.directionalLight.shadow.mapSize.width = 1024;
		this.directionalLight.shadow.mapSize.height = 1024;
		this.directionalLight.shadow.camera.near = 1;
		this.directionalLight.shadow.camera.far = 6;
		this.directionalLight.shadow.camera.top = 2;
		this.directionalLight.shadow.camera.right = 2;
		this.directionalLight.shadow.camera.bottom = -2;
		this.directionalLight.shadow.camera.left = -2;
		this.directionalLight.shadow.radius = 10;
		this.directionalLight.position.set(2, 2, -1);
		this.scene.add(this.directionalLight);

		this.directionalLightCameraHelper = new THREE.CameraHelper(
			this.directionalLight.shadow.camera,
		);
		this.directionalLightCameraHelper.visible = false;
		this.scene.add(this.directionalLightCameraHelper);

		// Spot light
		this.spotLight = new THREE.SpotLight(0xffffff, 3.6, 10, Math.PI * 0.3);
		this.spotLight.castShadow = true;
		this.spotLight.shadow.mapSize.width = 1024;
		this.spotLight.shadow.mapSize.height = 1024;
		this.spotLight.shadow.camera.near = 1;
		this.spotLight.shadow.camera.far = 6;
		this.spotLight.position.set(0, 2, 2);
		this.scene.add(this.spotLight);
		this.scene.add(this.spotLight.target);

		this.spotLightCameraHelper = new THREE.CameraHelper(this.spotLight.shadow.camera);
		this.spotLightCameraHelper.visible = false;
		this.scene.add(this.spotLightCameraHelper);

		// Point light
		this.pointLight = new THREE.PointLight(0xffffff, 2.7);
		this.pointLight.castShadow = true;
		this.pointLight.shadow.mapSize.width = 1024;
		this.pointLight.shadow.mapSize.height = 1024;
		this.pointLight.shadow.camera.near = 0.1;
		this.pointLight.shadow.camera.far = 5;
		this.pointLight.position.set(-1, 1, 0);
		this.scene.add(this.pointLight);

		this.pointLightCameraHelper = new THREE.CameraHelper(this.pointLight.shadow.camera as any);
		this.pointLightCameraHelper.visible = false;
		this.scene.add(this.pointLightCameraHelper);

		// Material
		this.material = new THREE.MeshStandardMaterial();
		this.material.roughness = 0.7;

		// Objects
		this.sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), this.material);
		this.sphere.castShadow = true;

		this.plane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), this.material);
		this.plane.receiveShadow = true;
		this.plane.rotation.x = -Math.PI * 0.5;
		this.plane.position.y = -0.5;

		// Fake "blob" shadow
		this.sphereShadow = new THREE.Mesh(
			new THREE.PlaneGeometry(1.5, 1.5),
			new THREE.MeshBasicMaterial({
				color: 0x000000,
				transparent: true,
				alphaMap: this.simpleShadow,
			}),
		);
		this.sphereShadow.rotation.x = -Math.PI * 0.5;
		this.sphereShadow.position.y = this.plane.position.y + 0.01;

		this.scene.add(this.sphere, this.sphereShadow, this.plane);

		// Camera
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(1, 1, 2);
		this.scene.add(this.camera);

		// Renderer
		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Shadow map config
		this.renderer.shadowMap.enabled = false; // start with fake shadow only
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Controls
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	/**
	 * Sets up lil-gui controls for:
	 * - ambient / directional light
	 * - material properties
	 * - real shadows toggle
	 * - helpers visibility
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createShadowsGui({
			renderer: this.renderer,
			ambientLight: this.ambientLight,
			directionalLight: this.directionalLight,
			spotLight: this.spotLight,
			pointLight: this.pointLight,
			material: this.material,
			sphere: this.sphere,
			plane: this.plane,
			sphereShadow: this.sphereShadow,
			helpers: {
				directional: this.directionalLightCameraHelper,
				spot: this.spotLightCameraHelper,
				point: this.pointLightCameraHelper,
			},
		});
	}

	/**
	 * Main render loop:
	 * - animates sphere
	 * - updates fake shadow plane
	 * - updates controls and renders the scene
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();

			// Animate sphere
			this.sphere.position.x = Math.cos(elapsedTime) * 1.5;
			this.sphere.position.z = Math.sin(elapsedTime) * 1.5;
			this.sphere.position.y = Math.abs(Math.sin(elapsedTime * 3));

			// Fake shadow follows sphere on XZ + fades with height
			this.sphereShadow.position.x = this.sphere.position.x;
			this.sphereShadow.position.z = this.sphere.position.z;
			(this.sphereShadow.material as THREE.MeshBasicMaterial).opacity =
				(1 - this.sphere.position.y) * 0.3;

			// Update controls
			this.controls.update();

			// Render
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Resize handler to keep camera aspect & renderer size in sync.
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

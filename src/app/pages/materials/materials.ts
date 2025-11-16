import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-materials',
	standalone: true,
	imports: [],
	templateUrl: './materials.html',
	styleUrl: './materials.scss',
})
export class Materials implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);
	/** <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Demo meshes sharing the same material */
	private sphere!: THREE.Mesh;
	private plane!: THREE.Mesh;
	private torus!: THREE.Mesh;

	/** All materials we can switch between via GUI */
	private materials!: {
		Basic: THREE.MeshBasicMaterial;
		Normal: THREE.MeshNormalMaterial;
		Matcap: THREE.MeshMatcapMaterial;
		Toon: THREE.MeshToonMaterial;
		Standard: THREE.MeshStandardMaterial;
		Physical: THREE.MeshPhysicalMaterial;
	};

	/** Currently active material */
	private activeMaterial!: THREE.Material;

	/** Debug GUI */
	private gui!: GUI;

	/** Animation loop ID */
	private animationFrameId?: number;

	/** Clock for rotation animations */
	private clock = new THREE.Clock();

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
	 * Sets up:
	 * - scene + HDR environment map
	 * - textures (door set, matcap, gradient)
	 * - all materials
	 * - sphere / plane / torus using the same material
	 * - camera, renderer, OrbitControls
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		/** Scene */
		this.scene = this.threeCoreService.createScene();

		/** Textures */
		const textureLoader = new THREE.TextureLoader();

		const doorColorTexture = textureLoader.load('/textures/door/color.jpg');
		const doorAlphaTexture = textureLoader.load('/textures/door/alpha.jpg');
		const doorAmbientOcclusionTexture = textureLoader.load(
			'/textures/door/ambientOcclusion.jpg',
		);
		const doorHeightTexture = textureLoader.load('/textures/door/height.jpg');
		const doorNormalTexture = textureLoader.load('/textures/door/normal.jpg');
		const doorMetalnessTexture = textureLoader.load('/textures/door/metalness.jpg');
		const doorRoughnessTexture = textureLoader.load('/textures/door/roughness.jpg');

		const matcapTexture = textureLoader.load('/textures/matcaps/8.png');
		const gradientTexture = textureLoader.load('/textures/gradients/5.jpg');

		doorColorTexture.colorSpace = THREE.SRGBColorSpace;
		matcapTexture.colorSpace = THREE.SRGBColorSpace;

		/** HDR environment map */
		const rgbeLoader = new RGBELoader();
		rgbeLoader.load('/textures/environmentMap/2k.hdr', (environmentMap) => {
			environmentMap.mapping = THREE.EquirectangularReflectionMapping;
			this.scene.background = environmentMap;
			this.scene.environment = environmentMap;
		});

		/** Materials */

		// MeshBasicMaterial
		const basicMat = new THREE.MeshBasicMaterial({
			map: doorColorTexture,
			transparent: true,
			alphaMap: doorAlphaTexture,
			side: THREE.DoubleSide,
		});

		// MeshNormalMaterial
		const normalMat = new THREE.MeshNormalMaterial({
			flatShading: true,
		});

		// MeshMatcapMaterial
		const matcapMat = new THREE.MeshMatcapMaterial({
			matcap: matcapTexture,
		});

		// MeshToonMaterial
		gradientTexture.minFilter = THREE.NearestFilter;
		gradientTexture.magFilter = THREE.NearestFilter;
		gradientTexture.generateMipmaps = false;

		const toonMat = new THREE.MeshToonMaterial({
			gradientMap: gradientTexture,
			color: new THREE.Color('#ffffff'),
		});

		// MeshStandardMaterial (full door PBR set)
		const standardMat = new THREE.MeshStandardMaterial({
			map: doorColorTexture,
			aoMap: doorAmbientOcclusionTexture,
			aoMapIntensity: 1,
			displacementMap: doorHeightTexture,
			displacementScale: 0.1,
			metalnessMap: doorMetalnessTexture,
			roughnessMap: doorRoughnessTexture,
			metalness: 1,
			roughness: 1,
			normalMap: doorNormalTexture,
			normalScale: new THREE.Vector2(0.5, 0.5),
			transparent: true,
			alphaMap: doorAlphaTexture,
		});

		// MeshPhysicalMaterial (glass-like + env map)
		const physicalMat = new THREE.MeshPhysicalMaterial({
			metalness: 0,
			roughness: 0.15,
			transmission: 1,
			ior: 1.5,
			thickness: 0.5,
		});

		this.materials = {
			Basic: basicMat,
			Normal: normalMat,
			Matcap: matcapMat,
			Toon: toonMat,
			Standard: standardMat,
			Physical: physicalMat,
		};

		/** Geometry & meshes */
		const sphereGeom = new THREE.SphereGeometry(0.5, 64, 64);
		const planeGeom = new THREE.PlaneGeometry(1, 1, 100, 100);
		const torusGeom = new THREE.TorusGeometry(0.3, 0.2, 64, 128);

		// Default material — Physical
		this.activeMaterial = this.materials.Physical;

		this.sphere = new THREE.Mesh(sphereGeom, this.activeMaterial);
		this.sphere.position.x = -1.5;

		this.plane = new THREE.Mesh(planeGeom, this.activeMaterial);

		this.torus = new THREE.Mesh(torusGeom, this.activeMaterial);
		this.torus.position.x = 1.5;

		this.scene.add(this.sphere, this.plane, this.torus);

		/** Camera */
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(1, 1, 2);
		this.scene.add(this.camera);

		/** Renderer */
		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Better for HDR environment
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;

		/** OrbitControls */
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	/**
	 * GUI:
	 * - dropdown to switch material type
	 * - basic tweaks for Standard and Physical materials
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createMaterialsGui(this.materials, (selectedMat) =>
			this.applyMaterial(selectedMat),
		);
	}

	private applyMaterial(mat: THREE.Material): void {
		this.activeMaterial = mat;
		this.sphere.material = mat;
		this.plane.material = mat;
		this.torus.material = mat;
	}

	/**
	 * Main animation loop:
	 * - rotates sphere / plane / torus
	 * - updates OrbitControls
	 * - renders the scene
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();

			// Rotation of objects
			const ry = 0.1 * elapsedTime;
			const rx = -0.15 * elapsedTime;

			this.sphere.rotation.set(rx, ry, 0);
			this.plane.rotation.set(rx, ry, 0);
			this.torus.rotation.set(rx, ry, 0);

			// Controls
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
}

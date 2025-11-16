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
import { Sky } from 'three/addons/objects/Sky.js';
import GUI from 'lil-gui';
import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-haunted-house',
	standalone: true,
	imports: [],
	templateUrl: './haunted-house.html',
	styleUrl: './haunted-house.scss',
})
export class HauntedHouse implements AfterViewInit, OnDestroy {
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	readonly threeCoreService = inject(ThreeCoreService);
	readonly debugGuiService = inject(DebugGuiService);

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Lights */
	private ambientLight!: THREE.AmbientLight;
	private directionalLight!: THREE.DirectionalLight;
	private doorLight!: THREE.PointLight;
	private ghost1!: THREE.PointLight;
	private ghost2!: THREE.PointLight;
	private ghost3!: THREE.PointLight;

	/** Meshes / groups */
	private floor!: THREE.Mesh;
	private house!: THREE.Group;
	private walls!: THREE.Mesh;
	private roof!: THREE.Mesh;
	private door!: THREE.Mesh;
	private bushesGroup!: THREE.Group;
	private graves!: THREE.Group;

	/** GUI */
	private gui?: GUI;

	/** Animation */
	private timer = new THREE.Timer();
	private animationFrameId?: number;

	ngAfterViewInit(): void {
		this.initThree();
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
	 * Init scene, textures, house, lights, shadows, sky, fog, camera, renderer, controls, GUI
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found for HauntedHouse.');
			return;
		}

		this.scene = this.threeCoreService.createScene();
		const textureLoader = new THREE.TextureLoader();

		// Floor
		const floorAlphaTexture = textureLoader.load('/floor/alpha.webp');
		const floorColorTexture = textureLoader.load(
			'/floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_diff_1k.webp',
		);
		const floorARMTexture = textureLoader.load(
			'/floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_arm_1k.webp',
		);
		const floorNormalTexture = textureLoader.load(
			'/floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_nor_gl_1k.webp',
		);
		const floorDisplacementTexture = textureLoader.load(
			'/floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_disp_1k.webp',
		);

		floorColorTexture.colorSpace = THREE.SRGBColorSpace;

		floorColorTexture.repeat.set(8, 8);
		floorARMTexture.repeat.set(8, 8);
		floorNormalTexture.repeat.set(8, 8);
		floorDisplacementTexture.repeat.set(8, 8);

		floorColorTexture.wrapS = THREE.RepeatWrapping;
		floorARMTexture.wrapS = THREE.RepeatWrapping;
		floorNormalTexture.wrapS = THREE.RepeatWrapping;
		floorDisplacementTexture.wrapS = THREE.RepeatWrapping;

		floorColorTexture.wrapT = THREE.RepeatWrapping;
		floorARMTexture.wrapT = THREE.RepeatWrapping;
		floorNormalTexture.wrapT = THREE.RepeatWrapping;
		floorDisplacementTexture.wrapT = THREE.RepeatWrapping;

		// Wall
		const wallColorTexture = textureLoader.load(
			'/wall/castle_brick_broken_06_1k/castle_brick_broken_06_diff_1k.webp',
		);
		const wallARMTexture = textureLoader.load(
			'/wall/castle_brick_broken_06_1k/castle_brick_broken_06_arm_1k.webp',
		);
		const wallNormalTexture = textureLoader.load(
			'/wall/castle_brick_broken_06_1k/castle_brick_broken_06_nor_gl_1k.webp',
		);

		wallColorTexture.colorSpace = THREE.SRGBColorSpace;

		// Roof
		const roofColorTexture = textureLoader.load(
			'/roof/roof_slates_02_1k/roof_slates_02_diff_1k.webp',
		);
		const roofARMTexture = textureLoader.load(
			'/roof/roof_slates_02_1k/roof_slates_02_arm_1k.webp',
		);
		const roofNormalTexture = textureLoader.load(
			'/roof/roof_slates_02_1k/roof_slates_02_nor_gl_1k.webp',
		);

		roofColorTexture.colorSpace = THREE.SRGBColorSpace;

		roofColorTexture.repeat.set(3, 1);
		roofARMTexture.repeat.set(3, 1);
		roofNormalTexture.repeat.set(3, 1);

		roofColorTexture.wrapS = THREE.RepeatWrapping;
		roofARMTexture.wrapS = THREE.RepeatWrapping;
		roofNormalTexture.wrapS = THREE.RepeatWrapping;

		// Bush
		const bushColorTexture = textureLoader.load(
			'/bush/leaves_forest_ground_1k/leaves_forest_ground_diff_1k.webp',
		);
		const bushARMTexture = textureLoader.load(
			'/bush/leaves_forest_ground_1k/leaves_forest_ground_arm_1k.webp',
		);
		const bushNormalTexture = textureLoader.load(
			'/bush/leaves_forest_ground_1k/leaves_forest_ground_nor_gl_1k.webp',
		);

		bushColorTexture.colorSpace = THREE.SRGBColorSpace;

		bushColorTexture.repeat.set(2, 1);
		bushARMTexture.repeat.set(2, 1);
		bushNormalTexture.repeat.set(2, 1);

		bushColorTexture.wrapS = THREE.RepeatWrapping;
		bushARMTexture.wrapS = THREE.RepeatWrapping;
		bushNormalTexture.wrapS = THREE.RepeatWrapping;

		// Grave
		const graveColorTexture = textureLoader.load(
			'/grave/plastered_stone_wall_1k/plastered_stone_wall_diff_1k.webp',
		);
		const graveARMTexture = textureLoader.load(
			'/grave/plastered_stone_wall_1k/plastered_stone_wall_arm_1k.webp',
		);
		const graveNormalTexture = textureLoader.load(
			'/grave/plastered_stone_wall_1k/plastered_stone_wall_nor_gl_1k.webp',
		);

		graveColorTexture.colorSpace = THREE.SRGBColorSpace;

		graveColorTexture.repeat.set(0.3, 0.4);
		graveARMTexture.repeat.set(0.3, 0.4);
		graveNormalTexture.repeat.set(0.3, 0.4);

		// Door
		const doorColorTexture = textureLoader.load('/door/color.webp');
		const doorAlphaTexture = textureLoader.load('/door/alpha.webp');
		const doorAmbientOcclusionTexture = textureLoader.load(
			'/door/ambientOcclusion.webp',
		);
		const doorHeightTexture = textureLoader.load('/door/height.webp');
		const doorNormalTexture = textureLoader.load('/door/normal.webp');
		const doorMetalnessTexture = textureLoader.load('/door/metalness.webp');
		const doorRoughnessTexture = textureLoader.load('/door/roughness.webp');

		doorColorTexture.colorSpace = THREE.SRGBColorSpace;

		/**
		 * House
		 */
		// Floor
		this.floor = new THREE.Mesh(
			new THREE.PlaneGeometry(20, 20, 100, 100),
			new THREE.MeshStandardMaterial({
				alphaMap: floorAlphaTexture,
				transparent: true,
				map: floorColorTexture,
				aoMap: floorARMTexture,
				roughnessMap: floorARMTexture,
				metalnessMap: floorARMTexture,
				normalMap: floorNormalTexture,
				displacementMap: floorDisplacementTexture,
				displacementScale: 0.3,
				displacementBias: -0.2,
			}),
		);
		this.floor.rotation.x = -Math.PI * 0.5;
		this.scene.add(this.floor);

		// House container
		this.house = new THREE.Group();
		this.scene.add(this.house);

		// Walls
		this.walls = new THREE.Mesh(
			new THREE.BoxGeometry(4, 2.5, 4),
			new THREE.MeshStandardMaterial({
				map: wallColorTexture,
				aoMap: wallARMTexture,
				roughnessMap: wallARMTexture,
				metalnessMap: wallARMTexture,
				normalMap: wallNormalTexture,
			}),
		);
		this.walls.position.y += 1.25;
		this.house.add(this.walls);

		// Roof
		this.roof = new THREE.Mesh(
			new THREE.ConeGeometry(3.5, 1.5, 4),
			new THREE.MeshStandardMaterial({
				map: roofColorTexture,
				aoMap: roofARMTexture,
				roughnessMap: roofARMTexture,
				metalnessMap: roofARMTexture,
				normalMap: roofNormalTexture,
			}),
		);
		this.roof.position.y = 2.5 + 0.75;
		this.roof.rotation.y = Math.PI * 0.25;
		this.house.add(this.roof);

		// Door
		this.door = new THREE.Mesh(
			new THREE.PlaneGeometry(2.2, 2.2, 100, 100),
			new THREE.MeshStandardMaterial({
				map: doorColorTexture,
				transparent: true,
				alphaMap: doorAlphaTexture,
				aoMap: doorAmbientOcclusionTexture,
				displacementMap: doorHeightTexture,
				displacementScale: 0.15,
				displacementBias: -0.04,
				normalMap: doorNormalTexture,
				metalnessMap: doorMetalnessTexture,
				roughnessMap: doorRoughnessTexture,
			}),
		);
		this.door.position.y = 1;
		this.door.position.z = 2 + 0.01;
		this.house.add(this.door);

		// Bushes
		const bushGeometry = new THREE.SphereGeometry(1, 16, 16);
		const bushMaterial = new THREE.MeshStandardMaterial({
			color: '#ccffcc',
			map: bushColorTexture,
			aoMap: bushARMTexture,
			roughnessMap: bushARMTexture,
			metalnessMap: bushARMTexture,
			normalMap: bushNormalTexture,
		});

		this.bushesGroup = new THREE.Group();

		const bush1 = new THREE.Mesh(bushGeometry, bushMaterial);
		bush1.scale.set(0.5, 0.5, 0.5);
		bush1.position.set(0.8, 0.2, 2.2);
		bush1.rotation.x = -0.75;

		const bush2 = new THREE.Mesh(bushGeometry, bushMaterial);
		bush2.scale.set(0.25, 0.25, 0.25);
		bush2.position.set(1.4, 0.1, 2.1);
		bush2.rotation.x = -0.75;

		const bush3 = new THREE.Mesh(bushGeometry, bushMaterial);
		bush3.scale.set(0.4, 0.4, 0.4);
		bush3.position.set(-0.8, 0.1, 2.2);
		bush3.rotation.x = -0.75;

		const bush4 = new THREE.Mesh(bushGeometry, bushMaterial);
		bush4.scale.set(0.15, 0.15, 0.15);
		bush4.position.set(-1, 0.05, 2.6);
		bush4.rotation.x = -0.75;

		this.bushesGroup.add(bush1, bush2, bush3, bush4);
		this.house.add(this.bushesGroup);

		// Graves
		const graveGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.2);
		const graveMaterial = new THREE.MeshStandardMaterial({
			map: graveColorTexture,
			normalMap: graveNormalTexture,
			aoMap: graveARMTexture,
			roughnessMap: graveARMTexture,
			metalnessMap: graveARMTexture,
		});

		this.graves = new THREE.Group();
		this.scene.add(this.graves);

		for (let i = 0; i < 30; i++) {
			const angle = Math.random() * Math.PI * 2;
			const radius = 3 + Math.random() * 4;
			const x = Math.sin(angle) * radius;
			const z = Math.cos(angle) * radius;

			const grave = new THREE.Mesh(graveGeometry, graveMaterial);
			grave.position.x = x;
			grave.position.y = Math.random() * 0.4;
			grave.position.z = z;
			grave.rotation.x = (Math.random() - 0.5) * 0.4;
			grave.rotation.y = (Math.random() - 0.5) * 0.4;
			grave.rotation.z = (Math.random() - 0.5) * 0.4;

			this.graves.add(grave);
		}

		/**
		 * Lights
		 */
		// Ambient
		this.ambientLight = new THREE.AmbientLight('#86cdff', 0.275);
		this.scene.add(this.ambientLight);

		// Directional
		this.directionalLight = new THREE.DirectionalLight('#86cdff', 1);
		this.directionalLight.position.set(3, 2, -8);
		this.scene.add(this.directionalLight);

		// Door light
		this.doorLight = new THREE.PointLight('#ff7d46', 5);
		this.doorLight.position.set(0, 2.2, 2.5);
		this.house.add(this.doorLight);

		/**
		 * Ghosts
		 */
		this.ghost1 = new THREE.PointLight('#8800ff', 6);
		this.ghost2 = new THREE.PointLight('#ff0088', 6);
		this.ghost3 = new THREE.PointLight('#ff0000', 6);
		this.scene.add(this.ghost1, this.ghost2, this.ghost3);

		/**
		 * Camera + Renderer via ThreeCoreService
		 */
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(4, 2, 5);
		this.scene.add(this.camera);

		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		/**
		 * Shadows
		 */
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.directionalLight.castShadow = true;
		this.ghost1.castShadow = true;
		this.ghost2.castShadow = true;
		this.ghost3.castShadow = true;

		this.walls.castShadow = true;
		this.walls.receiveShadow = true;
		this.roof.castShadow = true;
		this.floor.receiveShadow = true;

		for (const grave of this.graves.children) {
			grave.castShadow = true;
			grave.receiveShadow = true;
		}

		this.directionalLight.shadow.mapSize.width = 256;
		this.directionalLight.shadow.mapSize.height = 256;
		this.directionalLight.shadow.camera.top = 8;
		this.directionalLight.shadow.camera.right = 8;
		this.directionalLight.shadow.camera.bottom = -8;
		this.directionalLight.shadow.camera.left = -8;
		this.directionalLight.shadow.camera.near = 1;
		this.directionalLight.shadow.camera.far = 20;

		this.ghost1.shadow.mapSize.width = 256;
		this.ghost1.shadow.mapSize.height = 256;
		this.ghost1.shadow.camera.far = 10;

		this.ghost2.shadow.mapSize.width = 256;
		this.ghost2.shadow.mapSize.height = 256;
		this.ghost2.shadow.camera.far = 10;

		this.ghost3.shadow.mapSize.width = 256;
		this.ghost3.shadow.mapSize.height = 256;
		this.ghost3.shadow.camera.far = 10;

		/**
		 * Sky
		 */
		const sky = new Sky();
		sky.scale.set(100, 100, 100);
		this.scene.add(sky);

		sky.material.uniforms['turbidity'].value = 10;
		sky.material.uniforms['rayleigh'].value = 3;
		sky.material.uniforms['mieCoefficient'].value = 0.1;
		sky.material.uniforms['mieDirectionalG'].value = 0.95;
		sky.material.uniforms['sunPosition'].value.set(0.3, -0.038, -0.95);

		/**
		 * Fog
		 */
		this.scene.fog = new THREE.FogExp2('#04343f', 0.1);

		/**
		 * Controls via ThreeCoreService
		 */
		this.controls = this.threeCoreService.createOrbitControls(
			this.camera,
			canvas,
		);

		/**
		 * GUI через DebugGuiService
		 */
		this.gui = this.debugGuiService.createHauntedHouseGui({
			ambientLight: this.ambientLight,
			directionalLight: this.directionalLight,
			floorMaterial: this.floor.material as THREE.MeshStandardMaterial,
		});
	}

	/**
	 * Animation loop
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			this.timer.update();
			const elapsedTime = this.timer.getElapsed();

			// Ghosts
			const ghost1Angle = elapsedTime * 0.5;
			this.ghost1.position.x = Math.cos(ghost1Angle) * 4;
			this.ghost1.position.z = Math.sin(ghost1Angle) * 4;
			this.ghost1.position.y =
				Math.sin(ghost1Angle) *
				Math.sin(ghost1Angle * 2.34) *
				Math.sin(ghost1Angle * 3.45);

			const ghost2Angle = -elapsedTime * 0.38;
			this.ghost2.position.x = Math.cos(ghost2Angle) * 5;
			this.ghost2.position.z = Math.sin(ghost2Angle) * 5;
			this.ghost2.position.y =
				Math.sin(ghost2Angle) *
				Math.sin(ghost2Angle * 2.34) *
				Math.sin(ghost2Angle * 3.45);

			const ghost3Angle = elapsedTime * 0.23;
			this.ghost3.position.x = Math.cos(ghost3Angle) * 6;
			this.ghost3.position.z = Math.sin(ghost3Angle) * 6;
			this.ghost3.position.y =
				Math.sin(ghost3Angle) *
				Math.sin(ghost3Angle * 2.34) *
				Math.sin(ghost3Angle * 3.45);

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

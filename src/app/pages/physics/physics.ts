import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-physics',
	standalone: true,
	imports: [],
	templateUrl: './physics.html',
	styleUrl: './physics.scss',
})
export class Physics implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** Canvas reference: <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Three.js core primitives */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Physics world (cannon-es) */
	private world!: CANNON.World;
	private defaultMaterial!: CANNON.Material;
	private contactMaterial!: CANNON.ContactMaterial;
	private objectsToUpdate: Array<{ mesh: THREE.Mesh; body: CANNON.Body }> = [];

	/** Shared environment map + geometries / materials for dynamic bodies */
	private envMap!: THREE.CubeTexture;
	private sphereGeometry = new THREE.SphereGeometry(1, 20, 20);
	private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
	private sphereMaterial!: THREE.MeshStandardMaterial;
	private boxMaterial!: THREE.MeshStandardMaterial;

	/** Floor mesh (receives shadows and visually matches physics plane) */
	private floorMesh!: THREE.Mesh;

	/** Debug GUI instance */
	private gui?: GUI;

	/** Impact sound for collisions */
	private hitSound = new Audio('/sounds/hit.mp3'); // or 'assets/sounds/hit.mp3'

	/** Time management for physics step */
	private clock = new THREE.Clock();
	private oldElapsedTime = 0;
	private animationId?: number;

	/** Resize handler: keeps camera + renderer in sync with viewport size */
	private readonly handleResize = () => {
		if (!this.camera || !this.renderer) return;
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};

	// ----------------------------------------------------------------
	// Lifecycle
	// ----------------------------------------------------------------

	ngAfterViewInit(): void {
		// 1. Init Three.js scene / camera / renderer / controls
		this.initThree();

		// 2. Init Cannon world and floor body
		this.initPhysicsWorld();

		// 3. Init visual floor mesh
		this.initFloor();

		// 4. Init basic lighting setup
		this.initLights();

		// 5. Init debug GUI for spawning / tuning physics
		this.initGui();

		// Initial demo box (same as in the original course example)
		this.createBox(1, 1.5, 2, new THREE.Vector3(0, 3, 0));

		window.addEventListener('resize', this.handleResize);

		// Start render + physics loop
		this.tick();
	}

	ngOnDestroy(): void {
		// Stop animation loop
		cancelAnimationFrame(this.animationId ?? 0);
		window.removeEventListener('resize', this.handleResize);

		// Dispose GUI and controls / renderer
		this.gui?.destroy();
		this.controls?.dispose();
		this.renderer?.dispose();

		// Remove all physics bodies and Three meshes
		for (const object of this.objectsToUpdate) {
			object.body.removeEventListener('collide', this.playHitSound);
			this.world.removeBody(object.body);
			this.scene.remove(object.mesh);
		}
		this.objectsToUpdate = [];

		// Dispose geometries / materials
		this.sphereGeometry.dispose();
		this.boxGeometry.dispose();
		this.sphereMaterial?.dispose();
		this.boxMaterial?.dispose();
	}

	// ----------------------------------------------------------------
	// Init
	// ----------------------------------------------------------------

	/**
	 * Initializes Three.js scene, environment map, camera, renderer, controls.
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element not found for Physics component');
			return;
		}

		/** Scene */
		this.scene = this.threeCoreService.createScene();

		/** Environment map (cube texture) */
		const cubeTextureLoader = new THREE.CubeTextureLoader();
		this.envMap = cubeTextureLoader.load([
			'/textures/environmentMaps/0/px.png',
			'/textures/environmentMaps/0/nx.png',
			'/textures/environmentMaps/0/py.png',
			'/textures/environmentMaps/0/ny.png',
			'/textures/environmentMaps/0/pz.png',
			'/textures/environmentMaps/0/nz.png',
		]);

		this.scene.environment = this.envMap;

		/** Shared PBR material for spheres and boxes */
		this.sphereMaterial = new THREE.MeshStandardMaterial({
			metalness: 0.3,
			roughness: 0.4,
			envMap: this.envMap,
			envMapIntensity: 0.5,
		});

		// Box material copies the same settings
		this.boxMaterial = this.sphereMaterial.clone();

		/** Camera setup */
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(-3, 3, 3);
		this.scene.add(this.camera);

		/** WebGL renderer */
		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		/** OrbitControls for camera interaction */
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	/**
	 * Initializes Cannon physics world, materials and static floor body.
	 */
	private initPhysicsWorld(): void {
		this.world = new CANNON.World();
		this.world.broadphase = new CANNON.SAPBroadphase(this.world);
		this.world.allowSleep = true;
		this.world.gravity.set(0, -9.82, 0);

		this.defaultMaterial = new CANNON.Material('default');

		this.contactMaterial = new CANNON.ContactMaterial(
			this.defaultMaterial,
			this.defaultMaterial,
			{
				friction: 0.1,
				restitution: 0.7,
			},
		);

		this.world.defaultContactMaterial = this.contactMaterial;

		// --- Finite floor instead of infinite plane ---

		// Same size as Three.js floor: PlaneGeometry(10, 10)
		// halfSize = 10 / 2 = 5
		const floorHalfSize = 5;

		// Box shape used as a floor collider (with finite extents)
		const floorShape = new CANNON.Box(new CANNON.Vec3(floorHalfSize, 0.1, floorHalfSize));

		const floorBody = new CANNON.Body({
			mass: 0, // static body
			shape: floorShape,
			material: this.defaultMaterial,
		});

		// Put top surface of the box exactly at y = 0
		// Half-height = 0.1 → center at y = -0.1
		floorBody.position.set(0, -0.1, 0);

		this.world.addBody(floorBody);
	}

	/**
	 * Creates a corresponding Three.js floor mesh for the Cannon plane.
	 */
	private initFloor(): void {
		this.floorMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(10, 10),
			new THREE.MeshStandardMaterial({
				color: '#777777',
				metalness: 0.3,
				roughness: 0.4,
				envMap: this.envMap,
				envMapIntensity: 0.5,
			}),
		);
		this.floorMesh.receiveShadow = true;
		this.floorMesh.rotation.x = -Math.PI * 0.5;
		this.scene.add(this.floorMesh);
	}

	/**
	 * Basic lighting setup (ambient + directional that casts shadows).
	 */
	private initLights(): void {
		const ambientLight = new THREE.AmbientLight(0xffffff, 2.1);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
		directionalLight.castShadow = true;
		directionalLight.shadow.mapSize.set(1024, 1024);
		directionalLight.shadow.camera.far = 15;
		directionalLight.shadow.camera.left = -7;
		directionalLight.shadow.camera.top = 7;
		directionalLight.shadow.camera.right = 7;
		directionalLight.shadow.camera.bottom = -7;
		directionalLight.position.set(5, 5, 5);
		this.scene.add(directionalLight);
	}

	/**
	 * Initializes debug GUI for physics:
	 * - spawn sphere / box
	 * - reset world
	 * - tweak gravity and contact material
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createPhysicsGui({
			world: this.world,
			contactMaterial: this.contactMaterial,
			onCreateSphere: () => {
				this.createSphere(
					Math.random() * 0.5,
					new THREE.Vector3((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3),
				);
			},
			onCreateBox: () => {
				this.createBox(
					Math.random(),
					Math.random(),
					Math.random() + 0.1, // ensure non-zero depth
					new THREE.Vector3((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3),
				);
			},
			onReset: () => {
				for (const object of this.objectsToUpdate) {
					object.body.removeEventListener('collide', this.playHitSound);
					this.world.removeBody(object.body);
					this.scene.remove(object.mesh);
				}
				this.objectsToUpdate.splice(0, this.objectsToUpdate.length);
			},
		});
	}

	// ----------------------------------------------------------------
	// Helpers
	// ----------------------------------------------------------------

	/**
	 * Plays hit sound for sufficiently strong collisions.
	 */
	private playHitSound = (collision: any) => {
		const impactStrength = collision.contact?.getImpactVelocityAlongNormal?.() ?? 0;

		if (impactStrength > 1.5) {
			this.hitSound.volume = Math.random();
			this.hitSound.currentTime = 0;
			this.hitSound.play();
		}
	};

	/**
	 * Creates a Three.js sphere mesh + Cannon body and registers it for updates.
	 */
	private createSphere(radius: number, position: THREE.Vector3): void {
		// Three.js mesh
		const mesh = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial);
		mesh.castShadow = true;
		mesh.scale.set(radius, radius, radius);
		mesh.position.copy(position);
		this.scene.add(mesh);

		// Cannon body
		const shape = new CANNON.Sphere(radius);
		const body = new CANNON.Body({
			mass: 1,
			shape,
			material: this.defaultMaterial,
			position: new CANNON.Vec3(position.x, position.y, position.z),
		});
		body.addEventListener('collide', this.playHitSound);
		this.world.addBody(body);

		this.objectsToUpdate.push({ mesh, body });
	}

	/**
	 * Creates a Three.js box mesh + Cannon body and registers it for updates.
	 */
	private createBox(width: number, height: number, depth: number, position: THREE.Vector3): void {
		// Three.js mesh
		const mesh = new THREE.Mesh(this.boxGeometry, this.boxMaterial);
		mesh.castShadow = true;
		mesh.scale.set(width, height, depth);
		mesh.position.copy(position);
		this.scene.add(mesh);

		// Cannon body (half extents for Box shape)
		const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5));

		const body = new CANNON.Body({
			mass: 1,
			shape,
			material: this.defaultMaterial,
			position: new CANNON.Vec3(position.x, position.y, position.z),
		});
		body.addEventListener('collide', this.playHitSound);
		this.world.addBody(body);

		this.objectsToUpdate.push({ mesh, body });
	}

	// ----------------------------------------------------------------
	// Loop
	// ----------------------------------------------------------------

	/**
	 * Main loop:
	 * - steps Cannon world
	 * - syncs Three meshes with physics bodies
	 * - updates OrbitControls
	 * - renders the scene
	 */
	private tick = () => {
		this.animationId = requestAnimationFrame(this.tick);

		const elapsedTime = this.clock.getElapsedTime();
		const deltaTime = elapsedTime - this.oldElapsedTime;
		this.oldElapsedTime = elapsedTime;

		// Step the physics world with fixed time step
		this.world.step(1 / 60, deltaTime, 3);

		// Sync Three.js meshes with Cannon bodies
		for (const object of this.objectsToUpdate) {
			// cannon-es Vec3/Quaternion are not typed as Three's, so cast to any
			object.mesh.position.copy(object.body.position as any);
			object.mesh.quaternion.copy(object.body.quaternion as any);
		}

		// Smooth camera controls
		this.controls.update();

		// Render current frame
		this.renderer.render(this.scene, this.camera);
	};
}

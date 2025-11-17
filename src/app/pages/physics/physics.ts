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
import * as CANNON from 'cannon-es';
import GUI from 'lil-gui';
import gsap from 'gsap';

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

	/** Shared environment map + base geometries */
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

	/** Simulation controls */
	private timeScale = 1; // 1 = normal, <1 = slow motion, >1 = fast-forward
	private windEnabled = false;
	private windVector = new CANNON.Vec3(8, 0, 0);
	private windUseNoise = false;
	private windNoiseTime = 0;

	/** Hurricane & vortex simulation parameters */
	private hurricaneEnabled = true;
	private hurricaneSpeedFactor = 1;
	private vortexEnabled = false;
	private vortexStrength = 25;
	private vortexRadius = 4; // should roughly match hurricaneConfig.radius

	/** Object pool + kill-zone (performance & cleanup) */
	private readonly maxObjects = 120;
	private readonly killBounds = {
		yMin: -20, // if body goes below this Y → remove
		radiusMax: 40, // if body goes too far horizontally → remove
	};

	// ----------------------------------------------------------------
	// HURRICANE PARTICLES
	// ----------------------------------------------------------------

	private hurricane!: THREE.Points | null;
	private hurricaneGeometry!: THREE.BufferGeometry;
	private hurricaneMaterial!: THREE.PointsMaterial;
	private hurricanePositions!: Float32Array;
	private hurricaneRadii!: Float32Array;
	private hurricaneAngles!: Float32Array;
	private hurricaneSpeeds!: Float32Array;
	private hurricaneVerticalSpeeds!: Float32Array;
	private hurricaneTime = 0;

	private readonly hurricaneConfig = {
		radius: 4,
		height: 8,
		count: 900,
		spinStrength: 1.4,
		verticalSpeedMin: 0.4,
		verticalSpeedMax: 1.2,
	};

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

		// 5. Init hurricane particle system
		this.initHurricane();

		// 6. Init debug GUI for spawning / tuning physics
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
		for (const object of [...this.objectsToUpdate]) {
			this.removeObject(object);
		}

		// Dispose hurricane resources
		if (this.hurricane) {
			this.scene.remove(this.hurricane);
			this.hurricaneGeometry.dispose();
			this.hurricaneMaterial.dispose();
			this.hurricane = null;
		}

		// Dispose base geometries / materials
		this.sphereGeometry.dispose();
		this.boxGeometry.dispose();
		this.sphereMaterial?.dispose();
		this.boxMaterial?.dispose();
	}

	// ----------------------------------------------------------------
	// Init
	// ----------------------------------------------------------------

	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element not found for Physics component');
			return;
		}

		this.scene = this.threeCoreService.createScene();

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

		this.sphereMaterial = new THREE.MeshStandardMaterial({
			metalness: 0.3,
			roughness: 0.4,
			envMap: this.envMap,
			envMapIntensity: 0.5,
			emissive: new THREE.Color(0x000000),
			emissiveIntensity: 0,
		});

		this.boxMaterial = this.sphereMaterial.clone();

		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(-4, 4, 6);
		this.scene.add(this.camera);

		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

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

		const floorHalfSize = 5;
		const floorShape = new CANNON.Box(new CANNON.Vec3(floorHalfSize, 0.1, floorHalfSize));

		const floorBody = new CANNON.Body({
			mass: 0,
			shape: floorShape,
			material: this.defaultMaterial,
		});

		floorBody.position.set(0, -0.1, 0);
		this.world.addBody(floorBody);
	}

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
		directionalLight.position.set(5, 8, 5);
		this.scene.add(directionalLight);
	}

	// ----------------------------------------------------------------
	// Hurricane particles
	// ----------------------------------------------------------------

	private initHurricane(): void {
		const { count, radius, height, verticalSpeedMin, verticalSpeedMax } = this.hurricaneConfig;

		this.hurricaneGeometry = new THREE.BufferGeometry();
		this.hurricanePositions = new Float32Array(count * 3);
		this.hurricaneRadii = new Float32Array(count);
		this.hurricaneAngles = new Float32Array(count);
		this.hurricaneSpeeds = new Float32Array(count);
		this.hurricaneVerticalSpeeds = new Float32Array(count);

		for (let i = 0; i < count; i++) {
			const r = radius * Math.sqrt(Math.random());
			const angle = Math.random() * Math.PI * 2;
			const y = (Math.random() - 0.5) * height;

			const idx = i * 3;
			this.hurricanePositions[idx + 0] = Math.cos(angle) * r;
			this.hurricanePositions[idx + 1] = y;
			this.hurricanePositions[idx + 2] = Math.sin(angle) * r;

			this.hurricaneRadii[i] = r;
			this.hurricaneAngles[i] = angle;

			this.hurricaneSpeeds[i] =
				this.hurricaneConfig.spinStrength * (0.5 + Math.random() * 0.8);

			this.hurricaneVerticalSpeeds[i] =
				verticalSpeedMin +
				Math.random() * (verticalSpeedMax - verticalSpeedMin) *
				(Math.random() > 0.3 ? 1 : -0.5);
		}

		this.hurricaneGeometry.setAttribute(
			'position',
			new THREE.BufferAttribute(this.hurricanePositions, 3),
		);

		this.hurricaneMaterial = new THREE.PointsMaterial({
			size: 0.08,
			color: new THREE.Color('#e6f3ff'),
			transparent: true,
			opacity: 0.85,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			sizeAttenuation: true,
		});

		this.hurricane = new THREE.Points(this.hurricaneGeometry, this.hurricaneMaterial);
		this.hurricane.position.set(0, this.hurricaneConfig.height * 0.25, 0);
		this.hurricane.rotation.z = THREE.MathUtils.degToRad(4);
		this.scene.add(this.hurricane);
	}

	private updateHurricane(deltaTime: number): void {
		if (!this.hurricane || !this.hurricaneEnabled) {
			return;
		}

		this.hurricaneTime += deltaTime;

		const { count, height } = this.hurricaneConfig;
		const positions = this.hurricanePositions;
		const radii = this.hurricaneRadii;
		const angles = this.hurricaneAngles;
		const speeds = this.hurricaneSpeeds;
		const vSpeeds = this.hurricaneVerticalSpeeds;

		for (let i = 0; i < count; i++) {
			const idx = i * 3;

			// Spin around Y axis with global hurricane speed factor
			angles[i] += speeds[i] * deltaTime * this.hurricaneSpeedFactor;

			const r = radii[i];
			positions[idx + 0] = Math.cos(angles[i]) * r;
			positions[idx + 2] = Math.sin(angles[i]) * r;

			positions[idx + 1] += vSpeeds[i] * deltaTime;

			if (positions[idx + 1] > height * 0.5) {
				positions[idx + 1] = -height * 0.5;
			} else if (positions[idx + 1] < -height * 0.5) {
				positions[idx + 1] = height * 0.5;
			}
		}

		this.hurricaneGeometry.attributes['position'].needsUpdate = true;

		const scalePulse = 1 + Math.sin(this.hurricaneTime * 0.8) * 0.04;
		this.hurricane!.scale.set(scalePulse, 1, scalePulse);
	}

	/**
	 * Initializes debug GUI and wires callbacks to simulation parameters.
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createPhysicsGui({
			world: this.world,
			contactMaterial: this.contactMaterial,
			onCreateSphere: () => {
				this.createSphere(
					Math.random() * 0.5 + 0.1,
					new THREE.Vector3((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3),
				);
			},
			onCreateBox: () => {
				this.createBox(
					Math.random(),
					Math.random(),
					Math.random() + 0.1,
					new THREE.Vector3((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3),
				);
			},
			onReset: () => {
				for (const object of [...this.objectsToUpdate]) {
					this.removeObject(object);
				}
			},
			onTimeScaleChange: (value: number) => {
				this.timeScale = value;
			},
			onToggleWind: (enabled: boolean) => {
				this.windEnabled = enabled;
			},
			onWindVectorChange: (vec) => {
				this.windVector.set(vec.x, vec.y, vec.z);
			},
			onWindNoiseToggle: (enabled: boolean) => {
				this.windUseNoise = enabled;
			},

			// Hurricane GUI bindings
			onToggleHurricane: (enabled: boolean) => {
				this.hurricaneEnabled = enabled;
				if (this.hurricane) {
					this.hurricane.visible = enabled;
				}
			},
			onHurricaneSpeedChange: (value: number) => {
				this.hurricaneSpeedFactor = value;
			},

			// Vortex GUI bindings
			onToggleVortex: (enabled: boolean) => {
				this.vortexEnabled = enabled;
			},
			onVortexStrengthChange: (value: number) => {
				this.vortexStrength = value;
			},
		});
	}

	// ----------------------------------------------------------------
	// Helpers
	// ----------------------------------------------------------------

	private removeObject(entry: { mesh: THREE.Mesh; body: CANNON.Body }): void {
		entry.body.removeEventListener('collide', this.playHitSound);
		this.world.removeBody(entry.body);
		this.scene.remove(entry.mesh);

		const index = this.objectsToUpdate.indexOf(entry);
		if (index !== -1) {
			this.objectsToUpdate.splice(index, 1);
		}
	}

	private enforcePoolLimit(): void {
		if (this.objectsToUpdate.length >= this.maxObjects) {
			this.removeObject(this.objectsToUpdate[0]);
		}
	}

	private playHitSound = (collision: any) => {
		const impactStrength = collision.contact?.getImpactVelocityAlongNormal?.() ?? 0;

		if (impactStrength > 1.2) {
			this.hitSound.volume = Math.random();
			this.hitSound.currentTime = 0;
			this.hitSound.play();

			const body: CANNON.Body = collision.body || collision.target;
			const entry = this.objectsToUpdate.find((o) => o.body === body);
			if (!entry) return;

			const mesh = entry.mesh;
			const material = mesh.material as THREE.MeshStandardMaterial;
			const baseScale = mesh.scale.clone();

			gsap.fromTo(
				mesh.scale,
				{ x: baseScale.x * 1.15, y: baseScale.y * 0.85, z: baseScale.z * 1.15 },
				{
					x: baseScale.x,
					y: baseScale.y,
					z: baseScale.z,
					duration: 0.18,
					ease: 'expo.out',
				},
			);

			gsap.fromTo(
				material,
				{ emissiveIntensity: 1 },
				{ emissiveIntensity: 0, duration: 0.25, ease: 'power2.out' },
			);
		}
	};

	private createSphere(radius: number, position: THREE.Vector3): void {
		this.enforcePoolLimit();

		const material = this.sphereMaterial.clone();
		material.color.setHSL(Math.random(), 0.6, 0.5);

		const mesh = new THREE.Mesh(this.sphereGeometry, material);
		mesh.castShadow = true;
		mesh.scale.set(radius, radius, radius);
		mesh.position.copy(position);
		this.scene.add(mesh);

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

	private createBox(width: number, height: number, depth: number, position: THREE.Vector3): void {
		this.enforcePoolLimit();

		const material = this.boxMaterial.clone();
		material.color.setHSL(Math.random(), 0.5, 0.45);

		const mesh = new THREE.Mesh(this.boxGeometry, material);
		mesh.castShadow = true;
		mesh.scale.set(width, height, depth);
		mesh.position.copy(position);
		this.scene.add(mesh);

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

	private tick = () => {
		this.animationId = requestAnimationFrame(this.tick);

		const elapsedTime = this.clock.getElapsedTime();
		const rawDeltaTime = elapsedTime - this.oldElapsedTime;
		this.oldElapsedTime = elapsedTime;

		const deltaTime = rawDeltaTime * this.timeScale;

		this.windNoiseTime += deltaTime;

		this.world.step(1 / 60, deltaTime, 3);

		for (const object of [...this.objectsToUpdate]) {
			object.mesh.position.copy(object.body.position as any);
			object.mesh.quaternion.copy(object.body.quaternion as any);

			const pos = object.body.position;
			const horizontalRadius = Math.hypot(pos.x, pos.z);

			if (pos.y < this.killBounds.yMin || horizontalRadius > this.killBounds.radiusMax) {
				this.removeObject(object);
				continue;
			}

			// Global wind
			if (this.windEnabled && object.body.mass > 0) {
				const force = new CANNON.Vec3().copy(this.windVector);

				if (this.windUseNoise) {
					const n =
						Math.sin(pos.x * 0.4 + this.windNoiseTime * 1.2) * 0.5 +
						Math.cos(pos.z * 0.3 + this.windNoiseTime * 0.8) * 0.5;

					force.scale(0.5 + n, force);
				}

				object.body.applyForce(force, object.body.position);
			}

			// Vortex: tangential swirl + vertical suction around center (0,0,0)
			if (this.vortexEnabled && object.body.mass > 0) {
				const distXZ = Math.hypot(pos.x, pos.z);

				if (distXZ > 0.0001 && distXZ < this.vortexRadius) {
					const radialX = pos.x / distXZ;
					const radialZ = pos.z / distXZ;

					// Tangential direction (perpendicular to radius, spinning around Y axis)
					const strengthFactor = 1 - distXZ / this.vortexRadius;
					const base = this.vortexStrength * strengthFactor;

					const force = new CANNON.Vec3(
						-radialZ * base, // tangential X
						this.vortexStrength * 0.35 * strengthFactor, // upward suction
						radialX * base, // tangential Z
					);

					object.body.applyForce(force, object.body.position);
				}
			}
		}

		// Update hurricane particles
		this.updateHurricane(deltaTime);

		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	};
}

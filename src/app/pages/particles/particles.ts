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
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

/**
 * Available particle demos from the Three.js Journey lesson:
 * - sphereBasic: SphereGeometry-based particles
 * - randomBasic: Random positions without texture
 * - randomAlphaAdditive: Random + alpha map + additive blending
 * - randomVertexColors: Random colored particles
 * - rotatePoints: Rotation animation
 * - waveAttributes: Per-vertex sine-wave animation
 */
type ParticlesMode =
	| 'sphereBasic'
	| 'randomBasic'
	| 'randomAlphaAdditive'
	| 'randomVertexColors'
	| 'rotatePoints'
	| 'waveAttributes';

@Component({
	selector: 'app-particles',
	standalone: true,
	imports: [],
	templateUrl: './particles.html',
	styleUrl: './particles.scss',
})
export class Particles implements AfterViewInit, OnDestroy {
	/** Inject reusable Three.js helpers */
	private readonly threeCore = inject(ThreeCoreService);
	private readonly debugGui = inject(DebugGuiService);

	/** Canvas reference */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js components */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Particles */
	private particlesGeometry!: THREE.BufferGeometry | THREE.SphereGeometry;
	private particlesMaterial!: THREE.PointsMaterial;
	private particles!: THREE.Points;
	private particleTexture!: THREE.Texture;

	/** Debug GUI instance */
	private gui?: GUI;

	/**
	 * User-modifiable parameters (controlled through lil-gui)
	 */
	private parameters: {
		color: string;
		size: number;
		count: number;
		mode: ParticlesMode;
	} = {
			color: '#ff88cc',
			size: 0.1,
			count: 5000,
			mode: 'randomAlphaAdditive',
		};

	/** Render loop helpers */
	private clock = new THREE.Clock();
	private animationId?: number;

	// ------------------------------
	// Lifecycle
	// ------------------------------

	ngAfterViewInit(): void {
		this.initThree();
		this.loadTextures();
		this.initMaterial();
		this.initParticles();
		this.initGui();
		this.loop();

		window.addEventListener('resize', this.handleResize);
	}

	ngOnDestroy(): void {
		cancelAnimationFrame(this.animationId ?? 0);
		window.removeEventListener('resize', this.handleResize);

		this.controls?.dispose();
		this.renderer?.dispose();
		this.gui?.destroy();

		this.disposeParticles();
		this.particlesMaterial?.dispose();
	}

	// ------------------------------
	// Scene / Renderer Setup
	// ------------------------------

	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) return;

		this.scene = this.threeCore.createScene();

		const width = window.innerWidth;
		const height = window.innerHeight;

		/** Perspective camera */
		this.camera = this.threeCore.createPerspectiveCamera(75, { width, height });
		this.camera.position.set(0, 0, 3);
		this.scene.add(this.camera);

		/** WebGL renderer */
		this.renderer = this.threeCore.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		/** OrbitControls for navigation */
		this.controls = this.threeCore.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	/**
	 * Loads reusable particle textures.
	 */
	private loadTextures(): void {
		const textureLoader = new THREE.TextureLoader();

		// Adjust the path depending on Angular build setup.
		this.particleTexture = textureLoader.load('/textures/particles/2.png');
	}

	/**
	 * Initializes a single PointsMaterial instance.
	 * Only properties change between modes — the instance stays the same.
	 */
	private initMaterial(): void {
		this.particlesMaterial = new THREE.PointsMaterial({
			size: this.parameters.size,
			sizeAttenuation: true,
			color: new THREE.Color(this.parameters.color),
		});
	}

	// ------------------------------
	// Particles Setup
	// ------------------------------

	/**
	 * Creates and configures particles according to the selected demo mode.
	 */
	private initParticles(): void {
		this.disposeParticles();

		const mode = this.parameters.mode;
		const count = this.parameters.count;

		let geometry: THREE.BufferGeometry | THREE.SphereGeometry;

		// ------------------------------
		// Geometry selection
		// ------------------------------

		if (mode === 'sphereBasic') {
			/**
			 * Convert "count" parameter into sphere segment count.
			 * Allows GUI "count" to affect SphereGeometry density.
			 */
			const minSeg = 4;
			const maxSeg = 128;

			let segments = Math.round(Math.sqrt(count));
			segments = Math.max(minSeg, Math.min(maxSeg, segments));

			geometry = new THREE.SphereGeometry(1, segments, segments);
		} else {
			/** BufferGeometry for random particles */
			geometry = new THREE.BufferGeometry();
			const positions = new Float32Array(count * 3);
			const colors = new Float32Array(count * 3);

			for (let i = 0; i < count * 3; i++) {
				positions[i] = (Math.random() - 0.5) * 10;
				colors[i] = Math.random();
			}

			geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

			/** Modes that require per-vertex colors */
			if (mode === 'randomVertexColors' || mode === 'rotatePoints' || mode === 'waveAttributes') {
				geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
			}
		}

		this.particlesGeometry = geometry;

		// ------------------------------
		// Material configuration per mode
		// ------------------------------

		const m = this.particlesMaterial;
		m.size = this.parameters.size;
		m.color.set(this.parameters.color);

		// Reset defaults
		m.map = null;
		m.alphaMap = null;
		m.transparent = false;
		m.depthWrite = true;
		m.depthTest = true;
		m.blending = THREE.NormalBlending;
		m.vertexColors = false;

		if (mode !== 'sphereBasic' && mode !== 'randomBasic') {
			/** Modes using alpha map + additive blending */
			m.transparent = true;
			m.alphaMap = this.particleTexture;
			m.depthWrite = false;
			m.blending = THREE.AdditiveBlending;
		}

		if (mode === 'randomVertexColors' || mode === 'rotatePoints' || mode === 'waveAttributes') {
			m.vertexColors = true;
		}

		m.needsUpdate = true;

		// ------------------------------
		// Spawn Points object
		// ------------------------------

		this.particles = new THREE.Points(this.particlesGeometry, this.particlesMaterial);
		this.scene.add(this.particles);
	}

	/**
	 * Initializes lil-gui for particle controls.
	 * Allows changing mode, count, size, color in real time.
	 */
	private initGui(): void {
		this.gui = this.debugGui.createParticlesGui(
			this.particlesMaterial,
			this.parameters,
			() => this.rebuildParticles(),
		);
	}

	/**
	 * Called when GUI triggers a "rebuild" action.
	 */
	private rebuildParticles(): void {
		this.initParticles();
	}

	/**
	 * Cleans up previous particles from scene and memory.
	 */
	private disposeParticles(): void {
		if (this.particles) {
			this.scene.remove(this.particles);
		}
		if (this.particlesGeometry) {
			this.particlesGeometry.dispose();
		}
	}

	// ------------------------------
	// Animation Loop
	// ------------------------------

	private loop = () => {
		this.animationId = requestAnimationFrame(this.loop);

		const elapsedTime = this.clock.getElapsedTime();
		const mode = this.parameters.mode;

		// Mode: global rotation
		if (mode === 'rotatePoints' && this.particles) {
			this.particles.rotation.y = elapsedTime * 0.2;
		}

		// Mode: per-vertex sine-wave animation
		else if (mode === 'waveAttributes') {
			const count = this.parameters.count;
			const positionAttr =
				this.particlesGeometry.attributes['position'] as THREE.BufferAttribute;

			for (let i = 0; i < count; i++) {
				const i3 = i * 3;
				const x = positionAttr.array[i3];
				positionAttr.array[i3 + 1] = Math.sin(elapsedTime + x);
			}
			positionAttr.needsUpdate = true;
		}

		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	};

	// ------------------------------
	// Resize handler
	// ------------------------------

	private handleResize = () => {
		this.threeCore.updateOnResize(this.camera, this.renderer);
	};
}

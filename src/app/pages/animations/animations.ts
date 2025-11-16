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

@Component({
	selector: 'app-animations',
	standalone: true,
	imports: [],
	templateUrl: './animations.html',
	styleUrl: './animations.scss',
})
export class Animations implements AfterViewInit, OnDestroy {
	readonly threeCoreService = inject(ThreeCoreService);
	readonly debugGuiService = inject(DebugGuiService);

	/** Canvas reference retrieved using the Angular signals-based viewChild() */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js elements */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Objects rendered within the scene */
	private group!: THREE.Group;
	private cube!: THREE.Mesh;
	private axesHelper!: THREE.AxesHelper;

	/** Debug UI (lil-gui) */
	private gui!: GUI;

	/** Clock used to compute frame-rate–independent animation values */
	private clock = new THREE.Clock();

	/** ID returned by requestAnimationFrame, used for proper cleanup */
	private animationFrameId?: number;

	/**
	 * Runtime animation parameters.
	 * Values are modified through the Debug GUI in real time.
	 */
	private animationConfig = {
		spinSpeed: 1,          // Cube rotation speed (radians per second)
		circularMotion: false, // Enables orbit-like X/Y movement
		orbitRadius: 1.25,     // Radius of circular motion
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
	 * Initializes all core Three.js systems:
	 * - Scene
	 * - Axes helper
	 * - Cube inside a group (to reuse transform controls)
	 * - Perspective camera
	 * - WebGL renderer
	 * - OrbitControls
	 *
	 * Structure mirrors the animation lesson:
	 * a single red cube placed in the center of a full-screen canvas.
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found in the template.');
			return;
		}

		/** Scene */
		this.scene = this.threeCoreService.createScene();

		/** Axes helper (X=red, Y=green, Z=blue) */
		this.axesHelper = new THREE.AxesHelper(2);
		this.scene.add(this.axesHelper);

		/** Group container to enable grouped transforms from the Debug GUI */
		this.group = new THREE.Group();
		this.scene.add(this.group);

		/** Cube mesh (1×1×1) with a red basic material */
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
		this.cube = new THREE.Mesh(geometry, material);
		this.group.add(this.cube);

		/** Camera setup */
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCoreService.createPerspectiveCamera(75, { width, height });
		this.camera.position.z = 3;
		this.scene.add(this.camera);

		/** WebGL renderer */
		this.renderer = this.threeCoreService.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		/** Mouse controls for rotation/zoom/pan */
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
	}

	/**
	 * Initializes the Debug GUI:
	 * - Adds transform controls (position / rotation / scale) for the cube group
	 * - Adds animation controls (spin speed, circular motion, GSAP tweens)
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createTransformGui(
			this.group,
			this.axesHelper,
			this.camera,
		);

		// Animation-specific controls (spin speed, orbit radius, GSAP actions)
		this.debugGuiService.createAnimationGui(
			this.gui,
			this.cube,
			this.animationConfig,
		);
	}

	/**
	 * Main animation loop.
	 *
	 * Executed every frame using requestAnimationFrame.
	 * Uses Three.js Clock to ensure consistent animation speed
	 * regardless of display refresh rate.
	 *
	 * Responsibilities:
	 * - Update cube rotation by time
	 * - Optionally apply orbit-style circular motion
	 * - Update OrbitControls
	 * - Render the scene
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();

			/** Rotation (frame-rate independent) */
			this.cube.rotation.y = elapsedTime * this.animationConfig.spinSpeed;

			/** Optional circular X/Y motion */
			if (this.animationConfig.circularMotion) {
				this.cube.position.x = Math.cos(elapsedTime) * this.animationConfig.orbitRadius;
				this.cube.position.y = Math.sin(elapsedTime) * this.animationConfig.orbitRadius;
			}

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Handles browser window resizes by updating
	 * camera aspect ratio and renderer dimensions.
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

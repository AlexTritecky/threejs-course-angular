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
	selector: 'app-cameras',
	standalone: true,
	imports: [],
	templateUrl: './cameras.html',
	styleUrl: './cameras.scss',
})
export class Cameras implements AfterViewInit, OnDestroy {
	readonly threeCoreService = inject(ThreeCoreService);
	readonly debugGuiService = inject(DebugGuiService);

	/** Reference to the canvas in the template */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Demo object */
	private cube!: THREE.Mesh;

	/** Debug GUI instance for camera controls */
	private gui!: GUI;

	/** Animation loop id */
	private animationFrameId?: number;

	/** Clock for potential time-based camera experiments */
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
	 * - scene
	 * - a subdivided cube
	 * - perspective camera
	 * - WebGL renderer
	 * - OrbitControls
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		// Scene
		this.scene = this.threeCoreService.createScene();

		// Cube (1x1x1) with extra segments (5,5,5) like in the original lesson
		const geometry = new THREE.BoxGeometry(1, 1, 1, 5, 5, 5);
		const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
		this.cube = new THREE.Mesh(geometry, material);
		this.scene.add(this.cube);

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

		// OrbitControls (instead of manual mouse-based camera math)
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
	}

	/**
	 * Initializes a dedicated GUI folder for camera controls:
	 * - FOV
	 * - position (x, y, z)
	 * - lookAt(0, 0, 0)
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createCameraGui(this.camera, this.controls);
	}

	/**
	 * Main render loop.
	 * Currently:
	 *  - updates OrbitControls (damping)
	 *  - renders the scene from the active camera
	 *
	 * You can later add camera experiments here:
	 *  - orbit camera manually using cursor
	 *  - switch between perspective/orthographic, etc.
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			// For future camera experiments (elapsed time, etc.)
			const _elapsedTime = this.clock.getElapsedTime();

			// Smooth controls
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

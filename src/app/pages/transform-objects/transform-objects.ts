import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-transform-objects',
	standalone: true,
	imports: [],
	templateUrl: './transform-objects.html',
	styleUrl: './transform-objects.scss',
})
export class TransformObjects implements AfterViewInit, OnDestroy {
	readonly threeCoreService = inject(ThreeCoreService);
	readonly debugGuiService = inject(DebugGuiService);
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js elements */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Objects used inside the scene */
	private group!: THREE.Group;
	private axesHelper!: THREE.AxesHelper;
	private gui!: GUI;

	/** ID of the current animation frame */
	private animationFrameId?: number;

	ngAfterViewInit(): void {
		this.initThree();
		this.initGui();
		this.startLoop();
		window.addEventListener('resize', this.handleResize);
	}

	ngOnDestroy(): void {
		cancelAnimationFrame(this.animationFrameId ?? 0);
		window.removeEventListener('resize', this.handleResize);

		// Dispose Three.js resources to avoid memory leaks
		this.controls?.dispose();
		this.renderer?.dispose();
		this.gui?.destroy();
	}

	/**
	 * Initializes the scene, camera, renderer, objects, and controls.
	 * This is the main setup for the Three.js environment.
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas not found');
			return;
		}

		/** Create the main scene */
		this.scene = new THREE.Scene();

		/** Add visible XYZ helper axes (red=X, green=Y, blue=Z) */
		this.axesHelper = new THREE.AxesHelper(2);
		this.scene.add(this.axesHelper);

		/** Create a group that will contain three cubes */
		this.group = new THREE.Group();
		this.group.scale.y = 2;
		this.group.rotation.y = 0.2;
		this.scene.add(this.group);

		/** Factory function for creating cubes at different X positions */
		const createCube = (x: number): THREE.Mesh => {
			const mesh = new THREE.Mesh(
				new THREE.BoxGeometry(1, 1, 1),
				new THREE.MeshBasicMaterial({ color: 0xff0000 }),
			);
			mesh.position.x = x;
			return mesh;
		};

		/** Add 3 cubes to the group */
		this.group.add(createCube(-1.5));
		this.group.add(createCube(0));
		this.group.add(createCube(1.5));

		/** Create a perspective camera */
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = new THREE.PerspectiveCamera(75, width / height);
		this.camera.position.z = 3;
		this.scene.add(this.camera);

		/** Create and configure the WebGL renderer */
		this.renderer = new THREE.WebGLRenderer({ canvas });
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		/** Add orbit controls (mouse rotation, zoom, pan) via service */
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
	}

	/**
	 * Initializes the debug GUI (lil-gui) for controlling
	 * the position, scale, and rotation of the group.
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createTransformGui(
			this.group,
			this.axesHelper,
			this.camera,
		);
	}

	/**
	 * Main animation loop.
	 * Runs every frame using requestAnimationFrame.
	 */
	private startLoop(): void {
		const loop = () => {
			this.animationFrameId = requestAnimationFrame(loop);

			/** Update controls (for damping) */
			this.controls.update();

			/** Render the scene from the camera's perspective */
			this.renderer.render(this.scene, this.camera);
		};

		loop();
	}

	/**
	 * Automatically adjusts camera and renderer when the window is resized.
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

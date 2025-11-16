import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-debug-ui',
	standalone: true,
	imports: [],
	templateUrl: './debug-ui.html',
	styleUrl: './debug-ui.scss',
})
export class DebugUi implements AfterViewInit, OnDestroy {
	/** Shared helpers for scene / camera / renderer / controls / resize */
	private readonly threeCore = inject(ThreeCoreService);
	private readonly debugGui = inject(DebugGuiService);

	/** Canvas reference from template (<canvas #canvas class="webgl"></canvas>) */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js primitives */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Cube and material used in the debug UI */
	private cube!: THREE.Mesh;
	private cubeMaterial!: THREE.MeshBasicMaterial;

	/** lil-gui instance */
	private gui!: GUI;

	/** Animation loop id */
	private animationFrameId?: number;

	/** Clock (in case we want time-based effects later) */
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
	 * Initializes:
	 * - scene
	 * - debug cube with BoxGeometry (1,1,1,2,2,2)
	 * - perspective camera at (1, 1, 2)
	 * - WebGL renderer bound to the canvas
	 * - OrbitControls with damping enabled
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas not found');
			return;
		}

		/** Scene */
		this.scene = this.threeCore.createScene();

		/** Cube geometry and material (wireframe to better see subdivisions) */
		const geometry = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
		this.cubeMaterial = new THREE.MeshBasicMaterial({
			color: '#a778d8',
			wireframe: true,
		});
		this.cube = new THREE.Mesh(geometry, this.cubeMaterial);
		this.scene.add(this.cube);

		/** Camera */
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCore.createPerspectiveCamera(75, { width, height });
		this.camera.position.set(1, 1, 2);
		this.scene.add(this.camera);

		/** Renderer */
		this.renderer = this.threeCore.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		/** Orbit controls */
		this.controls = this.threeCore.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	/**
	 * Creates the debug UI panel for the cube:
	 * - elevation (y)
	 * - visible
	 * - wireframe
	 * - color
	 * - spin (GSAP)
	 * - subdivision
	 * plus global GUI configuration (width/title/closeFolders and 'h' toggle).
	 */
	private initGui(): void {
		this.gui = this.debugGui.createDebugCubeGui(this.cube, this.cubeMaterial);
	}

	/**
	 * Main animation loop:
	 * - updates controls (for damping)
	 * - renders scene from the current camera
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const _elapsedTime = this.clock.getElapsedTime();
			// currently unused, but handy if you later want time-based debug effects

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Keeps camera aspect and renderer size in sync with the window.
	 */
	private handleResize = () => {
		this.threeCore.updateOnResize(this.camera, this.renderer);
	};
}

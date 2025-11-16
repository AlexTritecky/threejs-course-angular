import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-geometries',
	standalone: true,
	imports: [],
	templateUrl: './geometries.html',
	styleUrl: './geometries.scss',
})
export class Geometries implements AfterViewInit, OnDestroy {
	/** Shared Three.js helpers */
	private readonly threeCore = inject(ThreeCoreService);
	private readonly debugGui = inject(DebugGuiService);

	/** Canvas reference */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js objects */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Custom random geometry mesh */
	private mesh!: THREE.Mesh;

	/** Debug GUI instance */
	private gui!: GUI;

	/** Frame loop id */
	private animationFrameId?: number;

	/** Clock */
	private clock = new THREE.Clock();

	/** Initial triangle count for random geometry */
	private initialTriangleCount = 50;

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
	 * Three.js setup: random BufferGeometry, camera, renderer, controls.
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas not found');
			return;
		}

		// -------- Scene --------
		this.scene = this.threeCore.createScene();

		// -------- Random BufferGeometry (triangles) --------
		const geometry = this.createRandomGeometry(this.initialTriangleCount);

		const material = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			wireframe: true,
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.scene.add(this.mesh);

		// -------- Camera --------
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCore.createPerspectiveCamera(75, { width, height });
		this.camera.position.z = 3;
		this.scene.add(this.camera);

		// -------- Renderer --------
		this.renderer = this.threeCore.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// -------- Controls --------
		this.controls = this.threeCore.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	/**
	 * Creates GUI controls for this geometry:
	 * - color
	 * - wireframe
	 * - triangleCount + Regenerate
	 */
	private initGui(): void {
		this.gui = this.debugGui.createGeometryGui(
			this.mesh,
			this.initialTriangleCount,
			(triangleCount: number) => this.regenerateGeometry(triangleCount),
		);
	}

	/**
	 * Helper: build random BufferGeometry with given triangle count.
	 */
	private createRandomGeometry(triangleCount: number): THREE.BufferGeometry {
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(triangleCount * 3 * 3);

		for (let i = 0; i < positions.length; i++) {
			positions[i] = (Math.random() - 0.5) * 4;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		return geometry;
	}

	/**
	 * Regenerates geometry when user clicks "Regenerate geometry" in GUI.
	 */
	private regenerateGeometry(triangleCount: number): void {
		// Dispose old geometry to avoid memory leaks
		this.mesh.geometry.dispose();

		// Create new random geometry and assign it to the mesh
		this.mesh.geometry = this.createRandomGeometry(triangleCount);
	}

	/**
	 * Main animation loop.
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const _elapsedTime = this.clock.getElapsedTime();

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Resize handler — camera + renderer.
	 */
	private handleResize = () => {
		this.threeCore.updateOnResize(this.camera, this.renderer);
	};
}

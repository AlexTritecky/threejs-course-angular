import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

type GalaxyParameters = {
	count: number;
	size: number;
	radius: number;
	branches: number;
	spin: number;
	randomness: number;
	randomnessPower: number;
	insideColor: string;
	outsideColor: string;
};

@Component({
	selector: 'app-galaxy',
	standalone: true,
	imports: [],
	templateUrl: './galaxy.html',
	styleUrl: './galaxy.scss',
})
export class Galaxy implements AfterViewInit, OnDestroy {
	private readonly threeCore = inject(ThreeCoreService);
	private readonly debugGui = inject(DebugGuiService);

	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Galaxy data */
	private geometry: THREE.BufferGeometry | null = null;
	private material: THREE.PointsMaterial | null = null;
	private points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;

	/** Debug GUI */
	private gui?: GUI;

	/** Bruno-style parameters */
	private parameters: GalaxyParameters = {
		count: 100000,
		size: 0.01,
		radius: 5,
		branches: 3,
		spin: 1,
		randomness: 0.2,
		randomnessPower: 3,
		insideColor: '#ff6030',
		outsideColor: '#1b3984',
	};

	/** Loop */
	private clock = new THREE.Clock();
	private animationId?: number;

	// ---------------- LIFECYCLE ----------------

	ngAfterViewInit(): void {
		this.initThree();
		this.generateGalaxy();
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

		this.disposeGalaxy();
	}

	// ---------------- INIT CORE ----------------

	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) return;

		this.scene = this.threeCore.createScene();

		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCore.createPerspectiveCamera(75, { width, height });
		this.camera.position.set(3, 3, 3);
		this.scene.add(this.camera);

		this.renderer = this.threeCore.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor(0x000000);

		this.controls = this.threeCore.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	// ---------------- GALAXY ----------------

	private generateGalaxy(): void {
		// Destroy old galaxy if exists
		this.disposeGalaxy();

		const {
			count,
			radius,
			branches,
			spin,
			randomness,
			randomnessPower,
			insideColor,
			outsideColor,
			size,
		} = this.parameters;

		/**
		 * Geometry
		 */
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);

		const colorInside = new THREE.Color(insideColor);
		const colorOutside = new THREE.Color(outsideColor);

		for (let i = 0; i < count; i++) {
			const i3 = i * 3;

			// radial distance from center
			const r = Math.random() * radius;

			// spin + branch angle
			const spinAngle = r * spin;
			const branchAngle = ((i % branches) / branches) * Math.PI * 2;

			// randomness offsets
			const randomX =
				Math.pow(Math.random(), randomnessPower) *
				(Math.random() < 0.5 ? 1 : -1) *
				randomness *
				r;
			const randomY =
				Math.pow(Math.random(), randomnessPower) *
				(Math.random() < 0.5 ? 1 : -1) *
				randomness *
				r;
			const randomZ =
				Math.pow(Math.random(), randomnessPower) *
				(Math.random() < 0.5 ? 1 : -1) *
				randomness *
				r;

			// final position
			positions[i3] = Math.cos(branchAngle + spinAngle) * r + randomX;
			positions[i3 + 1] = randomY;
			positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;

			// color interpolation from center to edge
			const mixedColor = colorInside.clone();
			mixedColor.lerp(colorOutside, r / radius);

			colors[i3] = mixedColor.r;
			colors[i3 + 1] = mixedColor.g;
			colors[i3 + 2] = mixedColor.b;
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		/**
		 * Material
		 */
		const material = new THREE.PointsMaterial({
			size,
			sizeAttenuation: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexColors: true,
		});

		/**
		 * Points
		 */
		const points = new THREE.Points(geometry, material);
		this.scene.add(points);

		this.geometry = geometry;
		this.material = material;
		this.points = points;
	}

	private disposeGalaxy(): void {
		if (this.points) {
			this.scene.remove(this.points);
		}
		this.geometry?.dispose();
		this.material?.dispose();

		this.geometry = null;
		this.material = null;
		this.points = null;
	}

	// ---------------- GUI ----------------

	private initGui(): void {
		this.gui = this.debugGui.createGalaxyGui(this.parameters, () => {
			this.generateGalaxy();
		});
	}

	// ---------------- LOOP ----------------

	private loop = () => {
		this.animationId = requestAnimationFrame(this.loop);

		const elapsedTime = this.clock.getElapsedTime();

		if (this.points) {
			this.points.rotation.y = elapsedTime * 0.03;
		}

		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	};

	// ---------------- RESIZE ----------------

	private handleResize = () => {
		this.threeCore.updateOnResize(this.camera, this.renderer);
	};
}

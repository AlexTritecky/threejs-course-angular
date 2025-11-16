import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';
import GUI from 'lil-gui';

@Component({
	selector: 'app-lights',
	standalone: true,
	imports: [],
	templateUrl: './lights.html',
	styleUrl: './lights.scss',
})
export class Lights implements AfterViewInit, OnDestroy {
	private readonly threeCore = inject(ThreeCoreService);
	private readonly debugGui = inject(DebugGuiService);

	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	private mat!: THREE.MeshStandardMaterial;
	private sphere!: THREE.Mesh;
	private cube!: THREE.Mesh;
	private torus!: THREE.Mesh;
	private plane!: THREE.Mesh;

	// lights
	private ambientLight!: THREE.AmbientLight;
	private directionalLight!: THREE.DirectionalLight;
	private hemisphereLight!: THREE.HemisphereLight;
	private pointLight!: THREE.PointLight;
	private rectAreaLight!: THREE.RectAreaLight;
	private spotLight!: THREE.SpotLight;

	// helpers
	private helpers!: {
		hemisphere: THREE.HemisphereLightHelper;
		directional: THREE.DirectionalLightHelper;
		point: THREE.PointLightHelper;
		spot: THREE.SpotLightHelper;
		rectArea: RectAreaLightHelper;
	};

	// gui
	private gui?: GUI;

	private animationId?: number;
	private clock = new THREE.Clock();

	ngAfterViewInit(): void {
		this.initThree();
		this.initLights();
		this.initObjects();
		this.initGui();
		this.loop();

		window.addEventListener('resize', this.handleResize);
	}

	ngOnDestroy(): void {
		cancelAnimationFrame(this.animationId ?? 0);
		window.removeEventListener('resize', this.handleResize);

		this.controls?.dispose();
		this.renderer?.dispose();
		this.gui?.destroy(); // ⬅️ достатньо

		// опційно: dispose геометрій/матеріалів, якщо захочеш
	}

	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) return;

		this.scene = this.threeCore.createScene();

		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCore.createPerspectiveCamera(75, { width, height });
		this.camera.position.set(1, 1, 2);
		this.scene.add(this.camera);

		this.renderer = this.threeCore.createRenderer(canvas, { width, height });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		this.controls = this.threeCore.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	private initLights(): void {
		this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
		this.scene.add(this.ambientLight);

		this.directionalLight = new THREE.DirectionalLight(0x00fffc, 0.9);
		this.directionalLight.position.set(1, 0.25, 0);
		this.scene.add(this.directionalLight);

		this.hemisphereLight = new THREE.HemisphereLight(0xff0000, 0x0000ff, 0.9);
		this.scene.add(this.hemisphereLight);

		this.pointLight = new THREE.PointLight(0xff9000, 1.5, 0, 2);
		this.pointLight.position.set(1, -0.5, 1);
		this.scene.add(this.pointLight);

		this.rectAreaLight = new THREE.RectAreaLight(0x4e00ff, 6, 1, 1);
		this.rectAreaLight.position.set(-1.5, 0, 1.5);
		this.rectAreaLight.lookAt(0, 0, 0);
		this.scene.add(this.rectAreaLight);

		this.spotLight = new THREE.SpotLight(0x78ff00, 4.5, 10, Math.PI * 0.1, 0.25, 1);
		this.spotLight.position.set(0, 2, 3);
		this.spotLight.target.position.set(-0.75, 0, 0);
		this.scene.add(this.spotLight);
		this.scene.add(this.spotLight.target);

		// helpers
		this.helpers = {
			hemisphere: new THREE.HemisphereLightHelper(this.hemisphereLight, 0.2),
			directional: new THREE.DirectionalLightHelper(this.directionalLight, 0.2),
			point: new THREE.PointLightHelper(this.pointLight, 0.2),
			spot: new THREE.SpotLightHelper(this.spotLight),
			rectArea: new RectAreaLightHelper(this.rectAreaLight),
		};

		Object.values(this.helpers).forEach((h) => this.scene.add(h));
	}

	private initObjects(): void {
		this.mat = new THREE.MeshStandardMaterial();
		this.mat.roughness = 0.4;

		this.sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), this.mat);
		this.sphere.position.x = -1.5;

		this.cube = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), this.mat);

		this.torus = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.2, 32, 64), this.mat);
		this.torus.position.x = 1.5;

		this.plane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), this.mat);
		this.plane.rotation.x = -Math.PI * 0.5;
		this.plane.position.y = -0.65;

		this.scene.add(this.sphere, this.cube, this.torus, this.plane);
	}

	private initGui(): void {
		this.gui = this.debugGui.createLightsGui({
			ambientLight: this.ambientLight,
			directionalLight: this.directionalLight,
			hemisphereLight: this.hemisphereLight,
			pointLight: this.pointLight,
			rectAreaLight: this.rectAreaLight,
			spotLight: this.spotLight,
			helpers: this.helpers,
		});
	}

	private loop = () => {
		this.animationId = requestAnimationFrame(this.loop);

		const t = this.clock.getElapsedTime();

		this.sphere.rotation.y = 0.1 * t;
		this.cube.rotation.y = 0.1 * t;
		this.torus.rotation.y = 0.1 * t;

		this.sphere.rotation.x = 0.15 * t;
		this.cube.rotation.x = 0.15 * t;
		this.torus.rotation.x = 0.15 * t;

		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	};

	private handleResize = () => {
		this.threeCore.updateOnResize(this.camera, this.renderer);
	};
}

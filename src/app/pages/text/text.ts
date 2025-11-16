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
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import GUI from 'lil-gui';
import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-text',
	standalone: true,
	imports: [],
	templateUrl: './text.html',
	styleUrl: './text.scss',
})
export class Text implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** Canvas reference from the template: <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Group that contains text mesh + all donut meshes */
	private textGroup?: THREE.Group;

	/** Material shared between the text and donut meshes */
	private textMaterial!: THREE.MeshMatcapMaterial;

	/** Loaded font (cached so we don't re-load it on every rebuild) */
	private font?: Font;

	/** lil-gui instance for text controls */
	private gui?: GUI;

	/** Animation frame id for cancelling requestAnimationFrame on destroy */
	private animationFrameId?: number;

	/** Clock used for time-based animations */
	private clock = new THREE.Clock();

	/**
	 * Runtime configuration for text and animation.
	 * All properties are exposed to the GUI and can trigger a rebuild.
	 */
	private textConfig = {
		content: 'Hello Three.js',
		size: 0.5,
		depth: 0.2,
		curveSegments: 12,
		bevelEnabled: true,
		bevelThickness: 0.03,
		bevelSize: 0.02,
		bevelSegments: 5,
		donutsCount: 100,
		autoRotate: true,
		rotationSpeed: 0.15,
	};

	ngAfterViewInit(): void {
		this.initThree();
		this.loadFontAndBuild();
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
	 * Initializes the basic Three.js setup:
	 * - scene
	 * - camera
	 * - renderer
	 * - orbit controls
	 * - matcap texture + material for text and donuts
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		this.scene = this.threeCoreService.createScene();

		// Camera
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(1, 1, 2);
		this.scene.add(this.camera);

		// Renderer
		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Orbit controls
		this.controls = this.threeCoreService.createOrbitControls(
			this.camera,
			canvas,
		);
		this.controls.enableDamping = true;

		// Matcap texture + material
		const textureLoader = new THREE.TextureLoader();
		const matcapTexture = textureLoader.load('/textures/matcaps/8.png');
		matcapTexture.colorSpace = THREE.SRGBColorSpace;

		this.textMaterial = new THREE.MeshMatcapMaterial({ matcap: matcapTexture });
	}

	/**
	 * Loads the font once, caches it, and triggers the initial text + donuts build.
	 */
	private loadFontAndBuild(): void {
		const fontLoader = new FontLoader();

		fontLoader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
			this.font = font;
			this.rebuildTextAndDonuts();
		});
	}

	/**
	 * Fully rebuilds:
	 * - the textGroup
	 * - main text mesh (TextGeometry)
	 * - surrounding donuts
	 *
	 * Called initially and every time the GUI triggers a rebuild.
	 */
	private rebuildTextAndDonuts(): void {
		if (!this.font) {
			// Font is not loaded yet — simply skip for now
			return;
		}

		// Remove previous group from the scene, if any
		if (this.textGroup) {
			this.scene.remove(this.textGroup);

			// Clean up geometries to avoid memory leaks
			this.textGroup.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.geometry.dispose();
				}
			});
		}

		this.textGroup = new THREE.Group();
		this.scene.add(this.textGroup);

		// TEXT
		const textGeometry = new TextGeometry(this.textConfig.content, {
			font: this.font,
			size: this.textConfig.size,
			depth: this.textConfig.depth,
			curveSegments: this.textConfig.curveSegments,
			bevelEnabled: this.textConfig.bevelEnabled,
			bevelThickness: this.textConfig.bevelThickness,
			bevelSize: this.textConfig.bevelSize,
			bevelOffset: 0,
			bevelSegments: this.textConfig.bevelSegments,
		});

		// Center the geometry so the text is anchored around (0, 0, 0)
		textGeometry.center();

		const textMesh = new THREE.Mesh(textGeometry, this.textMaterial);
		this.textGroup.add(textMesh);

		// DONUTS
		const donutGeometry = new THREE.TorusGeometry(0.3, 0.2, 32, 64);

		for (let i = 0; i < this.textConfig.donutsCount; i++) {
			const donut = new THREE.Mesh(donutGeometry, this.textMaterial);

			donut.position.x = (Math.random() - 0.5) * 10;
			donut.position.y = (Math.random() - 0.5) * 10;
			donut.position.z = (Math.random() - 0.5) * 10;

			donut.rotation.x = Math.random() * Math.PI;
			donut.rotation.y = Math.random() * Math.PI;

			const scale = Math.random();
			donut.scale.set(scale, scale, scale);

			this.textGroup.add(donut);
		}
	}

	/**
	 * Initializes the GUI via DebugGuiService:
	 * - text content / size / bevel
	 * - donuts count
	 * - auto-rotation and speed
	 * Every change can optionally trigger "rebuildTextAndDonuts".
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createTextGui(
			this.textConfig,
			() => this.rebuildTextAndDonuts(),
		);
	}

	/**
	 * Main animation loop:
	 * - rotates the whole textGroup when autoRotate is enabled
	 * - updates controls
	 * - renders the scene
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();

			if (this.textGroup && this.textConfig.autoRotate) {
				this.textGroup.rotation.y = elapsedTime * this.textConfig.rotationSpeed;
			}

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Handles window resize:
	 * - updates camera aspect
	 * - updates renderer size and pixel ratio
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-textures',
	standalone: true,
	imports: [],
	templateUrl: './textures.html',
	styleUrl: './textures.scss',
})
export class Textures implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** Template canvas reference: <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private controls!: OrbitControls;

	/** Textured cube used to preview different maps and sampling options */
	private mesh!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

	/** Available textures for runtime switching via the debug GUI */
	private textures!: {
		minecraft: THREE.Texture;
		checker1024: THREE.Texture;
		checker2: THREE.Texture;

		doorColor: THREE.Texture;
		doorAlpha: THREE.Texture;
		doorHeight: THREE.Texture;
		doorNormal: THREE.Texture;
		doorAo: THREE.Texture;
		doorMetalness: THREE.Texture;
		doorRoughness: THREE.Texture;
	};

	/** Debug GUI instance (textures controls are attached here) */
	private gui!: GUI;

	/** requestAnimationFrame id, used for proper cleanup */
	private animationFrameId?: number;

	/** Clock used for time-based animation (e.g. auto-rotation) */
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
	 * Initializes the full Three.js stack:
	 * - Scene
	 * - LoadingManager with console logging
	 * - Multiple textures (Minecraft, checkerboards, and the full door PBR set)
	 * - Textured cube mesh
	 * - Perspective camera, WebGL renderer, and OrbitControls
	 */
	private initThree(): void {
		const canvas = this.canvas()?.nativeElement;
		if (!canvas) {
			console.error('Canvas element was not found.');
			return;
		}

		/** Scene */
		this.scene = this.threeCoreService.createScene();

		/** Loading manager with basic console feedback for texture loading lifecycle */
		const loadingManager = new THREE.LoadingManager();
		loadingManager.onStart = () => {
			console.log('loadingManager: loading started');
		};
		loadingManager.onLoad = () => {
			console.log('loadingManager: loading finished');
		};
		loadingManager.onProgress = (_url, loaded, total) => {
			console.log(`loadingManager: loading ${loaded}/${total}`);
		};
		loadingManager.onError = (url) => {
			console.log('loadingManager: loading error for', url);
		};

		const textureLoader = new THREE.TextureLoader(loadingManager);

		/**
		 * Base color-like textures (used as diffuse/baseColor maps in the GUI)
		 */
		const minecraft = textureLoader.load('/textures/minecraft.png');
		const checker1024 = textureLoader.load('/textures/checkerboard-1024x1024.png');
		const checker2 = textureLoader.load('/textures/checkerboard-2x2.png');

		/**
		 * Door texture set (PBR-style maps).
		 * In this exercise they are treated as "regular" maps and swapped into `map` via GUI.
		 */
		const doorColor = textureLoader.load('/textures/door/color.jpg');
		const doorAlpha = textureLoader.load('/textures/door/alpha.jpg');
		const doorHeight = textureLoader.load('/textures/door/height.jpg');
		const doorNormal = textureLoader.load('/textures/door/normal.jpg');
		const doorAo = textureLoader.load('/textures/door/ambientOcclusion.jpg');
		const doorMetalness = textureLoader.load('/textures/door/metalness.jpg');
		const doorRoughness = textureLoader.load('/textures/door/roughness.jpg');

		/**
		 * Common configuration for textures that are displayed as color-like maps:
		 * - sRGB color space for correct gamma handling
		 * - Mirrored repeat wrapping for visible tiling
		 * - Nearest filtering to clearly show pixel structure when zoomed
		 */
		const colorLikeTextures = [
			minecraft,
			checker1024,
			checker2,
			doorColor,
			doorAlpha,
			doorHeight,
			doorNormal,
			doorAo,
			doorMetalness,
			doorRoughness,
		];

		for (const tex of colorLikeTextures) {
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.wrapS = THREE.MirroredRepeatWrapping;
			tex.wrapT = THREE.MirroredRepeatWrapping;
			tex.generateMipmaps = false;
			tex.minFilter = THREE.NearestFilter;
			tex.magFilter = THREE.NearestFilter;
		}

		this.textures = {
			minecraft,
			checker1024,
			checker2,
			doorColor,
			doorAlpha,
			doorHeight,
			doorNormal,
			doorAo,
			doorMetalness,
			doorRoughness,
		};

		/** Cube and basic material using the Minecraft texture as default */
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		console.log('Box geometry attributes:', geometry.attributes);

		const material = new THREE.MeshBasicMaterial({
			map: this.textures.minecraft,
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.scene.add(this.mesh);

		/** Camera */
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera = this.threeCoreService.createPerspectiveCamera(75, {
			width,
			height,
		});
		this.camera.position.set(1, 1, 1);
		this.scene.add(this.camera);

		/** Renderer */
		this.renderer = this.threeCoreService.createRenderer(canvas, {
			width,
			height,
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		/** OrbitControls (for interactive camera rotation/zoom) */
		this.controls = this.threeCoreService.createOrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
	}

	/**
	 * Initializes a "Textures" debug GUI that:
	 * - switches the active texture map (Minecraft, checkerboards, door maps)
	 * - controls UV repeat
	 * - changes wrapping mode
	 * - toggles between Nearest / Linear filtering
	 */
	private initGui(): void {
		this.gui = this.debugGuiService.createTexturesGui(this.mesh.material, this.textures);
	}

	/**
	 * Main render loop:
	 * - applies a slow auto-rotation to the cube to better showcase texture tiling and filtering
	 * - updates OrbitControls damping
	 * - renders the scene every frame
	 */
	private startLoop(): void {
		const tick = () => {
			this.animationFrameId = requestAnimationFrame(tick);

			const elapsedTime = this.clock.getElapsedTime();

			// Slow auto-spin to make texture sampling and tiling more visually obvious
			this.mesh.rotation.y = elapsedTime * 0.25;

			this.controls.update();
			this.renderer.render(this.scene, this.camera);
		};

		tick();
	}

	/**
	 * Keeps the perspective camera and renderer resolution in sync with the window size.
	 */
	private handleResize = () => {
		this.threeCoreService.updateOnResize(this.camera, this.renderer);
	};
}

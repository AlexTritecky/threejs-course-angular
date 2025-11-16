import {
	AfterViewInit,
	Component,
	ElementRef,
	OnDestroy,
	inject,
	viewChild,
} from '@angular/core';
import * as THREE from 'three';
import gsap from 'gsap';
import GUI from 'lil-gui';

import { ThreeCoreService } from '../../service/three-core.service';
import { DebugGuiService } from '../../service/debug-gui.service';

@Component({
	selector: 'app-scroll-animation',
	standalone: true,
	imports: [],
	templateUrl: './scroll-animation.html',
	styleUrls: ['./scroll-animation.scss'],
})
export class ScrollAnimation implements AfterViewInit, OnDestroy {
	private readonly threeCoreService = inject(ThreeCoreService);
	private readonly debugGuiService = inject(DebugGuiService);

	/** <canvas #canvas class="webgl"></canvas> */
	readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

	/** Core Three.js entities */
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private cameraGroup!: THREE.Group;

	/** Materials / meshes */
	private material!: THREE.MeshToonMaterial;
	private particlesMaterial!: THREE.PointsMaterial;
	private sectionMeshes: THREE.Mesh[] = [];

	/** Particles */
	private particles!: THREE.Points;
	private particlesGeometry!: THREE.BufferGeometry;

	/** Debug GUI instance */
	private gui: GUI | null = null;
	private params = {
		materialColor: '#ffeded',
		particlesSize: 0.03,
	};

	/** Scroll container (.app-content is expected) */
	private scrollContainer: HTMLElement | null = null;

	/** Viewport sizes (width = window, height = scroll container) */
	private sizes = {
		width: window.innerWidth,
		height: window.innerHeight,
	};

	/** Scroll / parallax state */
	private readonly objectsDistance = 4;
	private scrollY = 0;
	private currentSection = 0;
	private cursor = { x: 0, y: 0 };

	/** Animation helpers */
	private clock = new THREE.Clock();
	private previousTime = 0;
	private animationFrameId = 0;

	// ---------- LISTENERS ----------

	/** Handle window resize and keep camera/renderer in sync */
	private handleResize = () => {
		this.sizes.width = window.innerWidth;
		this.sizes.height =
			this.scrollContainer?.clientHeight ?? window.innerHeight;

		if (!this.camera || !this.renderer) return;

		this.threeCoreService.updateOnResize(this.camera, this.renderer, this.sizes);
	};

	/** Handle scroll inside the main content container and trigger section tween */
	private handleScroll = () => {
		if (!this.scrollContainer) return;

		this.scrollY = this.scrollContainer.scrollTop;

		const newSection = Math.round(this.scrollY / this.sizes.height);

		if (newSection !== this.currentSection && this.sectionMeshes[newSection]) {
			this.currentSection = newSection;

			gsap.to(this.sectionMeshes[this.currentSection].rotation, {
				duration: 1.5,
				ease: 'power2.inOut',
				x: '+=6',
				y: '+=3',
				z: '+=1.5',
			});
		}
	};

	/** Track cursor for parallax effect */
	private handleMouseMove = (event: MouseEvent) => {
		this.cursor.x = event.clientX / this.sizes.width - 0.5;
		this.cursor.y = event.clientY / this.sizes.height - 0.5;
	};

	// ---------- LIFECYCLE ----------

	ngAfterViewInit(): void {
		const canvasEl = this.canvas()?.nativeElement;
		if (!canvasEl) {
			console.error('Canvas element not found');
			return;
		}

		// 1) Locate the scroll container (app shell content)
		this.scrollContainer = document.querySelector(
			'.app-content',
		) as HTMLElement | null;

		if (!this.scrollContainer) {
			console.warn('.app-content not found, falling back to window height');
		}

		// 2) Sync initial sizes with current layout
		this.sizes = {
			width: window.innerWidth,
			height: this.scrollContainer?.clientHeight ?? window.innerHeight,
		};

		// 3) Initialize Three.js using shared services
		this.initScene();
		this.initCamera();
		this.initRenderer(canvasEl);
		this.initObjects();
		this.initLights();
		this.initParticles();
		this.initGui();

		// 4) Attach listeners
		window.addEventListener('resize', this.handleResize);
		window.addEventListener('mousemove', this.handleMouseMove);

		if (this.scrollContainer) {
			this.scrollContainer.addEventListener('scroll', this.handleScroll);
		} else {
			window.addEventListener('scroll', this.handleScroll);
		}

		this.handleScroll();
		this.tick();
	}

	ngOnDestroy(): void {
		cancelAnimationFrame(this.animationFrameId);

		window.removeEventListener('resize', this.handleResize);
		window.removeEventListener('mousemove', this.handleMouseMove);

		if (this.scrollContainer) {
			this.scrollContainer.removeEventListener('scroll', this.handleScroll);
		} else {
			window.removeEventListener('scroll', this.handleScroll);
		}

		this.gui?.destroy();
		this.renderer?.dispose();
		this.particlesGeometry?.dispose?.();
	}

	// ---------- INIT CORE ----------

	/** Create a new Scene via ThreeCoreService */
	private initScene(): void {
		this.scene = this.threeCoreService.createScene();
	}

	/** Create camera + camera group for parallax */
	private initCamera(): void {
		this.cameraGroup = new THREE.Group();
		this.scene.add(this.cameraGroup);

		this.camera = this.threeCoreService.createPerspectiveCamera(35, this.sizes);
		this.camera.position.z = 6;
		this.cameraGroup.add(this.camera);
	}

	/** Create renderer bound to shared canvas */
	private initRenderer(canvas: HTMLCanvasElement): void {
		this.renderer = this.threeCoreService.createRenderer(canvas, this.sizes);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor('#050608', 1); // dark background behind the content
	}

	// ---------- OBJECTS / LIGHTS / PARTICLES ----------

	/** Create toon meshes positioned per section (left/right alternation) */
	private initObjects(): void {
		const textureLoader = new THREE.TextureLoader();
		const gradientTexture = textureLoader.load('/textures/gradients/3.jpg');
		gradientTexture.magFilter = THREE.NearestFilter;

		this.material = new THREE.MeshToonMaterial({
			color: this.params.materialColor,
			gradientMap: gradientTexture,
		});

		const mesh1 = new THREE.Mesh(
			new THREE.TorusGeometry(1, 0.4, 16, 60),
			this.material,
		);
		const mesh2 = new THREE.Mesh(
			new THREE.ConeGeometry(1, 2, 32),
			this.material,
		);
		const mesh3 = new THREE.Mesh(
			new THREE.TorusKnotGeometry(0.8, 0.35, 100, 16),
			this.material,
		);

		// Alternate background placement left / right per section
		mesh1.position.x = -2;
		mesh2.position.x = 2;
		mesh3.position.x = -2;

		mesh1.position.y = -this.objectsDistance * 0;
		mesh2.position.y = -this.objectsDistance * 1;
		mesh3.position.y = -this.objectsDistance * 2;

		this.scene.add(mesh1, mesh2, mesh3);
		this.sectionMeshes = [mesh1, mesh2, mesh3];
	}

	/** Simple directional light for toon shading */
	private initLights(): void {
		const directionalLight = new THREE.DirectionalLight('#ffffff', 3);
		directionalLight.position.set(1, 1, 0);
		this.scene.add(directionalLight);
	}

	/** Create background particles distributed across all sections */
	private initParticles(): void {
		const particlesCount = 200;
		const positions = new Float32Array(particlesCount * 3);

		for (let i = 0; i < particlesCount; i++) {
			positions[i * 3 + 0] = (Math.random() - 0.5) * 10;
			positions[i * 3 + 1] =
				this.objectsDistance * 0.5 -
				Math.random() * this.objectsDistance * this.sectionMeshes.length;
			positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
		}

		this.particlesGeometry = new THREE.BufferGeometry();
		this.particlesGeometry.setAttribute(
			'position',
			new THREE.BufferAttribute(positions, 3),
		);

		this.particlesMaterial = new THREE.PointsMaterial({
			color: this.params.materialColor,
			sizeAttenuation: true,
			size: this.params.particlesSize,
		});

		this.particles = new THREE.Points(
			this.particlesGeometry,
			this.particlesMaterial,
		);
		this.scene.add(this.particles);
	}

	// ---------- GUI ----------

	/** Initialize lightweight GUI for color/particle tuning */
	private initGui(): void {
		this.gui = this.debugGuiService.createScrollAnimationGui(
			this.material,
			this.particlesMaterial,
			this.params,
		);
	}

	// ---------- LOOP ----------

	/** Main render loop: scroll → camera Y, cursor → parallax, slow mesh spin */
	private tick = () => {
		const elapsedTime = this.clock.getElapsedTime();
		const deltaTime = elapsedTime - this.previousTime;
		this.previousTime = elapsedTime;

		// Camera follows scroll along Y
		this.camera.position.y =
			(-this.scrollY / this.sizes.height) * this.objectsDistance;

		// Cursor-based parallax
		const parallaxX = this.cursor.x * 0.5;
		const parallaxY = -this.cursor.y * 0.5;

		this.cameraGroup.position.x +=
			(parallaxX - this.cameraGroup.position.x) * 5 * deltaTime;
		this.cameraGroup.position.y +=
			(parallaxY - this.cameraGroup.position.y) * 5 * deltaTime;

		// Slow spin of all section meshes
		for (const mesh of this.sectionMeshes) {
			mesh.rotation.x += deltaTime * 0.1;
			mesh.rotation.y += deltaTime * 0.12;
		}

		this.renderer.render(this.scene, this.camera);

		this.animationFrameId = window.requestAnimationFrame(this.tick);
	};
}

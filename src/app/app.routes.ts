import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'chapter-01/transform',
		pathMatch: 'full',
	},

	{
		path: 'chapter-01',
		children: [
			{
				path: '',
				redirectTo: 'transform',
				pathMatch: 'full',
			},
			{
				path: 'transform',
				loadComponent: () =>
					import('./pages/transform-objects/transform-objects').then(
						(m) => m.TransformObjects,
					),
			},
			{
				path: 'animations',
				loadComponent: () =>
					import('./pages/animations/animations').then((m) => m.Animations),
			},
			{
				path: 'cameras',
				loadComponent: () => import('./pages/cameras/cameras').then((m) => m.Cameras),
			},
			{
				path: 'geometries',
				loadComponent: () =>
					import('./pages/geometries/geometries').then((m) => m.Geometries),
			},
			{
				path: 'debug-ui',
				loadComponent: () => import('./pages/debug-ui/debug-ui').then((m) => m.DebugUi),
			},
			{
				path: 'textures',
				loadComponent: () => import('./pages/textures/textures').then((m) => m.Textures),
			},
			{
				path: 'materials',
				loadComponent: () => import('./pages/materials/materials').then((m) => m.Materials),
			},
			{
				path: 'text',
				loadComponent: () => import('./pages/text/text').then((m) => m.Text),
			},
		],
	},

	/**
	 * Chapter 02 – Lighting
	 */
	{
		path: 'chapter-02',
		children: [
			{
				path: '',
				redirectTo: 'lights',
				pathMatch: 'full',
			},
			{
				path: 'lights',
				loadComponent: () => import('./pages/lights/lights').then((m) => m.Lights),
			},
			{
				path: 'shadows',
				loadComponent: () => import('./pages/shadows/shadows').then((m) => m.Shadows),
			},
			{
				path: 'haunted-house',
				loadComponent: () =>
					import('./pages/haunted-house/haunted-house').then((m) => m.HauntedHouse),
			},
			{
				path: 'particles',
				loadComponent: () => import('./pages/particles/particles').then((m) => m.Particles),
			},
			{
				path: 'galaxy',
				loadComponent: () => import('./pages/galaxy/galaxy').then((m) => m.Galaxy),
			},
			{
				path: 'scroll-animation',
				loadComponent: () =>
					import('./pages/scroll-animation/scroll-animation').then(
						(m) => m.ScrollAnimation,
					),
			},
		],
	},

	{
		path: 'chapter-03',
		children: [
			{ path: '', redirectTo: 'physics', pathMatch: 'full' },
			{
				path: 'physics',
				loadComponent: () => import('./pages/physics/physics').then((m) => m.Physics),
			},
			{
				path: 'imported-models',
				loadComponent: () => import('./pages/imported-models/imported-models').then((m) => m.ImportedModels),
			},
			{
				path: 'raycaster',
				loadComponent: () => import('./pages/raycaster/raycaster').then((m) => m.Raycaster),
			},
			{
				path: 'blender-models',
				loadComponent: () => import('./pages/blender-models/blender-models').then((m) => m.BlenderModels),
			},
			{
				path: 'environment-map',
				loadComponent: () => import('./pages/environment-map/environment-map').then((m) => m.EnvironmentMap),
			}
		],
	},

	{
		path: '**',
		redirectTo: 'chapter-01/transform',
	},
];

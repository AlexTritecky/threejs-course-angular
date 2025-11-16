import { Routes } from '@angular/router';
import { TransformObjects } from './pages/transform-objects/transform-objects';
import { Animations } from './pages/animations/animations';
import { Cameras } from './pages/cameras/cameras';
import { Geometries } from './pages/geometries/geometries';
import { DebugUi } from './pages/debug-ui/debug-ui';
import { Textures } from './pages/textures/textures';
import { Materials } from './pages/materials/materials';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'chapter-01/debug-ui',
		pathMatch: 'full'
	},
	{
		path: 'chapter-01/transform',
		component: TransformObjects
	},
	{
		path: 'chapter-01/animations',
		component: Animations
	},
	{
		path: 'chapter-01/cameras',
		component: Cameras
	},
	{
		path: 'chapter-01/geometries',
		component: Geometries
	},
	{
		path: 'chapter-01/debug-ui',
		component: DebugUi
	},
	{
		path: 'chapter-01/textures',
		component: Textures
	},
	{
		path: 'chapter-01/materials',
		component: Materials
	}
];

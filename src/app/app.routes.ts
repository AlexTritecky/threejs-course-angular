import { Routes } from '@angular/router';
import { TransformObjects } from './pages/transform-objects/transform-objects';
import { Animations } from './pages/animations/animations';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'chapter-01/animations',
		pathMatch: 'full'
	},
	{
		path: 'chapter-01/transform',
		component: TransformObjects
	},
	{
		path: 'chapter-01/animations',
		component: Animations
	}
];

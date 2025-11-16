import { Routes } from '@angular/router';
import { TransformObjects } from './pages/transform-objects/transform-objects';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'chapter-01/transform',
		pathMatch: 'full'
	},
	{
		path: 'chapter-01/transform',
		component: TransformObjects
	}
];

import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatExpansionModule } from '@angular/material/expansion';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { COURSE_CHAPTERS } from './constants/chapters';
import { CourseChapter } from './models/course-chapter.model';

@Component({
	selector: 'app-root',
	imports: [
		RouterOutlet,
		RouterLink,
		RouterLinkActive,
		MatToolbarModule,
		MatButtonModule,
		MatSidenavModule,
		MatListModule,
		MatExpansionModule,
	],
	templateUrl: './app.html',
	styleUrl: './app.scss',
})
export class App {
	private readonly router = inject(Router);

	readonly chapters = COURSE_CHAPTERS;

	isChapterActive(chapter: CourseChapter): boolean {
		const url = this.router.url;
		return chapter.items.some((item) => url.startsWith(item.route));
	}
}

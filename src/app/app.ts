import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { COURSE_CHAPTERS } from './constants/chapters';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatSidenavModule, MatListModule,],
	templateUrl: './app.html',
	styleUrl: './app.scss'
})
export class App {

	readonly chapters = COURSE_CHAPTERS;
}

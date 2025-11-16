export interface CourseChapter {
	id: string;
	title: string;
	items: {
		label: string;
		route: string;
	}[];
}

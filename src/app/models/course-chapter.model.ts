export interface CourseChapterItem {
	label: string;
	route: string;
}

export interface CourseChapter {
	id: string;
	title: string;
	items: CourseChapterItem[];
}

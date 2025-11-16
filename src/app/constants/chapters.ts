import { CourseChapter } from "../models/course-chapter.model";

export const COURSE_CHAPTERS: CourseChapter[] = [
	{
		id: 'chapter-01',
		title: 'Chapter 01 – Basics',
		items: [
			{ label: '03. First Three.js Project', route: '/chapter-01/project' },
			{ label: '04. Transform objects', route: '/chapter-01/transform' },
			{ label: '05. Animations', route: '/chapter-01/animations' },
			{ label: '06. Cameras', route: '/chapter-01/cameras' },
			{ label: '07. Fullscreen and resizing', route: '/chapter-01/fullscreen-resize' },
			{ label: '08. Geometries', route: '/chapter-01/geometries' },
			{ label: '09. Debug UI', route: '/chapter-01/debug-ui' },
			{ label: '10. Textures', route: '/chapter-01/textures' },
			{ label: '11. Materials', route: '/chapter-01/materials' },
			{ label: '12. 3D Text', route: '/chapter-01/text' },
		],
	},

	{
		id: 'chapter-02',
		title: 'Chapter 02 – ???',
		items: [
			// додаси пізніше
		],
	},

	{
		id: 'chapter-03',
		title: 'Chapter 03 – ???',
		items: [
			// додаси пізніше
		],
	},
];


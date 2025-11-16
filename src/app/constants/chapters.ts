import { CourseChapter } from "../models/course-chapter.model";

export const COURSE_CHAPTERS: CourseChapter[] = [
	{
		id: 'chapter-01',
		title: 'Chapter 01 – Basics',
		items: [
			{ label: 'Transform objects', route: '/chapter-01/transform' },
			{ label: 'Animations', route: '/chapter-01/animations' },
			{ label: 'Cameras', route: '/chapter-01/cameras' },
			{ label: 'Geometries', route: '/chapter-01/geometries' },
			{ label: 'Debug UI', route: '/chapter-01/debug-ui' },
			{ label: 'Textures', route: '/chapter-01/textures' },
			{ label: 'Materials', route: '/chapter-01/materials' },
			{ label: '3D Text', route: '/chapter-01/text' },
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


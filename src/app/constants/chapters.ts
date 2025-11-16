import { CourseChapter } from '../models/course-chapter.model';

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
		title: 'Chapter 02 – Classic techniques',
		items: [
			{ label: 'Lights', route: '/chapter-02/lights' },
			{ label: 'Shadows', route: '/chapter-02/shadows' },
			{ label: 'Haunted House', route: '/chapter-02/haunted-house' },
			{ label: 'Particles', route: '/chapter-02/particles' },
			{ label: 'Galaxy Generator', route: '/chapter-02/galaxy' },
			{ label: 'Scroll Based Animation', route: '/chapter-02/scroll-animation' },
		],
	},

	{
		id: 'chapter-03',
		title: 'Chapter 03 – Advanced techniques',
		items: [
			{ label: 'Physics', route: '/chapter-03/physics' },
			{ label: 'Imported models', route: '/chapter-03/imported-models' },
			{ label: 'Raycaster & Mouse Events', route: '/chapter-03/raycaster' },
			{ label: 'Custom models with Blender', route: '/chapter-03/blender-models' },
			{ label: 'Environment map', route: '/chapter-03/environment-map' },
			{ label: 'Realistic render', route: '/chapter-03/realistic-render' },
			{ label: 'Code structuring for bigger projects', route: '/chapter-03/structuring' },
		],
	},
];

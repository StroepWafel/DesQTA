import { cache } from '../../utils/cache';
import { seqtaFetch } from '../../utils/netUtil';

// Centralized background warm-up of frequently used SEQTA endpoints.
// This primes the in-memory cache so pages can render instantly.

const STUDENT_ID = 69; // Matches existing page usage

function getMonday(d: Date): Date {
	const copy = new Date(d);
	const day = copy.getDay();
	const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
	copy.setDate(diff);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = (date.getMonth() + 1).toString().padStart(2, '0');
	const d = date.getDate().toString().padStart(2, '0');
	return `${y}-${m}-${d}`;
}

async function prefetchLessonColours(): Promise<any[]> {
	const cached = cache.get<any[]>('lesson_colours');
	if (cached) return cached;
	try {
		const res = await seqtaFetch('/seqta/student/load/prefs?', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: { request: 'userPrefs', asArray: true, user: STUDENT_ID },
		});
		const colours = JSON.parse(res).payload;
		cache.set('lesson_colours', colours, 30);
		return colours;
	} catch {
		return [];
	}
}

async function prefetchTimetableWeek(): Promise<void> {
	try {
		const weekStart = getMonday(new Date());
		const from = formatDate(weekStart);
		const until = formatDate(new Date(weekStart.getTime() + 4 * 86400000));
		const cacheKey = `timetable_${from}_${until}`;
		if (cache.get(cacheKey)) return;

		const colours = await prefetchLessonColours();
		const res = await seqtaFetch('/seqta/student/load/timetable?', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: { from, until, student: STUDENT_ID },
		});
		const lessons = JSON.parse(res).payload.items.map((lesson: any) => {
			const colourPrefName = `timetable.subject.colour.${lesson.code}`;
			const subjectColour = colours.find((c: any) => c.name === colourPrefName);
			lesson.colour = subjectColour ? `${subjectColour.value}` : `#232428`;
			lesson.from = lesson.from.substring(0, 5);
			lesson.until = lesson.until.substring(0, 5);
			lesson.dayIdx = (new Date(lesson.date).getDay() + 6) % 7;
			return lesson;
		});
		cache.set(cacheKey, lessons, 30);
	} catch {
		// ignore warmup errors
	}
}

async function prefetchUpcomingAssessments(): Promise<void> {
	try {
		// If already cached, skip
		if (cache.get('upcoming_assessments_data')) return;

		const [assessmentsRes, classesRes] = await Promise.all([
			seqtaFetch('/seqta/student/assessment/list/upcoming?', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: { student: STUDENT_ID },
			}),
			seqtaFetch('/seqta/student/load/subjects?', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: {},
			}),
		]);

		const colours = await prefetchLessonColours();
		const classesResJson = JSON.parse(classesRes);
		const activeClass = classesResJson.payload.find((c: any) => c.active);
		const activeSubjects = activeClass ? activeClass.subjects : [];
		const subjectFilters: Record<string, boolean> = {};
		activeSubjects.forEach((s: any) => (subjectFilters[s.code] = true));
		const activeCodes = activeSubjects.map((s: any) => s.code);

		const upcomingAssessments = JSON.parse(assessmentsRes)
			.payload.filter((a: any) => activeCodes.includes(a.code))
			.filter((a: any) => new Date(a.due) >= new Date())
			.map((a: any) => {
				const prefName = `timetable.subject.colour.${a.code}`;
				const c = colours.find((p: any) => p.name === prefName);
				a.colour = c ? c.value : '#8e8e8e';
				return a;
			})
			.sort((a: any, b: any) => (a.due < b.due ? -1 : 1));

		cache.set(
			'upcoming_assessments_data',
			{ assessments: upcomingAssessments, subjects: activeSubjects, filters: subjectFilters },
			60,
		);
	} catch {
		// ignore warmup errors
	}
}

export async function warmUpCommonData(): Promise<void> {
	// Run in parallel, ignore individual failures
	await Promise.allSettled([
		prefetchLessonColours(),
		prefetchTimetableWeek(),
		prefetchUpcomingAssessments(),
	]);
}




export interface AcademicInfo {
  gradeLevel: string;
  subject: string;
  courseName: string;
  term: string;
  academicYear: string;
  teacherName: string;
  logo?: string; // base64 string
  themeColor?: string; // Hex color for identity
}

export interface ScheduleSetup {
  startDate: string;
  endDate: string;
  totalWeeks: number;
  totalDays: number;
}

export type BlockType = 'Exam' | 'Revision' | 'Event' | 'Holiday' | 'Meeting';

export interface BlockedDate {
  date: string; // ISO string
  label: string;
  type: BlockType;
}

export interface BlockedWeek {
  weekNumber: number;
  label: string;
  type: BlockType;
  excludeFromCount: boolean; // If true, this week doesn't increment the "Week #" counter
}

export interface Lesson {
  id: string;
  name: string;
  ccss: string;
  pacing: number; // Days
}

export interface DayPlan {
  date: string;
  dayName: string; // Sunday, Monday, etc.
  isBlocked: boolean;
  blockLabel?: string;
  lessonId?: string;
  lessonName?: string;
}

export interface WeekPlan {
  weekNumber: number | null; // null if excluded from count
  displayWeekLabel: string; // "Week X" or "Break"
  dates: string; // Range e.g. "Sept 1 - Sept 5"
  days: DayPlan[];
  isBlocked?: boolean;
  blockLabel?: string;
}

export interface CurriculumContent {
  expectations: string;
  skills: string;
  questions: string;
  strategies: string;
  activities: string;
}

export interface DetailedLessonPlan extends Lesson, CurriculumContent {
  assignedDays: string[];
}

export interface CurriculumMap {
  weeks: WeekPlan[];
  lessonDetails: Record<string, DetailedLessonPlan>;
  courseDescription: string;
  learningObjectives: string;
  prerequisites: string;
  courseCredit: string;
}

export enum Step {
  ACADEMIC_INFO = 0,
  SCHEDULE = 1,
  BLOCKING = 2,
  LESSONS = 3,
  GENERATION = 4,
  PREVIEW = 5
}

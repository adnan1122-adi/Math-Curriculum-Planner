
import { format, addDays, startOfDay, endOfDay, eachDayOfInterval, getDay, isBefore, isAfter, differenceInCalendarDays, isValid } from 'date-fns';
import { BlockedDate, BlockedWeek, WeekPlan, DayPlan, Lesson } from '../types';

// School week: Sunday (0) to Thursday (4)
export const SCHOOL_DAYS = [0, 1, 2, 3, 4];

export function calculateInstructionalStats(start: Date, end: Date, blockedDates: BlockedDate[] = [], blockedWeeks: BlockedWeek[] = []) {
  if (!isValid(start) || !isValid(end) || isAfter(start, end)) return { totalDays: 0, totalWeeks: 0 };

  const allDays = eachDayOfInterval({ start: startOfDay(start), end: endOfDay(end) });
  
  // 1. Get all school days in the range
  const schoolDays = allDays.filter(d => SCHOOL_DAYS.includes(getDay(d)));
  
  // 2. Filter out specifically blocked dates
  const blockedDateStrings = new Set(
    blockedDates
      .map(bd => {
        const d = parseISOIfNeeded(bd.date);
        return isValid(d) ? format(d, 'yyyy-MM-dd') : null;
      })
      .filter(Boolean) as string[]
  );
  
  // 3. Helper to determine week number from start date
  const getWeekNum = (date: Date) => {
    // Normalize to Sunday of the first week
    let firstSunday = startOfDay(start);
    while (getDay(firstSunday) !== 0) firstSunday = addDays(firstSunday, -1);
    
    const diff = differenceInCalendarDays(startOfDay(date), firstSunday);
    return Math.floor(diff / 7) + 1;
  };

  const availableDays = schoolDays.filter(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    if (blockedDateStrings.has(dateStr)) return false;
    
    const weekNum = getWeekNum(day);
    const isWeekBlocked = blockedWeeks.some(bw => bw.weekNumber === weekNum);
    return !isWeekBlocked;
  });

  return {
    totalDays: availableDays.length,
    totalWeeks: Math.ceil(availableDays.length / 5)
  };
}

function parseISOIfNeeded(date: string | Date): Date {
  if (date instanceof Date) return date;
  try {
    const d = new Date(date);
    return isValid(d) ? d : new Date(NaN);
  } catch {
    return new Date(NaN);
  }
}

export function getWeekDateRanges(start: Date, end: Date): { weekNumber: number; range: string }[] {
  if (!isValid(start) || !isValid(end)) return [];

  const ranges: { weekNumber: number; range: string }[] = [];
  let current = startOfDay(start);
  const finish = endOfDay(end);
  
  // Align current to Sunday of the first week
  while (getDay(current) !== 0) current = addDays(current, -1);
  
  let weekCounter = 1;
  while (isBefore(current, finish)) {
    const weekStart = current;
    const weekEnd = addDays(weekStart, 4);
    
    // Check if this week falls at least partially in the range
    const overlaps = !isAfter(weekStart, finish) && !isBefore(weekEnd, startOfDay(start));
    
    if (overlaps) {
      ranges.push({
        weekNumber: weekCounter,
        range: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
      });
    }
    
    current = addDays(weekStart, 7);
    weekCounter++;
  }
  return ranges;
}

export function generateEmptyWeeks(
  start: Date, 
  end: Date, 
  blockedDates: BlockedDate[], 
  blockedWeeks: BlockedWeek[]
): WeekPlan[] {
  if (!isValid(start) || !isValid(end)) return [];

  const weeks: WeekPlan[] = [];
  const finish = endOfDay(end);
  
  // Align current to Sunday of the first week
  let weekStart = startOfDay(start);
  while (getDay(weekStart) !== 0) weekStart = addDays(weekStart, -1);
  
  let rawWeekCounter = 1;
  let instructionalWeekCounter = 1;

  while (isBefore(weekStart, finish)) {
    const weekDays: DayPlan[] = [];
    const weekBlock = blockedWeeks.find(bw => bw.weekNumber === rawWeekCounter);

    for (let i = 0; i < 7; i++) {
       const day = addDays(weekStart, i);
       if (isAfter(day, finish)) break;
       if (isBefore(day, startOfDay(start))) continue;
       
       const dNum = getDay(day);
       if (SCHOOL_DAYS.includes(dNum)) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dateBlock = blockedDates.find(b => {
             const d = parseISOIfNeeded(b.date);
             return isValid(d) && format(d, 'yyyy-MM-dd') === dateStr;
          });

          const isBlocked = !!weekBlock || !!dateBlock;
          const blockLabel = weekBlock?.label || dateBlock?.label;

          weekDays.push({
            date: day.toISOString(),
            dayName: format(day, 'EEEE'),
            isBlocked,
            blockLabel
          });
       }
       if (dNum === 4) break; 
    }

    if (weekDays.length > 0) {
      let displayWeekLabel = "";
      let assignedWeekNumber: number | null = null;

      if (weekBlock && weekBlock.excludeFromCount) {
        displayWeekLabel = weekBlock.label || "Holiday Break";
        assignedWeekNumber = null;
      } else {
        assignedWeekNumber = instructionalWeekCounter++;
        displayWeekLabel = `Week ${assignedWeekNumber}`;
      }

      weeks.push({
        weekNumber: assignedWeekNumber,
        displayWeekLabel,
        dates: `${format(new Date(weekDays[0].date), 'MMM d')} - ${format(new Date(weekDays[weekDays.length - 1].date), 'MMM d')}`,
        days: weekDays,
        isBlocked: !!weekBlock,
        blockLabel: weekBlock?.label
      });
    }

    weekStart = addDays(weekStart, 7);
    rawWeekCounter++;
  }

  return weeks;
}

export function distributeLessons(weeks: WeekPlan[], lessons: Lesson[]): WeekPlan[] {
  let lessonIdx = 0;
  let dayInLessonCounter = 0;
  const updatedWeeks = JSON.parse(JSON.stringify(weeks)) as WeekPlan[];

  for (const week of updatedWeeks) {
    for (const day of week.days) {
      day.lessonId = undefined;
      day.lessonName = undefined;
      
      if (day.isBlocked) continue;
      if (lessonIdx >= lessons.length) continue;

      const currentLesson = lessons[lessonIdx];
      day.lessonId = currentLesson.id;
      day.lessonName = currentLesson.name;
      
      dayInLessonCounter++;
      if (dayInLessonCounter >= (Number(currentLesson.pacing) || 1)) {
        lessonIdx++;
        dayInLessonCounter = 0;
      }
    }
  }

  return updatedWeeks;
}

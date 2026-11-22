// Knowledge pack builders: one record per tutorial lesson (src/content/tutorial/lessons.ts). Each lesson's text
// describes what it teaches, its goal and the step-by-step instructions the player follows.
import type { KbRecord } from '../types';
import type { MentionLinker } from './mentions';
import { finishRecord, linksTo } from './record';

export interface LessonStepInput {
  read?: readonly string[];
  do: string;
  after?: string;
  hint?: string;
}

export interface LessonInput {
  id: string;
  title: string;
  teaches: string;
  goal: string;
  minutes: string;
  steps: readonly LessonStepInput[];
  done: string;
}

export function buildLessons(lessons: readonly LessonInput[], o: { linker: MentionLinker; file: string }): KbRecord[] {
  return lessons.map((l, i) => {
    const stepLines = l.steps.map((s, j) => {
      const parts = [...(s.read ?? []), s.do, s.after].filter(Boolean);
      return `Step ${j + 1}: ${parts.join(' ')}`;
    });
    const text = [
      `${l.title}: a tutorial lesson (${l.minutes}). ${l.teaches}`,
      `Goal: ${l.goal}`,
      ...stepLines,
      `Completion: ${l.done}`,
    ].join('\n');
    const prose = [l.teaches, l.goal, ...l.steps.flatMap((s) => [...(s.read ?? []), s.do, s.after ?? '', s.hint ?? '']), l.done].join('\n');
    return finishRecord({
      id: `lesson:${l.id}`,
      kind: 'lesson',
      title: l.title,
      aliases: [l.id],
      text,
      fields: { minutes: l.minutes, steps: l.steps.length, order: i + 1 },
      links: linksTo('mentions', o.linker.cardsIn(prose).map((id) => `card:${id}`)),
      source: { file: o.file, at: l.id },
      origin: 'authored',
      scope: 'public',
    });
  });
}

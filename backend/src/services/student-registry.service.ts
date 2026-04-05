import dsceStudentRoster from '../data/student-roster.json';
import nieStudentRoster from '../data/nie-student-roster.json';
import { DEFAULT_COLLEGE, type SupportedCollege, resolveCollege } from '../config/college.js';

type StudentRoster = Record<string, string>;

const rosters: Record<SupportedCollege, StudentRoster> = {
  DSCE: dsceStudentRoster as StudentRoster,
  NIE: nieStudentRoster as StudentRoster,
};

export const normalizeUsn = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, '');

export const lookupStudentByUsn = (
  value: string,
  college: SupportedCollege = DEFAULT_COLLEGE,
): { usn: string; name: string } | null => {
  const usn = normalizeUsn(value);
  const name = rosters[college][usn];

  if (!name) {
    return null;
  }

  return { usn, name };
};

export const studentRegistrySize = (college: SupportedCollege = DEFAULT_COLLEGE) =>
  Object.keys(rosters[college]).length;

export const resolveRosterCollege = (value: unknown): SupportedCollege => resolveCollege(value);

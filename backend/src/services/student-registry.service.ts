import studentRoster from '../data/student-roster.json';

type StudentRoster = Record<string, string>;

const roster = studentRoster as StudentRoster;

export const normalizeUsn = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, '');

export const lookupStudentByUsn = (value: string): { usn: string; name: string } | null => {
  const usn = normalizeUsn(value);
  const name = roster[usn];

  if (!name) {
    return null;
  }

  return { usn, name };
};

export const studentRegistrySize = Object.keys(roster).length;

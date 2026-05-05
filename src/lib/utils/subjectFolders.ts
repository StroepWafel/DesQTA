/**
 * SEQTA returns multiple class folders (often one per academic year); only one is `active`.
 * Merge subjects from all folders in the same academic year as the active folder by matching
 * a 4-digit year (20xx) in the folder `code`. If no year is found on the active folder,
 * include all folders (deduped) so assessments are not limited to a single active folder.
 */
export function dedupeSubjectsByProgrammeMetaclass(subjects: any[]): any[] {
  const map = new Map<string, any>();
  for (const s of subjects) {
    const key = `${s.programme}-${s.metaclass}`;
    if (!map.has(key)) map.set(key, s);
  }
  return Array.from(map.values());
}

export function getSubjectsForCurrentAcademicYear(payload: unknown): any[] {
  const folders = Array.isArray(payload) ? payload : [];
  const active = folders.find((f: any) => f.active);
  if (!active) {
    return dedupeSubjectsByProgrammeMetaclass(
      folders.flatMap((f: any) => f.subjects ?? []),
    );
  }
  const codeStr = String(active.code ?? '');
  const yearMatch = codeStr.match(/\b(20\d{2})\b/);
  let relevantFolders: any[];
  if (yearMatch) {
    const y = yearMatch[1];
    relevantFolders = folders.filter((f: any) => String(f.code ?? '').includes(y));
  } else {
    relevantFolders = folders;
  }
  return dedupeSubjectsByProgrammeMetaclass(relevantFolders.flatMap((f: any) => f.subjects ?? []));
}

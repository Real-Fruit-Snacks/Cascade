export function fuzzyMatch(query: string, target: string): { match: boolean; score: number; indices: number[] } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t.includes(q)) {
    const start = t.indexOf(q);
    const indices = Array.from({ length: q.length }, (_, i) => start + i);
    return { match: true, score: Math.max(0, 100 - start), indices };
  }

  let qi = 0;
  let score = 0;
  const indices: number[] = [];
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      indices.push(ti);
      qi++;
    }
  }

  return { match: qi === q.length, score, indices };
}

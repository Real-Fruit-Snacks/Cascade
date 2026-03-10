import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from './fuzzy-match';

describe('fuzzyMatch', () => {
  describe('exact matches', () => {
    it('matches an exact string', () => {
      const result = fuzzyMatch('hello', 'hello');
      expect(result.match).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('returns correct indices for exact match', () => {
      const result = fuzzyMatch('abc', 'abc');
      expect(result.indices).toEqual([0, 1, 2]);
    });

    it('returns high score for match at start of string', () => {
      const start = fuzzyMatch('ab', 'abcdef');
      const end = fuzzyMatch('ab', 'xyzab');
      // substring match at start scores higher (100 - startIndex)
      expect(start.score).toBeGreaterThan(end.score);
    });
  });

  describe('substring matches', () => {
    it('matches query as a substring of target', () => {
      const result = fuzzyMatch('ell', 'hello');
      expect(result.match).toBe(true);
    });

    it('returns consecutive indices for substring match', () => {
      const result = fuzzyMatch('ell', 'hello');
      expect(result.indices).toEqual([1, 2, 3]);
    });

    it('matches at the end of target', () => {
      const result = fuzzyMatch('world', 'hello world');
      expect(result.match).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of query case', () => {
      expect(fuzzyMatch('HELLO', 'hello').match).toBe(true);
    });

    it('matches regardless of target case', () => {
      expect(fuzzyMatch('hello', 'HELLO').match).toBe(true);
    });

    it('matches mixed case', () => {
      expect(fuzzyMatch('HeLLo', 'hElLO').match).toBe(true);
    });
  });

  describe('fuzzy (non-consecutive) matches', () => {
    it('matches characters in order but non-consecutively', () => {
      const result = fuzzyMatch('ac', 'abc');
      expect(result.match).toBe(true);
      expect(result.indices).toEqual([0, 2]);
    });

    it('matches scattered characters', () => {
      const result = fuzzyMatch('hnl', 'hello node land');
      expect(result.match).toBe(true);
    });

    it('returns score equal to matched character count for fuzzy match', () => {
      const result = fuzzyMatch('ac', 'a_b_c');
      expect(result.match).toBe(true);
      // fuzzy path: score += 1 per matched char
      expect(result.score).toBe(2);
    });
  });

  describe('no match', () => {
    it('returns match:false when query chars not found in order', () => {
      const result = fuzzyMatch('xyz', 'abc');
      expect(result.match).toBe(false);
    });

    it('returns empty indices on no match', () => {
      const result = fuzzyMatch('xyz', 'abc');
      expect(result.indices).toEqual([]);
    });

    it('returns zero score on no match', () => {
      const result = fuzzyMatch('xyz', 'abc');
      expect(result.score).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('empty query matches anything', () => {
      // empty string is always a substring of any string
      const result = fuzzyMatch('', 'hello');
      expect(result.match).toBe(true);
    });

    it('empty query against empty target', () => {
      const result = fuzzyMatch('', '');
      expect(result.match).toBe(true);
    });

    it('query longer than target does not match', () => {
      const result = fuzzyMatch('abcdef', 'abc');
      expect(result.match).toBe(false);
    });

    it('handles special regex characters in query safely', () => {
      // The function uses string ops, not regex on query — should not throw
      const result = fuzzyMatch('a.b', 'a.b');
      expect(result.match).toBe(true);
    });

    it('single character query matches single character target', () => {
      expect(fuzzyMatch('a', 'a').match).toBe(true);
    });

    it('single character query does not match different character', () => {
      expect(fuzzyMatch('a', 'b').match).toBe(false);
    });

    it('query equal to target length matches exactly', () => {
      const result = fuzzyMatch('hello', 'hello');
      expect(result.match).toBe(true);
      expect(result.indices.length).toBe(5);
    });
  });

  describe('score ordering', () => {
    it('substring match scores higher than scattered fuzzy match', () => {
      // 'ab' as substring in 'ab_xyz' vs scattered in 'a_xyz_b'
      const sub = fuzzyMatch('ab', 'abcde');   // substring at index 0 → score = 100
      const fuzzy = fuzzyMatch('ab', 'a_b');   // fuzzy → score = 2
      expect(sub.score).toBeGreaterThan(fuzzy.score);
    });
  });
});

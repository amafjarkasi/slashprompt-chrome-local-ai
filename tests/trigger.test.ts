import { describe, expect, it } from 'vitest';
import { findTriggerMatch } from '../src/shared/trigger.js';

describe('findTriggerMatch', () => {
  it('matches // at start of text', () => {
    const text = '// write a poem';
    expect(findTriggerMatch(text, text.length)).toEqual({
      start: 0,
      end: text.length,
      query: 'write a poem',
    });
  });

  it('matches // after whitespace or newline', () => {
    const text = 'Hello\n// explain quantum computing';
    expect(findTriggerMatch(text, text.length)).toEqual({
      start: 6,
      end: text.length,
      query: 'explain quantum computing',
    });
  });

  it('ignores URLs like https://example.com', () => {
    const text = 'Check https://example.com/docs';
    expect(findTriggerMatch(text, text.length)).toBeNull();
  });

  it('ignores triple slash ///', () => {
    const text = '/// comment here';
    expect(findTriggerMatch(text, text.length)).toBeNull();
  });

  it('requires at least 2 non-whitespace characters after prefix', () => {
    expect(findTriggerMatch('// a', 4)).toBeNull();
    expect(findTriggerMatch('//  ', 4)).toBeNull();
    expect(findTriggerMatch('// ab', 5)).toEqual({
      start: 0,
      end: 5,
      query: 'ab',
    });
  });

  it('supports custom trigger prefixes', () => {
    const text = 'Draft: /p make it concise';
    expect(findTriggerMatch(text, text.length, '/p')).toEqual({
      start: 7,
      end: text.length,
      query: 'make it concise',
    });
  });

  it('respects cursorOffset in the middle of text', () => {
    const text = '// fix bug\nsome trailing text';
    expect(findTriggerMatch(text, 10)).toEqual({
      start: 0,
      end: 10,
      query: 'fix bug',
    });
  });
});

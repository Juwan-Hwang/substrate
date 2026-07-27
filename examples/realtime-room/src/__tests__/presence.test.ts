/**
 * Tests for presence protocol utilities.
 */
import { describe, expect, it } from 'vitest';
import { generateGuestName, generateUserId, pickColor } from '../lib/presence';

describe('generateUserId', () => {
  it('produces a unique string each call', () => {
    const a = generateUserId();
    const b = generateUserId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('pickColor', () => {
  it('returns a hex color for any string', () => {
    const color = pickColor('test-user-id');
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns the same color for the same ID', () => {
    expect(pickColor('user-123')).toBe(pickColor('user-123'));
  });

  it('returns one of the predefined colors', () => {
    const colors = ['#7C8BA0', '#5B8DB8', '#8B7355', '#6B8E6B', '#9B7B9B', '#B8866B'];
    expect(colors).toContain(pickColor('any-id'));
  });
});

describe('generateGuestName', () => {
  it('produces a two-word name', () => {
    const name = generateGuestName();
    const parts = name.split(' ');
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('capitalises both words', () => {
    const name = generateGuestName();
    const parts = name.split(' ');
    expect(parts[0][0]).toBe(parts[0][0].toUpperCase());
    expect(parts[1][0]).toBe(parts[1][0].toUpperCase());
  });
});

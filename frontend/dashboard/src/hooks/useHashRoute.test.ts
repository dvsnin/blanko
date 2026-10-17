import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { parseHash, routeToHash, navigate, useHashRoute, type Route } from './useHashRoute';

describe('parseHash', () => {
  it('maps empty and root hashes to boards', () => {
    expect(parseHash('')).toEqual({ name: 'boards' });
    expect(parseHash('#')).toEqual({ name: 'boards' });
    expect(parseHash('#/')).toEqual({ name: 'boards' });
  });
  it('parses templates with optional age', () => {
    expect(parseHash('#/templates')).toEqual({ name: 'templates' });
    expect(parseHash('#/templates?age=3-4')).toEqual({ name: 'templates', age: '3-4' });
    expect(parseHash('#/templates?age=zzz')).toEqual({ name: 'templates' });
  });
  it('parses groups and profile', () => {
    expect(parseHash('#/groups')).toEqual({ name: 'groups' });
    expect(parseHash('#/profile')).toEqual({ name: 'profile' });
  });
  it('falls back to boards for unknown routes', () => {
    expect(parseHash('#/whatever')).toEqual({ name: 'boards' });
  });
});

describe('routeToHash', () => {
  const routes: Route[] = [
    { name: 'boards' },
    { name: 'templates' },
    { name: 'templates', age: '3-4' },
    { name: 'groups' },
    { name: 'profile' },
  ];
  it('is the inverse of parseHash', () => {
    for (const r of routes) expect(parseHash(routeToHash(r))).toEqual(r);
  });
  it('produces expected strings', () => {
    expect(routeToHash({ name: 'boards' })).toBe('#/');
    expect(routeToHash({ name: 'templates', age: '3-4' })).toBe('#/templates?age=3-4');
  });
});

describe('useHashRoute', () => {
  beforeEach(() => { location.hash = ''; });
  it('reads the initial hash and reacts to hashchange', () => {
    location.hash = '#/profile';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toEqual({ name: 'profile' });
    act(() => {
      location.hash = '#/groups';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toEqual({ name: 'groups' });
  });
  it('navigate sets location.hash', () => {
    navigate({ name: 'templates', age: '5-6' });
    expect(location.hash).toBe('#/templates?age=5-6');
  });
});

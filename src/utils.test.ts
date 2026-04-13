import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  formatReview,
  formatSafety,
  formatChecks,
  formatBranchStatus,
  relativeTime,
  formatAgeAgoFromMs,
} from './utils'

/* ── formatReview ── */
describe('formatReview', () => {
  it('formats approved', () => expect(formatReview('approved')).toBe('Approved'))
  it('formats changes_requested', () => expect(formatReview('changes_requested')).toBe('Changes requested'))
  it('formats commented', () => expect(formatReview('commented')).toBe('Commented'))
  it('formats not_run', () => expect(formatReview('not_run')).toBe('Not run'))
})

/* ── formatSafety ── */
describe('formatSafety', () => {
  it('formats safe', () => expect(formatSafety('safe')).toBe('Safe'))
  it('formats blocked', () => expect(formatSafety('blocked')).toBe('Blocked'))
  it('formats pending', () => expect(formatSafety('pending')).toBe('Pending'))
})

/* ── formatChecks ── */
describe('formatChecks', () => {
  it('formats passing', () => expect(formatChecks('passing')).toBe('Passing'))
  it('formats failing', () => expect(formatChecks('failing')).toBe('Failing'))
  it('formats pending', () => expect(formatChecks('pending')).toBe('Pending'))
})

/* ── formatBranchStatus ── */
describe('formatBranchStatus', () => {
  it('formats default', () => expect(formatBranchStatus('default')).toBe('Default'))
  it('formats active', () => expect(formatBranchStatus('active')).toBe('Active'))
  it('formats stale', () => expect(formatBranchStatus('stale')).toBe('Stale'))
  it('formats merged', () => expect(formatBranchStatus('merged')).toBe('Merged'))
})

/* ── relativeTime ── */
describe('relativeTime', () => {
  const NOW = new Date('2026-03-22T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for dates in the future', () => {
    const future = new Date(NOW + 5000).toISOString()
    expect(relativeTime(future)).toBe('just now')
  })

  it('returns "just now" for dates fewer than 5 seconds ago', () => {
    const recent = new Date(NOW - 4000).toISOString()
    expect(relativeTime(recent)).toBe('just now')
  })

  it('returns seconds ago for 30 seconds ago', () => {
    const date = new Date(NOW - 30_000).toISOString()
    expect(relativeTime(date)).toBe('30 seconds ago')
  })

  it('uses plural "seconds" for exactly 5 seconds ago', () => {
    const date = new Date(NOW - 5_000).toISOString()
    expect(relativeTime(date)).toBe('5 seconds ago')
  })

  it('returns minutes ago for 45 minutes ago', () => {
    const date = new Date(NOW - 45 * 60_000).toISOString()
    expect(relativeTime(date)).toBe('45 minutes ago')
  })

  it('uses singular "minute" for 1 minute ago', () => {
    const date = new Date(NOW - 60_000).toISOString()
    expect(relativeTime(date)).toBe('1 minute ago')
  })

  it('returns hours ago for 3 hours ago', () => {
    const date = new Date(NOW - 3 * 3600_000).toISOString()
    expect(relativeTime(date)).toBe('3 hours ago')
  })

  it('uses singular "hour" for 1 hour ago', () => {
    const date = new Date(NOW - 3600_000).toISOString()
    expect(relativeTime(date)).toBe('1 hour ago')
  })

  it('returns days ago for 10 days ago', () => {
    const date = new Date(NOW - 10 * 24 * 3600_000).toISOString()
    expect(relativeTime(date)).toBe('10 days ago')
  })

  it('uses singular "day" for 1 day ago', () => {
    const date = new Date(NOW - 24 * 3600_000).toISOString()
    expect(relativeTime(date)).toBe('1 day ago')
  })

  it('returns months ago for 2 months ago', () => {
    const date = new Date(NOW - 60 * 24 * 3600_000).toISOString()
    expect(relativeTime(date)).toBe('2 months ago')
  })

  it('uses singular "month" for 30 days ago', () => {
    const date = new Date(NOW - 30 * 24 * 3600_000).toISOString()
    expect(relativeTime(date)).toBe('1 month ago')
  })

  it('returns em-dash for invalid date string', () => {
    expect(relativeTime('not-a-date')).toBe('—')
  })

  it('returns em-dash for empty string', () => {
    expect(relativeTime('')).toBe('—')
  })
})

/* ── formatAgeAgoFromMs ── */
describe('formatAgeAgoFromMs', () => {
  const NOW = new Date('2026-03-22T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns em-dash for 0', () => {
    expect(formatAgeAgoFromMs(0)).toBe('—')
  })

  it('returns a relative string for a recent epoch', () => {
    const fiveMinutesAgo = NOW - 5 * 60_000
    expect(formatAgeAgoFromMs(fiveMinutesAgo)).toBe('5 minutes ago')
  })

  it('returns "just now" for a very recent epoch', () => {
    expect(formatAgeAgoFromMs(NOW - 2000)).toBe('just now')
  })
})

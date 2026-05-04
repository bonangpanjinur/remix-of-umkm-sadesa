import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { setLocale, getLocale } from '@/lib/i18n';

beforeEach(() => act(() => setLocale('id')));

describe('LanguageSwitcher (inline variant)', () => {
  it('shows both options and toggles locale', () => {
    render(<LanguageSwitcher variant="inline" />);
    const idBtn = screen.getByRole('button', { name: /Bahasa Indonesia/i });
    const enBtn = screen.getByRole('button', { name: /English/i });

    expect(idBtn).toHaveAttribute('aria-pressed', 'true');
    expect(enBtn).toHaveAttribute('aria-pressed', 'false');

    act(() => fireEvent.click(enBtn));
    expect(getLocale()).toBe('en');
    expect(screen.getByRole('button', { name: /English/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('LanguageSwitcher (icon variant)', () => {
  it('renders globe trigger with current locale badge', () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole('button', { name: /Ubah bahasa/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent?.toLowerCase()).toContain('id');

    act(() => setLocale('en'));
    expect(screen.getByRole('button', { name: /Change language/i }).textContent?.toLowerCase()).toContain('en');
  });
});

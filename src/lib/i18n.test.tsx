import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  formatCurrency,
  formatDate,
  formatTime,
  setLocale,
  useFormatters,
  useTranslation,
  translateOrderStatus,
} from './i18n';

function FormatterProbe() {
  const { formatCurrency: fc, formatTime: ft } = useFormatters();
  return (
    <div>
      <span data-testid="price">{fc(15000)}</span>
      <span data-testid="time">{ft('2026-05-04T08:30:00Z')}</span>
    </div>
  );
}

function StatusProbe({ status }: { status: string }) {
  const { tStatus } = useTranslation();
  return <span data-testid="status">{tStatus(status)}</span>;
}

describe('i18n formatters', () => {
  beforeEach(() => act(() => setLocale('id')));

  it('formats IDR with id-ID locale by default', () => {
    expect(formatCurrency(15000, 'id')).toMatch(/Rp/);
    expect(formatCurrency(15000, 'id')).toContain('15');
  });

  it('formats IDR with en-US locale grouping', () => {
    expect(formatCurrency(15000, 'en')).toContain('IDR');
    expect(formatCurrency(15000, 'en')).toContain('15,000');
  });

  it('formatDate respects locale', () => {
    const id = formatDate('2026-05-04T00:00:00Z', { dateStyle: 'long' }, 'id');
    const en = formatDate('2026-05-04T00:00:00Z', { dateStyle: 'long' }, 'en');
    expect(id).not.toEqual(en);
  });

  it('formatTime returns HH:MM-ish output', () => {
    expect(formatTime('2026-05-04T08:30:00Z', 'id')).toMatch(/\d{1,2}[:.]\d{2}/);
  });

  it('translateOrderStatus maps backend enums', () => {
    expect(translateOrderStatus('PICKED_UP', 'id')).toBe('Kurir Mengambil Pesanan');
    expect(translateOrderStatus('PICKED_UP', 'en')).toBe('Courier picked up order');
    expect(translateOrderStatus('UNKNOWN_STATUS', 'id')).toBe('UNKNOWN_STATUS');
  });
});

describe('useFormatters / useTranslation reactivity', () => {
  beforeEach(() => act(() => setLocale('id')));

  it('re-renders consumers when setLocale changes', () => {
    render(<FormatterProbe />);
    const priceId = screen.getByTestId('price').textContent ?? '';
    expect(priceId).toMatch(/Rp/);

    act(() => setLocale('en'));

    const priceEn = screen.getByTestId('price').textContent ?? '';
    expect(priceEn).toContain('IDR');
    expect(priceEn).not.toEqual(priceId);
  });

  it('tStatus updates on locale change', () => {
    const { rerender } = render(<StatusProbe status="DELIVERED" />);
    expect(screen.getByTestId('status').textContent).toBe('Pesanan Terkirim');

    act(() => setLocale('en'));
    rerender(<StatusProbe status="DELIVERED" />);
    expect(screen.getByTestId('status').textContent).toBe('Order delivered');
  });
});

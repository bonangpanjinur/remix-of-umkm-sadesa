import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DeliveryStatusCard } from './DeliveryStatusCard';
import { setLocale } from '@/lib/i18n';

const baseOrder = {
  status: 'PICKED_UP' as const,
  created_at: '2026-05-04T08:00:00Z',
  assigned_at: '2026-05-04T08:10:00Z',
  picked_up_at: '2026-05-04T08:20:00Z',
  delivered_at: null,
};

beforeEach(() => act(() => setLocale('id')));

describe('DeliveryStatusCard i18n', () => {
  it('renders Indonesian status by default', () => {
    render(<DeliveryStatusCard order={baseOrder} />);
    expect(screen.getByText(/Kurir Mengambil Pesanan/i)).toBeInTheDocument();
    expect(screen.getByText(/Pesanan Dibuat/i)).toBeInTheDocument();
  });

  it('immediately re-renders when setLocale switches to "en"', () => {
    render(<DeliveryStatusCard order={baseOrder} />);
    expect(screen.getByText(/Kurir Mengambil Pesanan/i)).toBeInTheDocument();

    act(() => setLocale('en'));

    expect(screen.getByText(/Courier picked up order/i)).toBeInTheDocument();
    expect(screen.getByText(/Order placed/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kurir Mengambil Pesanan/i)).not.toBeInTheDocument();
  });

  it('localizes ETA label when delivering', () => {
    render(
      <DeliveryStatusCard
        order={{ ...baseOrder, status: 'ON_DELIVERY' }}
      />,
    );
    expect(screen.getByText(/Estimasi tiba/i)).toBeInTheDocument();

    act(() => setLocale('en'));
    expect(screen.getByText(/ETA/)).toBeInTheDocument();
  });
});

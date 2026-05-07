/**
 * Regression guard: shipping/ongkir labels in CartPage MUST come from the i18n
 * dictionary (not hardcoded Indonesian). If a future UI refactor reverts to
 * literals like "Ongkos kirim" / "Total" / "Dihitung saat checkout", these
 * tests will fail because switching the locale to "en" must change the copy.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setLocale } from '@/lib/i18n';

// --- Mocks --------------------------------------------------------------
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

const cartItem = {
  product: {
    id: 'p1',
    name: 'Sambal Desa',
    price: 15000,
    image: 'https://example.com/x.jpg',
    stock: 99,
    merchantId: 'm1',
    merchantName: 'Toko Bu Ani',
  },
  quantity: 2,
};

vi.mock('@/contexts/CartContext', () => ({
  useCart: () => ({
    items: [cartItem],
    updateQuantity: vi.fn(),
    removeFromCart: vi.fn(),
    getCartTotal: () => 30000,
    clearCart: vi.fn(),
  }),
}));

// Import AFTER mocks
import CartPage from './CartPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>,
  );
}

beforeEach(() => act(() => setLocale('id')));

describe('CartPage shipping i18n (regression guard)', () => {
  it('renders Indonesian shipping summary labels by default', () => {
    renderPage();
    expect(screen.getByText('Ongkos kirim')).toBeInTheDocument();
    expect(screen.getByText('Dihitung saat checkout')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    // Currency uses id-ID locale → "Rp"
    expect(screen.getAllByText(/Rp/).length).toBeGreaterThan(0);
  });

  it('switches to English copy when setLocale("en") is called', () => {
    renderPage();
    act(() => setLocale('en'));

    // English labels appear
    expect(screen.getByText('Shipping fee')).toBeInTheDocument();
    expect(screen.getByText('Calculated at checkout')).toBeInTheDocument();
    // English currency formatting uses "IDR" prefix in en-US
    expect(screen.getByText(/IDR/)).toBeInTheDocument();

    // And the Indonesian variants are GONE — fails if a refactor hardcodes them
    expect(screen.queryByText('Ongkos kirim')).not.toBeInTheDocument();
    expect(screen.queryByText('Dihitung saat checkout')).not.toBeInTheDocument();
  });
});

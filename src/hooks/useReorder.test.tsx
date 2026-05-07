import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const { navigateMock, addToCartMock, toastMock, inMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  addToCartMock: vi.fn(),
  toastMock: vi.fn(),
  inMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('@/contexts/CartContext', () => ({ useCart: () => ({ addToCart: addToCartMock }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: toastMock }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ in: inMock }) }) },
}));

import { useReorder } from './useReorder';

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

beforeEach(() => {
  navigateMock.mockReset();
  addToCartMock.mockReset();
  toastMock.mockReset();
  inMock.mockReset();
});

describe('useReorder', () => {
  it('skips items with no product_id and warns', async () => {
    const { result } = renderHook(() => useReorder(), { wrapper });
    let res!: { added: number; skipped: number };
    await act(async () => {
      res = await result.current([{ quantity: 1 }]);
    });
    expect(res).toEqual({ added: 0, skipped: 0 });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Tidak ada produk/i) }),
    );
    expect(addToCartMock).not.toHaveBeenCalled();
  });

  it('adds available products to cart and navigates to /cart', async () => {
    inMock.mockResolvedValueOnce({
      data: [{
        id: 'p1', name: 'Sambal', description: 'd', price: 1000, stock: 10,
        is_active: true, image_url: null, category: 'food', merchant_id: 'm1',
        merchants: { id: 'm1', name: 'Toko', is_open: true, status: 'ACTIVE', registration_status: 'APPROVED' },
      }],
      error: null,
    });

    const { result } = renderHook(() => useReorder(), { wrapper });
    await act(async () => {
      await result.current([{ product_id: 'p1', quantity: 3 }]);
    });

    expect(addToCartMock).toHaveBeenCalledTimes(1);
    expect(addToCartMock.mock.calls[0][1]).toBe(3);
    expect(navigateMock).toHaveBeenCalledWith('/cart');
  });

  it('skips inactive merchants and reports them', async () => {
    inMock.mockResolvedValueOnce({
      data: [{
        id: 'p1', name: 'X', price: 1, stock: 5, is_active: true, merchant_id: 'm1',
        merchants: { id: 'm1', name: 'Toko', is_open: true, status: 'INACTIVE', registration_status: 'APPROVED' },
      }],
      error: null,
    });
    const { result } = renderHook(() => useReorder(), { wrapper });
    let res!: { added: number; skipped: number };
    await act(async () => {
      res = await result.current([{ product_id: 'p1', quantity: 1 }]);
    });
    expect(res.added).toBe(0);
    expect(res.skipped).toBe(1);
    expect(addToCartMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('caps quantity to current stock', async () => {
    inMock.mockResolvedValueOnce({
      data: [{
        id: 'p1', name: 'X', price: 1, stock: 2, is_active: true, merchant_id: 'm1',
        merchants: { id: 'm1', name: 'T', is_open: true, status: 'ACTIVE', registration_status: 'APPROVED' },
      }],
      error: null,
    });
    const { result } = renderHook(() => useReorder(), { wrapper });
    await act(async () => {
      await result.current([{ product_id: 'p1', quantity: 99 }]);
    });
    expect(addToCartMock.mock.calls[0][1]).toBe(2);
  });
});

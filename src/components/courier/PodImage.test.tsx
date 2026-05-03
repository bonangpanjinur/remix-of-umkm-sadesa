import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { PodImage } from './PodImage';
import { setLocale } from '@/lib/i18n';

vi.mock('@/lib/podImage', () => ({
  getPodImageSignedUrl: vi.fn(),
}));

import { getPodImageSignedUrl } from '@/lib/podImage';

const mocked = vi.mocked(getPodImageSignedUrl);

describe('PodImage', () => {
  beforeEach(() => {
    mocked.mockReset();
    setLocale('id');
  });

  it('shows "tidak tersedia" immediately when storedUrl is null', async () => {
    render(<PodImage storedUrl={null} className="w-10 h-10" />);
    expect(await screen.findByText(/Gambar tidak tersedia/i)).toBeInTheDocument();
  });

  it('shows skeleton while loading then "Gagal memuat" when signing returns null', async () => {
    let resolveFn: (v: string | null) => void = () => {};
    mocked.mockReturnValue(new Promise<string | null>((r) => { resolveFn = r; }));

    render(<PodImage storedUrl="https://x/pod-images/foo.jpg" className="w-10 h-10" />);
    expect(screen.getByLabelText(/Memuat gambar/i)).toBeInTheDocument();

    resolveFn(null);

    await waitFor(() => {
      expect(screen.getByText(/Gagal memuat, coba lagi/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Gambar tidak tersedia/i)).not.toBeInTheDocument();
  });

  it('shows "Gagal memuat" when getPodImageSignedUrl rejects, and retry re-invokes loader', async () => {
    mocked.mockRejectedValueOnce(new Error('network'));
    render(<PodImage storedUrl="https://x/pod-images/bar.jpg" className="w-10 h-10" />);

    await waitFor(() => {
      expect(screen.getByText(/Gagal memuat, coba lagi/i)).toBeInTheDocument();
    });
    expect(mocked).toHaveBeenCalledTimes(1);

    mocked.mockResolvedValueOnce('https://signed.example/bar.jpg');
    fireEvent.click(screen.getByRole('button', { name: /Muat ulang/i }));

    await waitFor(() => {
      expect(mocked).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByAltText(/Bukti Pengiriman/i)).toHaveAttribute(
      'src',
      'https://signed.example/bar.jpg',
    );
  });

  it('renders the img when a signed URL is returned', async () => {
    mocked.mockResolvedValue('https://signed.example/foo.jpg');
    render(<PodImage storedUrl="https://x/pod-images/foo.jpg" alt="Bukti" />);
    const img = await screen.findByAltText('Bukti');
    expect(img).toHaveAttribute('src', 'https://signed.example/foo.jpg');
  });
});

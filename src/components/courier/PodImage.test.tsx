import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PodImage } from './PodImage';

vi.mock('@/lib/podImage', () => ({
  getPodImageSignedUrl: vi.fn(),
}));

import { getPodImageSignedUrl } from '@/lib/podImage';

const mocked = vi.mocked(getPodImageSignedUrl);

describe('PodImage', () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it('shows fallback immediately when storedUrl is null', async () => {
    render(<PodImage storedUrl={null} className="w-10 h-10" />);
    expect(await screen.findByLabelText(/tidak tersedia/i)).toBeInTheDocument();
    expect(screen.getByText(/Gambar tidak tersedia/i)).toBeInTheDocument();
  });

  it('shows skeleton while loading then fallback when signing fails', async () => {
    let resolveFn: (v: string | null) => void = () => {};
    mocked.mockReturnValue(new Promise<string | null>((r) => { resolveFn = r; }));

    render(<PodImage storedUrl="https://x/pod-images/foo.jpg" className="w-10 h-10" />);

    expect(screen.getByLabelText(/Memuat gambar/i)).toBeInTheDocument();

    resolveFn(null);

    await waitFor(() => {
      expect(screen.getByText(/Gambar tidak tersedia/i)).toBeInTheDocument();
    });
  });

  it('shows fallback when getPodImageSignedUrl rejects', async () => {
    mocked.mockRejectedValue(new Error('network'));
    render(<PodImage storedUrl="https://x/pod-images/bar.jpg" className="w-10 h-10" />);
    await waitFor(() => {
      expect(screen.getByText(/Gambar tidak tersedia/i)).toBeInTheDocument();
    });
  });

  it('renders the img when a signed URL is returned', async () => {
    mocked.mockResolvedValue('https://signed.example/foo.jpg');
    render(<PodImage storedUrl="https://x/pod-images/foo.jpg" alt="Bukti" />);
    const img = await screen.findByAltText('Bukti');
    expect(img).toHaveAttribute('src', 'https://signed.example/foo.jpg');
  });
});

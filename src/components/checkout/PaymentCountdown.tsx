import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface PaymentCountdownProps {
  deadline: string;
}

export function PaymentCountdown({ deadline }: PaymentCountdownProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const end = new Date(deadline).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('00:00');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border mt-3 ${
      expired 
        ? 'bg-destructive/10 border-destructive/20 text-destructive' 
        : 'bg-warning/10 border-warning/20 text-warning'
    }`}>
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs font-medium">
          {expired ? 'Batas waktu pembayaran telah habis' : 'Batas waktu pembayaran'}
        </p>
      </div>
      <span className="font-mono font-bold text-lg">{timeLeft}</span>
    </div>
  );
}

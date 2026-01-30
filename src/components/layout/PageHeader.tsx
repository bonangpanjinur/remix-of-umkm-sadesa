import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function PageHeader({ title, showBack = false, onBack }: PageHeaderProps) {
  return (
    <header className="bg-card sticky top-0 z-40 shadow-md px-4 py-3">
      <div className="flex items-center gap-3">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="font-bold text-base text-foreground">{title}</h1>
      </div>
    </header>
  );
}

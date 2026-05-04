import { Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  /** "icon" → header globe button. "inline" → settings card row. */
  variant?: 'icon' | 'inline';
  className?: string;
}

const OPTIONS: Array<{ value: Locale; labelKey: 'settings.language.id' | 'settings.language.en' }> = [
  { value: 'id', labelKey: 'settings.language.id' },
  { value: 'en', labelKey: 'settings.language.en' },
];

export function LanguageSwitcher({ variant = 'icon', className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {OPTIONS.map((opt) => {
          const active = locale === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLocale(opt.value)}
              aria-pressed={active}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-secondary',
              )}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('common.language.switch')}
          className={cn(
            'relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition',
            className,
          )}
        >
          <Globe className="h-[18px] w-[18px] text-muted-foreground" />
          <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold uppercase text-primary">
            {locale}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => setLocale(opt.value)}>
            <span className="flex-1">{t(opt.labelKey)}</span>
            {locale === opt.value && <Check className="h-4 w-4 text-primary ml-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

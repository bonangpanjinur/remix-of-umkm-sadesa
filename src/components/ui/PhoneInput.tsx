import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatIndonesianPhone, normalizePhone, getPhoneValidationError } from '@/lib/phoneValidation';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, error: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  onValidationChange,
  placeholder = 'Nomor telepon',
  disabled,
  className,
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Format the value when not focused
    if (!isFocused && value) {
      setDisplayValue(formatIndonesianPhone(value));
    } else {
      setDisplayValue(value);
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Only allow digits, dashes, plus, spaces
    const filtered = input.replace(/[^\d\-+\s]/g, '');
    
    // Normalize and update
    const normalized = normalizePhone(filtered);
    onChange(normalized);
    setDisplayValue(filtered);

    // Validate
    const validationError = getPhoneValidationError(normalized);
    setError(validationError);
    onValidationChange?.(!validationError, validationError);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format on blur
    if (value) {
      setDisplayValue(formatIndonesianPhone(value));
    }
    // Final validation
    const validationError = getPhoneValidationError(value);
    setError(validationError);
    onValidationChange?.(!validationError, validationError);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw value on focus for easier editing
    setDisplayValue(value);
  };

  return (
    <div className="space-y-1">
      <Input
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

import { Check, X } from 'lucide-react';

export function BooleanIcon({ value }: { value: boolean }) {
  return (
    <span
      aria-label={value ? 'Yes' : 'No'}
      className={value ? 'boolean-icon boolean-icon--true' : 'boolean-icon boolean-icon--false'}
      title={value ? 'Yes' : 'No'}
    >
      {value ? <Check size={16} strokeWidth={2.4} /> : <X size={16} strokeWidth={2.4} />}
    </span>
  );
}

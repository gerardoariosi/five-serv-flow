import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

const Spinner = ({ className, size = 'md' }: SpinnerProps) => (
  <div
    className={cn(
      'rounded-full animate-spin-gold spinner-gold',
      sizes[size],
      className
    )}
  />
);

export default Spinner;

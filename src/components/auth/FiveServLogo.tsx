interface FiveServLogoProps {
  variant?: 'dark' | 'light';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const FiveServLogo = ({ variant = 'dark', className = '', size = 'md' }: FiveServLogoProps) => {
  const wordmarkColor = variant === 'light' ? '#1A1A1A' : '#FFFFFF';
  const sizeClasses = {
    sm: 'text-[1.4rem]',
    md: 'text-[1.8rem]',
    lg: 'text-[2.6rem]',
  };
  const taglineSizes = {
    sm: 'text-[0.55rem]',
    md: 'text-[0.6rem]',
    lg: 'text-[0.75rem]',
  };
  return (
    <div className={`text-center mb-6 ${className}`}>
      <span
        className={`font-serif font-bold tracking-tight ${sizeClasses[size]}`}
        style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.01em' }}
      >
        <span style={{ color: '#FFD700' }}>F</span>
        <span style={{ color: wordmarkColor }}>iveServ</span>
      </span>
      <div
        className={`font-sans font-semibold tracking-[0.18em] mt-1.5 ${taglineSizes[size]}`}
        style={{ color: '#FFD700' }}
      >
        ONE TEAM. ONE CALL. DONE.
      </div>
    </div>
  );
};

export default FiveServLogo;

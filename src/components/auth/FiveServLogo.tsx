interface FiveServLogoProps {
  variant?: 'dark' | 'light';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const sizeMap = {
  sm: { wordmark: '1.2rem', tagline: '0.5rem', spacing: '4px' },
  md: { wordmark: '1.8rem', tagline: '0.6rem', spacing: '6px' },
  lg: { wordmark: '2.6rem', tagline: '0.7rem', spacing: '8px' },
};

const FiveServLogo = ({
  variant = 'dark',
  className = '',
  size = 'md',
  showTagline = true,
}: FiveServLogoProps) => {
  const wordmarkColor = variant === 'light' ? '#1A1A1A' : '#FFFFFF';
  const s = sizeMap[size];

  return (
    <div className={className} style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontWeight: 'bold',
          letterSpacing: '-0.01em',
          fontSize: s.wordmark,
          lineHeight: 1,
        }}
      >
        <span style={{ color: '#FFD700' }}>F</span>
        <span style={{ color: wordmarkColor }}>iveServ</span>
      </div>
      {showTagline && (
        <div
          style={{
            color: '#FFD700',
            fontSize: s.tagline,
            letterSpacing: '0.18em',
            marginTop: s.spacing,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 600,
          }}
        >
          ONE TEAM. ONE CALL. DONE.
        </div>
      )}
    </div>

  );
};

export default FiveServLogo;

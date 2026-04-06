interface PasswordCheckProps {
  password: string;
  confirmPassword: string;
}

const checks = [
  { label: 'Min 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
];

export const passwordIsValid = (password: string, confirmPassword: string) =>
  checks.every((c) => c.test(password)) && password === confirmPassword && password.length > 0;

const PasswordStrength = ({ password, confirmPassword }: PasswordCheckProps) => {
  return (
    <div className="space-y-1.5">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-2 text-xs">
          <span className={c.test(password) ? 'text-primary' : 'text-muted-foreground'}>
            {c.test(password) ? '✓' : '○'}
          </span>
          <span className={c.test(password) ? 'text-foreground' : 'text-muted-foreground'}>
            {c.label}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 text-xs">
        <span className={password && password === confirmPassword ? 'text-primary' : 'text-muted-foreground'}>
          {password && password === confirmPassword ? '✓' : '○'}
        </span>
        <span className={password && password === confirmPassword ? 'text-foreground' : 'text-muted-foreground'}>
          Passwords match
        </span>
      </div>
    </div>
  );
};

export default PasswordStrength;

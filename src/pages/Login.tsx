import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import FiveServLogo from '@/components/auth/FiveServLogo';
import { toast } from 'sonner';
import Spinner from '@/components/ui/Spinner';

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem('fiveserv-last-email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isFirstAccess] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFirstAccess && !acceptedTerms) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }

    setLoading(true);
    setError('');

    const result = await signIn(email, password);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      toast.error(result.error.message);
      return;
    }

    const user = result.user;
    if (!user) {
      setError('Unable to fetch user profile.');
      setLoading(false);
      return;
    }

    // Persist remember-me preference
    if (rememberMe) {
      localStorage.setItem('fiveserv-remember-me', '1');
    } else {
      localStorage.removeItem('fiveserv-remember-me');
      // Mark this tab as having an active session (lost on tab close)
      sessionStorage.setItem('fiveserv-session-active', '1');
    }

    // Admin goes to 2FA
    if (user.roles.includes('admin')) {
      navigate('/verify-2fa', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle gold glow background */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 600px 400px at 50% 25%, rgba(255,215,0,0.08), transparent 70%)',
        }}
      />

      <div className="w-full max-w-md relative">
        <div className="relative">
          {/* Gold glow behind logo */}
          <div
            aria-hidden
            className="absolute inset-x-0 -top-4 h-32 pointer-events-none"
            style={{ background: 'radial-gradient(circle at center, rgba(255,215,0,0.15), transparent 60%)' }}
          />
          <FiveServLogo />
        </div>

        <div className="bg-card border border-border/50 rounded-[0.625rem] p-8 shadow-[var(--card-shadow)]">
          <h2 className="text-lg font-bold text-foreground mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="you@company.com"
                required
                className="bg-secondary border-border text-foreground focus-visible:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-secondary border-border text-foreground pr-10 focus-visible:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c === true)} />
              <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                Remember Me
              </Label>
            </div>

            {isFirstAccess && (
              <div className="flex items-start gap-2">
                <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(c) => setAcceptedTerms(c === true)} />
                <Label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                  I accept the{' '}
                  <span className="text-primary underline">Terms of Service</span> and{' '}
                  <span className="text-primary underline">Privacy Policy</span>
                </Label>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold active:scale-95 transition-transform"
            >
              {loading ? <Spinner size="sm" /> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot Password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

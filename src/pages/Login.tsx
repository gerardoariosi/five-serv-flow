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
import { isDeviceTrusted } from '@/lib/trustedDevice';

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
    if (rememberMe) {
      localStorage.setItem('fiveserv-remember-me', '1');
    } else {
      localStorage.removeItem('fiveserv-remember-me');
      sessionStorage.setItem('fiveserv-session-active', '1');
    }
    if (user.roles.includes('admin') && !isDeviceTrusted(user.id)) {
      navigate('/verify-2fa', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FDFDFB] font-sans">
      {/* Left: Human brand panel */}
      <div className="hidden lg:flex lg:w-[46%] bg-[#1A1A1A] p-14 xl:p-20 flex-col justify-between relative overflow-hidden">
        {/* Warm ambient glow */}
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[#FFD700] opacity-[0.07] blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-20 w-[420px] h-[420px] rounded-full bg-[#FFD700] opacity-[0.05] blur-[140px] pointer-events-none" />

        {/* Top: Logo */}
        <div className="relative z-10">
          <div className="flex items-baseline">
            <span className="text-[#FFD700]" style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '2.6rem', letterSpacing: '-0.01em' }}>F</span>
            <span className="text-white" style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '2.6rem', letterSpacing: '-0.01em' }}>iveServ</span>
          </div>
          <div className="text-[#FFD700] text-[11px] font-semibold tracking-[0.22em] mt-2">
            ONE TEAM. ONE CALL. DONE.
          </div>
        </div>

        {/* Middle: Human message */}
        <div className="relative z-10 max-w-md">
          <div className="h-px w-12 bg-[#FFD700] mb-8" />
          <p className="text-white text-[1.75rem] leading-[1.25] font-light tracking-tight">
            Built by people who <span className="text-[#FFD700] font-normal italic" style={{ fontFamily: 'Georgia, serif' }}>answered the call</span> — for the people who still do.
          </p>
          <p className="text-white/50 text-sm mt-6 leading-relaxed">
            FiveServ runs on late nights, early mornings, and the trust our franchise partners place in every service call.
          </p>
        </div>

        {/* Bottom: Signature */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FFD700] to-[#B8860B] flex items-center justify-center text-[#1A1A1A] font-bold text-sm">
            GR
          </div>
          <div>
            <div className="text-white text-sm font-medium">Gerardo Rios</div>
            <div className="text-white/40 text-xs">Founder · FiveServ Family</div>
          </div>
        </div>
      </div>

      {/* Right: Sign-in form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-[#FDFDFB]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <FiveServLogo variant="light" />
          </div>

          <div className="mb-9">
            <h1 className="text-[1.6rem] font-bold text-[#1A1A1A] tracking-tight">Welcome back</h1>
            <p className="text-sm text-[#6B6B6B] mt-1.5">Sign in to your FiveServ workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B]">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="name@company.com"
                required
                className="h-11 bg-white border-[#E5E3DE] text-[#1A1A1A] placeholder:text-[#BBB] rounded-lg focus-visible:border-[#FFD700] focus-visible:ring-1 focus-visible:ring-[#FFD700]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B]">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-[#1A1A1A] hover:text-[#B8860B] transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 bg-white border-[#E5E3DE] text-[#1A1A1A] placeholder:text-[#BBB] rounded-lg pr-10 focus-visible:border-[#FFD700] focus-visible:ring-1 focus-visible:ring-[#FFD700]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1A1A1A] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(c) => setRememberMe(c === true)}
                className="border-[#D5D5D5] data-[state=checked]:bg-[#FFD700] data-[state=checked]:border-[#FFD700] data-[state=checked]:text-[#1A1A1A]"
              />
              <Label htmlFor="remember" className="text-sm text-[#6B6B6B] cursor-pointer">
                Keep me signed in
              </Label>
            </div>

            {isFirstAccess && (
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(c === true)}
                  className="mt-0.5 border-[#D5D5D5] data-[state=checked]:bg-[#FFD700] data-[state=checked]:border-[#FFD700] data-[state=checked]:text-[#1A1A1A]"
                />
                <Label htmlFor="terms" className="text-xs text-[#6B6B6B] cursor-pointer leading-relaxed">
                  I accept the{' '}
                  <span className="text-[#1A1A1A] font-semibold underline decoration-[#FFD700] underline-offset-2">Terms of Service</span>{' '}
                  and{' '}
                  <span className="text-[#1A1A1A] font-semibold underline decoration-[#FFD700] underline-offset-2">Privacy Policy</span>
                </Label>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-lg shadow-[0_4px_20px_rgba(26,26,26,0.15)] active:scale-[0.98] transition-all mt-2"
            >
              {loading ? <Spinner size="sm" /> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-10 pt-6 border-t border-[#EEEBE4] text-center">
            <p className="text-xs text-[#8A8A8A]">
              Need help?{' '}
              <Link to="/help" className="text-[#1A1A1A] font-semibold hover:text-[#B8860B] transition-colors">
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

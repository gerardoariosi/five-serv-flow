import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF9F6] p-4 md:p-8 font-sans">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-xl shadow-[#1A1A1A]/5 flex flex-col md:flex-row-reverse overflow-hidden border border-[#E5E5E1]">
        {/* Right (visually): Branding & Trust */}
        <div className="hidden md:flex md:w-5/12 bg-[#F3F2EE] p-8 lg:p-14 flex-col justify-between relative overflow-hidden">
          {/* Subtle gold dot pattern */}
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#FFD700 0.5px, transparent 0.5px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10">
            {/* Exact current FiveServ logo */}
            <div className="mb-12">
              <div className="flex items-baseline">
                <span
                  className="text-[#FFD700]"
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontWeight: 'bold',
                    fontSize: '2.6rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  F
                </span>
                <span
                  className="text-[#1A1A1A]"
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontWeight: 'bold',
                    fontSize: '2.6rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  iveServ
                </span>
              </div>
              <div className="text-[#FFD700] text-[11px] font-semibold tracking-[0.22em] mt-2">
                ONE TEAM. ONE CALL. DONE.
              </div>
            </div>

            <h2
              className="text-3xl lg:text-5xl font-semibold text-[#1A1A1A] leading-tight mb-6"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Run your properties without the chaos.
            </h2>
            <p className="text-base lg:text-lg text-[#1A1A1A]/70 leading-relaxed max-w-sm">
              Schedule inspections, dispatch technicians, track work orders, and keep owners informed — all in one place.
            </p>
          </div>

          <div className="relative z-10 mt-12 pt-12 border-t border-[#1A1A1A]/10">
            <div className="flex flex-wrap gap-2">
              {['Work orders', 'Inspections', 'Vendors', 'Accounting'].map((mod) => (
                <span
                  key={mod}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide text-[#1A1A1A]/70 bg-white/60 border border-[#1A1A1A]/5"
                >
                  <span className="w-1 h-1 rounded-full bg-[#FFD700] mr-1.5" />
                  {mod}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Sign-in form */}
        <div className="w-full md:w-7/12 p-8 sm:p-10 md:p-14 bg-white">
          <div className="max-w-md mx-auto">
            {/* Mobile logo */}
            <div className="md:hidden mb-10 text-center">
              <div className="flex items-baseline justify-center">
                <span
                  className="text-[#FFD700]"
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontWeight: 'bold',
                    fontSize: '2.2rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  F
                </span>
                <span
                  className="text-[#1A1A1A]"
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontWeight: 'bold',
                    fontSize: '2.2rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  iveServ
                </span>
              </div>
              <div className="text-[#FFD700] text-[10px] font-semibold tracking-[0.2em] mt-1">
                ONE TEAM. ONE CALL. DONE.
              </div>
            </div>

            <div className="mb-10">
              <h1 className="text-[1.75rem] font-semibold text-[#1A1A1A] tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-[#6B6B6B] mt-1.5">
                Enter your credentials to access your dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B]"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="name@franchise.com"
                  required
                  className="h-12 bg-white border-[#E5E3DE] text-[#1A1A1A] placeholder:text-[#BBB] rounded-xl focus-visible:border-[#FFD700] focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B]"
                  >
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-semibold text-[#6B6B6B] hover:text-[#1A1A1A] underline decoration-[#FFD700] underline-offset-4 transition-colors"
                  >
                    Forgot password?
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
                    className="h-12 bg-white border-[#E5E3DE] text-[#1A1A1A] placeholder:text-[#BBB] rounded-xl pr-10 focus-visible:border-[#FFD700] focus-visible:ring-2 focus-visible:ring-[#FFD700]"
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

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(c === true)}
                    className="mt-0.5 border-[#D5D5D5] data-[state=checked]:bg-[#1A1A1A] data-[state=checked]:border-[#1A1A1A] data-[state=checked]:text-white"
                  />
                  <Label htmlFor="remember" className="text-sm text-[#6B6B6B] cursor-pointer leading-tight">
                    Remember this device for 30 days
                  </Label>
                </div>

                {isFirstAccess && (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(c) => setAcceptedTerms(c === true)}
                      className="mt-0.5 border-[#D5D5D5] data-[state=checked]:bg-[#1A1A1A] data-[state=checked]:border-[#1A1A1A] data-[state=checked]:text-white"
                    />
                    <Label htmlFor="terms" className="text-xs text-[#6B6B6B] cursor-pointer leading-relaxed">
                      I accept the{' '}
                      <span className="text-[#1A1A1A] font-semibold underline decoration-[#FFD700] underline-offset-2">
                        Terms of Service
                      </span>{' '}
                      and{' '}
                      <span className="text-[#1A1A1A] font-semibold underline decoration-[#FFD700] underline-offset-2">
                        Privacy Policy
                      </span>
                    </Label>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white font-semibold rounded-xl shadow-lg shadow-[#1A1A1A]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <span>Sign in to Dashboard</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-10 pt-6 border-t border-[#EEEBE4] text-center">
              <p className="text-sm text-[#8A8A8A]">
                Need assistance?{' '}
                <Link
                  to="/help"
                  className="text-[#1A1A1A] font-semibold hover:text-[#B8860B] transition-colors"
                >
                  Contact Support
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

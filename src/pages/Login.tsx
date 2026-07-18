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
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          <div className="mb-8">
            <FiveServLogo variant="light" />
            <div className="text-center mt-6">
              <h1 className="text-xl font-bold text-[#1A1A1A]">Sign in to your account</h1>
              <p className="text-sm text-[#666] mt-1.5">Welcome back to the operations portal</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]"
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="name@company.com"
                required
                className="h-11 bg-[#FAFAFA] border-[#E5E5E5] text-[#1A1A1A] placeholder:text-[#BBB] rounded-lg focus-visible:border-[#FFD700] focus-visible:ring-1 focus-visible:ring-[#FFD700]"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 bg-[#FAFAFA] border-[#E5E5E5] text-[#1A1A1A] placeholder:text-[#BBB] rounded-lg pr-10 focus-visible:border-[#FFD700] focus-visible:ring-1 focus-visible:ring-[#FFD700]"
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

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(c) => setRememberMe(c === true)}
                  className="border-[#D5D5D5] data-[state=checked]:bg-[#FFD700] data-[state=checked]:border-[#FFD700] data-[state=checked]:text-[#1A1A1A]"
                />
                <Label htmlFor="remember" className="text-sm text-[#666] cursor-pointer">
                  Remember me
                </Label>
              </div>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#1A1A1A] hover:text-[#B8860B] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {isFirstAccess && (
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(c === true)}
                  className="mt-0.5 border-[#D5D5D5] data-[state=checked]:bg-[#FFD700] data-[state=checked]:border-[#FFD700] data-[state=checked]:text-[#1A1A1A]"
                />
                <Label htmlFor="terms" className="text-xs text-[#666] cursor-pointer leading-relaxed">
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
              className="w-full h-11 bg-[#1A1A1A] hover:bg-black text-white font-bold rounded-lg shadow-[0_4px_20px_rgba(26,26,26,0.15)] active:scale-[0.98] transition-all"
            >
              {loading ? <Spinner size="sm" /> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#EEEEEE] text-center">
            <p className="text-sm text-[#666]">
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

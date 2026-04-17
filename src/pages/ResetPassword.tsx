import { useState, useEffect } from 'react';
import FiveServLogo from '@/components/auth/FiveServLogo';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import PasswordStrength, { passwordIsValid } from '@/components/auth/PasswordStrength';
import Spinner from '@/components/ui/Spinner';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=invite')) {
      setTokenValid(true);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setTokenValid(!!session);
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordIsValid(password, confirmPassword)) return;

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Sign out to close all sessions
    await supabase.auth.signOut({ scope: 'global' });
    toast.success('Password reset successfully. Please sign in.');
    navigate('/login', { replace: true });
  };

  if (tokenValid === null) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6 text-center">
          <FiveServLogo />
          <h2 className="text-lg font-bold text-foreground mb-2">Link Expired</h2>
          <p className="text-sm text-muted-foreground mb-4">This reset link has expired.</p>
          <Link to="/forgot-password">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              Request New Link
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <FiveServLogo />

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">Set Your Password</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm text-muted-foreground">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-secondary border-border text-foreground pr-10"
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

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <PasswordStrength password={password} confirmPassword={confirmPassword} />

            <Button
              type="submit"
              disabled={!passwordIsValid(password, confirmPassword) || loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              {loading ? <Spinner size="sm" /> : 'Reset Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

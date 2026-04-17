import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import FiveServLogo from '@/components/auth/FiveServLogo';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await resetPassword(email.toLowerCase());
    } catch {
      // Silently handle — never reveal if email exists
    }
    setSent(true);
    setCooldown(60);
    setLoading(false);
    toast.success('If this email is registered, you will receive a reset link shortly.');
  };

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <FiveServLogo />

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-bold text-foreground mb-2">Forgot Password</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your email and we'll send you a reset link.
          </p>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If this email is registered, you will receive a reset link shortly.
              </p>
              <Button
                onClick={() => { setSent(false); setEmail(''); }}
                disabled={cooldown > 0}
                variant="outline"
                className="w-full border-border text-foreground"
              >
                {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Send Again'}
              </Button>
            </div>
          ) : (
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
                  className="bg-secondary border-border text-foreground"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || cooldown > 0}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                {cooldown > 0 ? `Wait ${cooldown}s` : 'Send Reset Link'}
              </Button>
            </form>
          )}

          <div className="mt-4">
            <Link to="/login" className="flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

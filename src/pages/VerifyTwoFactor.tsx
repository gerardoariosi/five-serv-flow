import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FiveServLogo from '@/components/auth/FiveServLogo';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import Spinner from '@/components/ui/Spinner';

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
};

const VerifyTwoFactor = () => {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(60);
  const [sending, setSending] = useState(true);
  const [maskedEmail, setMaskedEmail] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Send code on mount
  useEffect(() => {
    sendCode();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-2fa-code', {
        body: {},
      });

      if (error) {
        toast.error('Failed to send verification code. Please try again.');
      } else {
        if (data?.email) {
          setMaskedEmail(maskEmail(data.email));
        }
        toast.success('Verification code sent to your email.');
      }
    } catch {
      toast.error('Connection error. Please try again.');
    }
    setSending(false);
    setCooldown(60);
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    // Auto-focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newDigits.every((d) => d) && newDigits.join('').length === 6) {
      verifyCode(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      verifyCode(pasted);
    }
  };

  const verifyCode = async (code: string) => {
    if (attempts >= 3) {
      toast.error('Account locked. Contact your administrator.');
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: { code },
      });

      if (error || !data?.success) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();

        if (data?.locked || newAttempts >= 3) {
          toast.error('Account locked due to too many failed attempts. Contact your administrator.');
          setTimeout(() => navigate('/login', { replace: true }), 1500);
        } else {
          toast.error(`Invalid code. ${3 - newAttempts} attempt(s) remaining.`);
        }
      } else {
        toast.success('Verified successfully!');
        navigate('/dashboard', { replace: true });
      }
    } catch {
      toast.error('Connection error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <FiveServLogo />
        <div className="bg-card border border-border rounded-lg p-6 text-center">

          <h2 className="text-lg font-bold text-foreground mb-2">Two-Factor Authentication</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Enter the 6-digit code sent to{' '}
            {maskedEmail ? (
              <span className="text-foreground font-medium">{maskedEmail}</span>
            ) : (
              'your email'
            )}
          </p>

          {/* Digit inputs */}
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-11 h-14 text-center text-xl font-bold bg-secondary border border-border rounded-md text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
            ))}
          </div>

          {loading && (
            <div className="flex justify-center mb-4">
              <Spinner size="sm" />
            </div>
          )}

          {/* Resend */}
          <Button
            variant="ghost"
            onClick={sendCode}
            disabled={cooldown > 0 || sending}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerifyTwoFactor;

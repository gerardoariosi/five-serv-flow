import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import SetupProgress from '@/components/setup/SetupProgress';
import FiveServLogo from '@/components/auth/FiveServLogo';
import PasswordStrength, { passwordIsValid } from '@/components/auth/PasswordStrength';
import { useSetupStore } from '@/stores/setupStore';

const SetupStep1 = () => {
  const navigate = useNavigate();
  const { data, updateData } = useSetupStore();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!data.fullName.trim()) errs.fullName = 'Full name is required';
    if (!data.email.trim()) errs.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = 'Invalid email';
    if (!passwordIsValid(data.password, data.confirmPassword)) {
      errs.password = 'Password does not meet requirements';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      navigate('/setup/step-2');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <FiveServLogo />
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-foreground">Initial Setup</h1>
        </div>

        <SetupProgress currentStep={1} />

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-base font-bold text-foreground mb-4">Admin Account</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Full Name</Label>
              <Input
                value={data.fullName}
                onChange={(e) => updateData({ fullName: e.target.value })}
                placeholder="John Smith"
                className="bg-secondary border-border text-foreground"
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => updateData({ email: e.target.value.toLowerCase() })}
                placeholder="admin@company.com"
                className="bg-secondary border-border text-foreground"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={data.password}
                  onChange={(e) => updateData({ password: e.target.value })}
                  placeholder="••••••••"
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
              <Label className="text-sm text-muted-foreground">Confirm Password</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={data.confirmPassword}
                onChange={(e) => updateData({ confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <PasswordStrength password={data.password} confirmPassword={data.confirmPassword} />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}

            <Button
              onClick={handleNext}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              Next →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupStep1;

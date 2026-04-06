import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SetupProgress from '@/components/setup/SetupProgress';
import { useSetupStore } from '@/stores/setupStore';

const SetupStep2 = () => {
  const navigate = useNavigate();
  const { data, updateData } = useSetupStore();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!data.companyName.trim()) errs.companyName = 'Company name is required';
    if (!data.contactEmail.trim()) errs.contactEmail = 'Contact email is required';
    if (!data.phone.trim()) errs.phone = 'Phone number is required';
    if (!data.city.trim()) errs.city = 'City is required';
    if (!data.physicalAddress.trim()) errs.physicalAddress = 'Address is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      navigate('/setup/step-3');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-5xl font-extrabold text-primary">FS</span>
          <h1 className="text-lg font-bold text-foreground mt-2">Company Information</h1>
        </div>

        <SetupProgress currentStep={2} />

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-base font-bold text-foreground mb-4">Company Details</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Company Name</Label>
              <Input
                value={data.companyName}
                onChange={(e) => updateData({ companyName: e.target.value })}
                placeholder="FiveServ LLC"
                className="bg-secondary border-border text-foreground"
              />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Contact Email</Label>
              <Input
                type="email"
                value={data.contactEmail}
                onChange={(e) => updateData({ contactEmail: e.target.value.toLowerCase() })}
                placeholder="contact@company.com"
                className="bg-secondary border-border text-foreground"
              />
              {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Phone</Label>
              <Input
                type="tel"
                value={data.phone}
                onChange={(e) => updateData({ phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="bg-secondary border-border text-foreground"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">City</Label>
              <Input
                value={data.city}
                onChange={(e) => updateData({ city: e.target.value })}
                placeholder="Miami"
                className="bg-secondary border-border text-foreground"
              />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Physical Address</Label>
              <Textarea
                value={data.physicalAddress}
                onChange={(e) => updateData({ physicalAddress: e.target.value })}
                placeholder="123 Main St, Suite 100"
                className="bg-secondary border-border text-foreground"
                rows={2}
              />
              {errors.physicalAddress && <p className="text-xs text-destructive">{errors.physicalAddress}</p>}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/setup/step-1')}
                className="flex-1 border-border text-foreground"
              >
                ← Back
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                Next →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupStep2;

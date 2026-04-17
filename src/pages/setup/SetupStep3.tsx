import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSetupStore } from '@/stores/setupStore';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import SetupProgress from '@/components/setup/SetupProgress';
import FiveServLogo from '@/components/auth/FiveServLogo';
import Spinner from '@/components/ui/Spinner';

const SetupStep3 = () => {
  const navigate = useNavigate();
  const { data, reset } = useSetupStore();
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleLaunch = async () => {
    setLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        toast.error(authError.message);
        setLoading(false);
        return;
      }

      const authUserId = authData.user?.id;
      if (!authUserId) {
        toast.error('Failed to create account.');
        setLoading(false);
        return;
      }

      // 2. Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authUserId,
          full_name: data.fullName,
          email: data.email,
          roles: ['admin'],
          last_active_at: new Date().toISOString(),
        });

      if (userError) {
        toast.error('Failed to create user profile: ' + userError.message);
        setLoading(false);
        return;
      }

      // 3. Assign admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authUserId,
          role: 'admin' as any,
        });

      if (roleError) {
        toast.error('Failed to assign admin role: ' + roleError.message);
        setLoading(false);
        return;
      }

      // 4. Create company profile
      const { error: companyError } = await supabase
        .from('company_profile')
        .insert({
          company_name: data.companyName,
          contact_email: data.contactEmail,
          phone: data.phone,
          city: data.city,
          physical_address: data.physicalAddress,
          setup_completed: true,
        });

      if (companyError) {
        toast.error('Failed to create company profile: ' + companyError.message);
        setLoading(false);
        return;
      }

      // 5. Sign in
      await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      // 6. Update store
      setUser({
        id: authUserId,
        full_name: data.fullName,
        email: data.email,
        roles: ['admin'] as AppRole[],
      });

      reset();
      toast.success('FiveServ Operations is ready!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error('Connection error. Please try again.');
    }

    setLoading(false);
  };

  const ReviewRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-medium">{value || '—'}</span>
    </div>
  );

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <FiveServLogo />
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-foreground">Review & Launch</h1>
        </div>

        <SetupProgress currentStep={3} />

        {/* Admin Info */}
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">Admin Account</h2>
            <Link to="/setup/step-1" className="text-primary hover:text-primary/80">
              <Pencil className="w-4 h-4" />
            </Link>
          </div>
          <ReviewRow label="Full Name" value={data.fullName} />
          <ReviewRow label="Email" value={data.email} />
          <ReviewRow label="Password" value="••••••••" />
        </div>

        {/* Company Info */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">Company</h2>
            <Link to="/setup/step-2" className="text-primary hover:text-primary/80">
              <Pencil className="w-4 h-4" />
            </Link>
          </div>
          <ReviewRow label="Company Name" value={data.companyName} />
          <ReviewRow label="Contact Email" value={data.contactEmail} />
          <ReviewRow label="Phone" value={data.phone} />
          <ReviewRow label="City" value={data.city} />
          <ReviewRow label="Address" value={data.physicalAddress} />
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/setup/step-2')}
            className="flex-1 border-border text-foreground"
          >
            ← Back
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={loading}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            {loading ? <Spinner size="sm" /> : '🚀 Launch FiveServ'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupStep3;

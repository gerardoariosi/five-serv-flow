import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Mail, Check, AlertTriangle } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'done' | 'error'>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
          headers: { apikey: anonKey },
        });
        const data = await res.json();
        if (data.valid === false && data.reason === 'already_unsubscribed') setStatus('already');
        else if (data.valid) setStatus('valid');
        else setStatus('invalid');
      } catch { setStatus('error'); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
      if (error) throw error;
      setStatus('done');
    } catch { setStatus('error'); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'loading' && <Spinner size="lg" />}
        {status === 'valid' && (
          <>
            <Mail className="w-16 h-16 text-primary mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Unsubscribe</h1>
            <p className="text-sm text-muted-foreground">Click below to unsubscribe from FiveServ notification emails.</p>
            <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
              {processing ? <Spinner size="sm" /> : 'Confirm Unsubscribe'}
            </Button>
          </>
        )}
        {status === 'done' && (
          <>
            <Check className="w-16 h-16 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Unsubscribed</h1>
            <p className="text-sm text-muted-foreground">You have been successfully unsubscribed.</p>
          </>
        )}
        {status === 'already' && (
          <>
            <Check className="w-16 h-16 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Already Unsubscribed</h1>
            <p className="text-sm text-muted-foreground">This email address has already been unsubscribed.</p>
          </>
        )}
        {(status === 'invalid' || status === 'error') && (
          <>
            <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Invalid Link</h1>
            <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or expired.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;

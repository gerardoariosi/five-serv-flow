import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';

const ProofLink = ({ path }: { path: string }) => {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage
      .from('vendor-documents')
      .createSignedUrl(path, 60);
    setLoading(false);
    if (error || !data?.signedUrl) { toast.error(error?.message || 'Could not open proof'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
    >
      <Paperclip className="w-3 h-3" /> {loading ? 'Opening…' : 'View proof'}
    </button>
  );
};

export default ProofLink;

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { isPushSupported, requestAndSubscribe } from '@/lib/pushNotifications';
import { toast } from 'sonner';

const DISMISS_KEY = 'fiveserv-push-prompt-dismissed';

const EnablePushPrompt = () => {
  const user = useAuthStore((s) => s.user);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || !isPushSupported()) return;
    if (Notification.permission === 'denied') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    let cancelled = false;
    const check = async () => {
      // Show if permission is default (never asked) OR if granted but no subscription saved yet
      let shouldShow = Notification.permission === 'default';
      if (!shouldShow && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          shouldShow = !sub;
        } catch {
          shouldShow = false;
        }
      }
      if (!cancelled && shouldShow) {
        setTimeout(() => !cancelled && setVisible(true), 1000);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!visible || !user) return null;

  const handleEnable = async () => {
    const result = await requestAndSubscribe(user.id);
    if (result === 'granted') {
      toast.success('Notifications enabled');
      setVisible(false);
    } else {
      toast.error('Notifications blocked');
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%]">
      <div className="bg-card border border-border rounded-xl shadow-xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Enable notifications</p>
          <p className="text-xs text-muted-foreground">Get push alerts for tickets & updates.</p>
        </div>
        <Button size="sm" onClick={handleEnable}>Enable</Button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default EnablePushPrompt;

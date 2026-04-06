import { Bell, Menu, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { supabase } from '@/integrations/supabase/client';

interface TopNavProps {
  onMenuClick: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  const activeRole = useAuthStore((s) => s.activeRole);
  const user = useAuthStore((s) => s.user);
  const { isDark, toggle } = useThemeStore();

  const handleThemeToggle = async () => {
    toggle();
    if (user?.id) {
      await supabase.from('users').update({ dark_mode: !isDark }).eq('id', user.id);
    }
  };

  return (
    <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold text-primary tracking-tight">FS</span>
      </div>

      {/* Center: Role badge */}
      {activeRole && (
        <div className="absolute left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary border border-primary rounded-full">
            {activeRole}
          </span>
        </div>
      )}

      {/* Right: Notifications + Menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleThemeToggle}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            3
          </span>
        </button>
        <button
          onClick={onMenuClick}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default TopNav;

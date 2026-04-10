import { Menu, Sun, Moon } from 'lucide-react';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import NotificationDropdown from './NotificationDropdown';
import { useThemeStore } from '@/stores/themeStore';
import { supabase } from '@/integrations/supabase/client';

interface TopNavProps {
  onMenuClick: () => void;
}

const roleBadgeColors: Record<AppRole, string> = {
  admin: 'text-[#FFD700] border-[#FFD700]',
  supervisor: 'text-[#185FA5] border-[#185FA5]',
  technician: 'text-[#3B6D11] border-[#3B6D11]',
  accounting: 'text-[#534AB7] border-[#534AB7]',
};

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
      {/* Left: Hamburger */}
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Center: FiveServ wordmark */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center">
          <span className="text-xl font-bold" style={{ color: '#FFD700', fontFamily: 'Arial, sans-serif' }}>F</span>
          <span className="text-xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>iveServ</span>
        </div>
      </div>

      {/* Right: Role badge + theme toggle + bell */}
      <div className="flex items-center gap-2 sm:gap-3">
        {activeRole && (
          <span
            className={`hidden sm:inline-block px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest border rounded-full ${roleBadgeColors[activeRole]}`}
          >
            {activeRole}
          </span>
        )}
        <button
          onClick={handleThemeToggle}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <NotificationDropdown />
      </div>
    </header>
  );
};

export default TopNav;

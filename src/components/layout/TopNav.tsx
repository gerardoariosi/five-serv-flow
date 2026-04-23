import { Menu, Sun, Moon, User, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import NotificationDropdown from './NotificationDropdown';
import { useThemeStore } from '@/stores/themeStore';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopNavProps {
  onMenuClick: () => void;
}

const roleBadgeStyles: Record<AppRole, { bg: string; text: string; abbr: string }> = {
  admin:      { bg: 'bg-[#FFD700]/15', text: 'text-[#FFD700]', abbr: 'ADM' },
  supervisor: { bg: 'bg-[#185FA5]/15', text: 'text-[#5B9BE0]', abbr: 'SUP' },
  technician: { bg: 'bg-[#3B6D11]/20', text: 'text-[#7CC242]', abbr: 'TEC' },
  accounting: { bg: 'bg-[#534AB7]/20', text: 'text-[#8B82E0]', abbr: 'ACC' },
};

const TopNav = ({ onMenuClick }: TopNavProps) => {
  const navigate = useNavigate();
  const activeRole = useAuthStore((s) => s.activeRole);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isDark, toggle } = useThemeStore();

  const handleThemeToggle = async () => {
    toggle();
    if (user?.id) {
      await supabase.from('users').update({ dark_mode: !isDark }).eq('id', user.id);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    logout();
    navigate('/login');
  };

  const initials = (user?.full_name ?? 'U')
    .split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2);

  const roleStyle = activeRole ? roleBadgeStyles[activeRole] : null;

  return (
    <header className="h-16 bg-background/95 backdrop-blur-sm border-b-2 border-[#FFD700]/60 flex items-center justify-between px-4 shrink-0 sticky top-0 z-40">
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex justify-center overflow-hidden">
        <img
          src="/FiveServ_Logo_2_No_BG.png"
          alt="FiveServ"
          style={{ height: '80px', width: 'auto', marginTop: '-22px', marginBottom: '-22px' }}
        />
      </div>

      <div className="flex items-center gap-3">
        {roleStyle && (
          <span
            className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${roleStyle.bg} ${roleStyle.text}`}
          >
            <span className="hidden sm:inline">{activeRole}</span>
            <span className="sm:hidden">{roleStyle.abbr}</span>
          </span>
        )}
        <button
          onClick={handleThemeToggle}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="focus:outline-none active:scale-95 transition-transform">
              <Avatar className="w-8 h-8 cursor-pointer border border-border hover:border-primary transition-colors">
                {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.full_name} /> : null}
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
              <User className="w-4 h-4 mr-2" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" /> My Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopNav;

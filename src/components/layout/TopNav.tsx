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

const roleBadgeColors: Record<AppRole, string> = {
  admin: 'text-[#FFD700] border-[#FFD700]',
  supervisor: 'text-[#185FA5] border-[#185FA5]',
  technician: 'text-[#3B6D11] border-[#3B6D11]',
  accounting: 'text-[#534AB7] border-[#534AB7]',
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
    .split(' ')
    .map(w => w.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

      {/* Right: Role badge + theme toggle + bell + profile */}
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

        {/* Profile avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="focus:outline-none">
              <Avatar className="w-8 h-8 cursor-pointer border border-border hover:border-primary transition-colors">
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user.full_name} />
                ) : null}
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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

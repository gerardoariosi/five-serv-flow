import { Bell, Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface TopNavProps {
  onMenuClick: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  const activeRole = useAuthStore((s) => s.activeRole);

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

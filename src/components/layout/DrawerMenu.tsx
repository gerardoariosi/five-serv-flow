import { X, LogOut, User, LayoutDashboard, Building2, MapPin, Map, Ticket, Wrench, ClipboardCheck, Users, DollarSign, CalendarDays, BarChart3, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';

interface DrawerMenuProps {
  open: boolean;
  onClose: () => void;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  technician: 'Technician',
  accounting: 'Accounting',
};

const navItemsByRole: Record<string, { label: string; icon: any; path: string }[]> = {
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Tickets', icon: Ticket, path: '/tickets' },
    { label: 'Inspections', icon: ClipboardCheck, path: '/inspections' },
    { label: 'Clients', icon: Building2, path: '/clients' },
    { label: 'Zones', icon: Map, path: '/zones' },
    { label: 'Properties', icon: MapPin, path: '/properties' },
    { label: 'Team', icon: Users, path: '/team/technicians' },
    { label: 'Accounting', icon: DollarSign, path: '/accounting' },
    { label: 'Calendar', icon: CalendarDays, path: '/calendar' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
    { label: 'Chat', icon: MessageCircle, path: '/chat' },
    { label: 'My Profile', icon: User, path: '/profile' },
  ],
  supervisor: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Tickets', icon: Ticket, path: '/tickets' },
    { label: 'Inspections', icon: ClipboardCheck, path: '/inspections' },
    { label: 'Clients', icon: Building2, path: '/clients' },
    { label: 'Zones', icon: Map, path: '/zones' },
    { label: 'Properties', icon: MapPin, path: '/properties' },
    { label: 'Team', icon: Users, path: '/team/technicians' },
    { label: 'Calendar', icon: CalendarDays, path: '/calendar' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
    { label: 'Chat', icon: MessageCircle, path: '/chat' },
    { label: 'My Profile', icon: User, path: '/profile' },
  ],
  technician: [
    { label: 'My Work', icon: Wrench, path: '/my-work' },
    { label: 'Chat', icon: MessageCircle, path: '/chat' },
    { label: 'My Profile', icon: User, path: '/profile' },
  ],
  accounting: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Accounting', icon: DollarSign, path: '/accounting' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
    { label: 'Chat', icon: MessageCircle, path: '/chat' },
    { label: 'My Profile', icon: User, path: '/profile' },
  ],
};

const DrawerMenu = ({ open, onClose }: DrawerMenuProps) => {
  const navigate = useNavigate();
  const { user, activeRole, setActiveRole, logout } = useAuthStore();
  const roles = user?.roles ?? [];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    onClose();
    navigate('/login', { replace: true });
  };

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-72 bg-background border-l border-border z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-sm font-bold text-primary uppercase tracking-widest">Menu</span>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Switcher */}
          {roles.length > 1 && (
            <div className="p-4 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Role
              </span>
              <div className="mt-2 flex flex-col gap-1">
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeRole === role
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex-1 p-4">
            <div className="flex flex-col gap-1">
              {(navItemsByRole[activeRole ?? 'technician'] ?? navItemsByRole.technician).map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-secondary rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DrawerMenu;

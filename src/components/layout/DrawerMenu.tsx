import { X, LogOut, User, LayoutDashboard, Building2, MapPin, Map, Ticket, Wrench, ClipboardCheck, Users, DollarSign, CalendarDays, BarChart3, MessageCircle, Settings, HelpCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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

const roleBadgeStyles: Record<AppRole, string> = {
  admin: 'bg-foreground text-background',
  supervisor: 'bg-foreground text-background',
  technician: 'bg-foreground text-background',
  accounting: 'bg-foreground text-background',
};

interface NavItem { label: string; icon: any; path: string; color: string; shortcut?: string }
interface NavGroup { title: string; items: NavItem[] }

const navGroupsByRole: Record<string, NavGroup[]> = {
  admin: [
    { title: 'OPERATIONS', items: [
      { label: 'Dashboard',   icon: LayoutDashboard, path: '/dashboard',   color: 'text-primary',     shortcut: 'G D' },
      { label: 'Tickets',     icon: Ticket,          path: '/tickets',     color: 'text-blue-400',    shortcut: 'G T' },
      { label: 'Inspections', icon: ClipboardCheck,  path: '/inspections', color: 'text-amber-400',   shortcut: 'G I' },
      { label: 'Calendar',    icon: CalendarDays,    path: '/calendar',    color: 'text-purple-400',  shortcut: 'G C' },
    ]},
    { title: 'MANAGEMENT', items: [
      { label: 'Clients',    icon: Building2,    path: '/clients',           color: 'text-emerald-400' },
      { label: 'Properties', icon: MapPin,       path: '/properties',        color: 'text-cyan-400' },
      { label: 'Zones',      icon: Map,          path: '/zones',             color: 'text-orange-400' },
      { label: 'Team',       icon: Users,        path: '/team/technicians',  color: 'text-pink-400' },
      { label: 'Accounting', icon: DollarSign,   path: '/accounting',        color: 'text-green-400' },
    ]},
    { title: 'ANALYTICS', items: [
      { label: 'Reports', icon: BarChart3, path: '/reports', color: 'text-indigo-400' },
    ]},
    { title: 'COMMUNICATION', items: [
      { label: 'Chat', icon: MessageCircle, path: '/chat', color: 'text-sky-400' },
    ]},
    { title: 'ACCOUNT', items: [
      { label: 'Settings',   icon: Settings, path: '/settings', color: 'text-muted-foreground' },
      { label: 'My Profile', icon: User,     path: '/profile',  color: 'text-muted-foreground' },
    ]},
    { title: 'SUPPORT', items: [
      { label: 'Help Center', icon: HelpCircle, path: '/help', color: 'text-muted-foreground' },
    ]},
  ],
  supervisor: [
    { title: 'OPERATIONS', items: [
      { label: 'Dashboard',   icon: LayoutDashboard, path: '/dashboard',   color: 'text-primary',    shortcut: 'G D' },
      { label: 'Tickets',     icon: Ticket,          path: '/tickets',     color: 'text-blue-400',   shortcut: 'G T' },
      { label: 'Inspections', icon: ClipboardCheck,  path: '/inspections', color: 'text-amber-400',  shortcut: 'G I' },
      { label: 'Calendar',    icon: CalendarDays,    path: '/calendar',    color: 'text-purple-400', shortcut: 'G C' },
    ]},
    { title: 'MANAGEMENT', items: [
      { label: 'Clients',    icon: Building2, path: '/clients',          color: 'text-emerald-400' },
      { label: 'Properties', icon: MapPin,    path: '/properties',       color: 'text-cyan-400' },
      { label: 'Zones',      icon: Map,       path: '/zones',            color: 'text-orange-400' },
      { label: 'Team',       icon: Users,     path: '/team/technicians', color: 'text-pink-400' },
    ]},
    { title: 'ANALYTICS',     items: [{ label: 'Reports', icon: BarChart3,    path: '/reports', color: 'text-indigo-400' }] },
    { title: 'COMMUNICATION', items: [{ label: 'Chat',    icon: MessageCircle, path: '/chat',    color: 'text-sky-400' }] },
    { title: 'ACCOUNT',       items: [{ label: 'My Profile', icon: User, path: '/profile', color: 'text-muted-foreground' }] },
    { title: 'SUPPORT',       items: [{ label: 'Help Center', icon: HelpCircle, path: '/help', color: 'text-muted-foreground' }] },
  ],
  technician: [
    { title: 'WORK', items: [
      { label: 'My Work',     icon: Wrench,       path: '/my-work',     color: 'text-blue-400' },
      { label: 'My Calendar', icon: CalendarDays, path: '/my-calendar', color: 'text-purple-400' },
    ]},
    { title: 'COMMUNICATION', items: [{ label: 'Chat', icon: MessageCircle, path: '/chat', color: 'text-sky-400' }] },
    { title: 'ACCOUNT',       items: [{ label: 'My Profile', icon: User, path: '/profile', color: 'text-muted-foreground' }] },
    { title: 'SUPPORT',       items: [{ label: 'Help Center', icon: HelpCircle, path: '/help', color: 'text-muted-foreground' }] },
  ],
  accounting: [
    { title: 'OPERATIONS', items: [
      { label: 'Dashboard',  icon: LayoutDashboard, path: '/dashboard',  color: 'text-primary' },
      { label: 'Accounting', icon: DollarSign,      path: '/accounting', color: 'text-green-400' },
    ]},
    { title: 'ANALYTICS',     items: [{ label: 'Reports', icon: BarChart3,    path: '/reports', color: 'text-indigo-400' }] },
    { title: 'COMMUNICATION', items: [{ label: 'Chat',    icon: MessageCircle, path: '/chat',    color: 'text-sky-400' }] },
    { title: 'ACCOUNT',       items: [{ label: 'My Profile', icon: User, path: '/profile', color: 'text-muted-foreground' }] },
    { title: 'SUPPORT',       items: [{ label: 'Help Center', icon: HelpCircle, path: '/help', color: 'text-muted-foreground' }] },
  ],
};

const DrawerMenu = ({ open, onClose }: DrawerMenuProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, activeRole, setActiveRole, logout } = useAuthStore();
  const roles = user?.roles ?? [];

  const handleLogout = async () => {
    localStorage.removeItem('fiveserv-remember-me');
    sessionStorage.removeItem('fiveserv-session-active');
    await supabase.auth.signOut();
    logout();
    onClose();
    navigate('/login', { replace: true });
  };

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const initials = (user?.full_name ?? 'U')
    .split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2);

  const groups = activeRole ? (navGroupsByRole[activeRole] ?? []) : [];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-[280px] bg-background border-r border-border z-50 transform transition-transform duration-300 drawer-spring ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        <div className="flex flex-col h-full">
          {/* Profile header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="w-10 h-10 border border-border">
                  {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.full_name ?? ''} /> : null}
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  {activeRole && (
                    <span className={`inline-flex mt-1 items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-full ${roleBadgeStyles[activeRole]}`}>
                      {roleLabels[activeRole]}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-1 -mr-1 text-muted-foreground hover:text-foreground active:scale-95">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Role Switcher */}
          {roles.length > 1 && (
            <div className="px-3 pt-3 pb-2 border-b border-border">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-1">
                Switch Role
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className={`text-left px-2.5 py-1 rounded-md text-xs font-medium transition-colors active:scale-95 ${
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

          {/* Navigation groups */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 mb-1 mt-4">
                  {group.title}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors active:scale-[0.98] ${
                          isActive
                            ? 'bg-primary/10 text-foreground font-medium border-l-2 border-primary pl-[10px]'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        }`}
                      >
                        <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.shortcut && (
                          <span className="text-[10px] text-muted-foreground/50 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer: shortcuts hint + logout + version */}
          <div className="border-t border-border">
            <div className="px-4 py-2 text-[10px] text-muted-foreground/60 leading-relaxed">
              Press <kbd className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[9px]">N</kbd> · New ticket
              {' · '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[9px]">/</kbd> Search
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors active:scale-[0.99]"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
            <div className="px-4 py-2 text-[10px] text-muted-foreground/40 border-t border-border">
              FiveServ Operations · v1.0
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DrawerMenu;

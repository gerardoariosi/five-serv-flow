import { Wrench, CalendarDays, MessageCircle, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { label: 'My Work', icon: Wrench, path: '/my-work' },
  { label: 'Calendar', icon: CalendarDays, path: '/my-calendar' },
  { label: 'Chat', icon: MessageCircle, path: '/chat' },
  { label: 'Profile', icon: User, path: '/profile' },
];

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t border-border z-30 flex items-center justify-around"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)', minHeight: 'calc(4rem + env(safe-area-inset-bottom))' }}
    >
      {items.map((item) => {
        const active = pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:scale-95 ${
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
            {active && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;

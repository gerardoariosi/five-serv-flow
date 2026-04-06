import { X, LogOut } from 'lucide-react';
import { useAuthStore, type AppRole } from '@/stores/authStore';

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

const DrawerMenu = ({ open, onClose }: DrawerMenuProps) => {
  const { user, activeRole, setActiveRole, logout } = useAuthStore();
  const roles = user?.roles ?? [];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-background border-l border-border z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
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

          {/* Navigation placeholder */}
          <div className="flex-1 p-4">
            <p className="text-xs text-muted-foreground">Navigation links will appear here based on active role.</p>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-secondary rounded-md transition-colors"
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

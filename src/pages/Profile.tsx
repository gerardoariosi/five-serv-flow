import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import PasswordStrength, { passwordIsValid } from '@/components/auth/PasswordStrength';
import Spinner from '@/components/ui/Spinner';
import { compressImage } from '@/lib/imageCompression';

const Profile = () => {
  const { user, setUser, activeRole, setActiveRole } = useAuthStore();
  const roleLabels: Record<AppRole, string> = { admin: 'Admin', supervisor: 'Supervisor', technician: 'Technician', accounting: 'Accounting' };
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const { isDark, setDark } = useThemeStore();
  const [saving, setSaving] = useState(false);

  // Password section
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Photo
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.avatar_url ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('users')
      .update({
        full_name: fullName,
        phone,
        language,
        dark_mode: isDark,
      })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update profile.');
    } else {
      setUser({ ...user, full_name: fullName });
      toast.success('Profile updated.');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwordIsValid(newPassword, confirmPassword)) return;

    setChangingPassword(true);

    // Re-authenticate with current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: currentPassword,
    });

    if (signInError) {
      toast.error('Current password is incorrect.');
      setChangingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated. Other sessions have been invalidated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    }
    setChangingPassword(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const compressed = await compressImage(file);
    const ext = compressed.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(path, compressed, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload photo.');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Save avatar_url to users table
    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);

    setPhotoUrl(publicUrl);
    setUser({ ...user, avatar_url: publicUrl });
    toast.success('Photo uploaded.');
    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 py-8">
        <h1 className="text-xl font-bold text-foreground mb-6">My Profile</h1>

        {/* Photo */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-20 h-20 rounded-full bg-secondary border-2 border-border flex items-center justify-center overflow-hidden cursor-pointer relative"
            onClick={() => fileRef.current?.click()}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary">
                {(user?.full_name ?? 'U').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-foreground" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            {uploading && <Spinner size="sm" />}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        {/* Active Role switcher (only for users with multiple roles) */}
        {user && user.roles && user.roles.length > 1 && (
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <Label className="text-sm text-muted-foreground">Active Role</Label>
            <p className="text-xs text-muted-foreground mb-3">Switch the dashboard view. You'll keep receiving notifications for all of your roles.</p>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeRole === role
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {roleLabels[role]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Profile Fields */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 mb-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-secondary border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Phone</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="bg-secondary border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Email</Label>
            <Input
              value={user?.email ?? ''}
              disabled
              className="bg-muted border-border text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Only editable by Admin</p>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Language</Label>
            <div className="flex gap-1">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  language === 'en' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  language === 'es' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                ES
              </button>
            </div>
          </div>

          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Dark Mode</Label>
            <Switch checked={isDark} onCheckedChange={(checked) => {
              setDark(checked);
              if (user?.id) {
                supabase.from('users').update({ dark_mode: checked }).eq('id', user.id);
              }
            }} />
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            {saving ? <Spinner size="sm" /> : 'Save Changes'}
          </Button>
        </div>

        {/* Change Password (collapsed) */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <span>Change Password</span>
            {showPasswordSection ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showPasswordSection && (
            <div className="p-4 pt-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-secondary border-border text-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">New Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Confirm New Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <PasswordStrength password={newPassword} confirmPassword={confirmPassword} />

              <Button
                onClick={handleChangePassword}
                disabled={!passwordIsValid(newPassword, confirmPassword) || !currentPassword || changingPassword}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                {changingPassword ? <Spinner size="sm" /> : 'Update Password'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

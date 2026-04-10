import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Send, ArrowLeft, Plus, Image, AtSign, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';

const ChatPage = () => {
  const { user, activeRole } = useAuthStore();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch groups filtered by role
  const { data: groups = [] } = useQuery({
    queryKey: ['chat-groups', activeRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_groups')
        .select('*')
        .order('name');
      if (error) throw error;
      // Filter by role access
      return (data || []).filter((g: any) => {
        if (!g.role_access || g.role_access.length === 0) return true;
        return g.role_access.includes(activeRole);
      });
    },
  });

  // Fetch messages for active group
  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', activeGroup],
    queryFn: async () => {
      if (!activeGroup) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, users:sender_id(full_name)')
        .eq('group_id', activeGroup)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!activeGroup,
  });

  // Unread counts
  const { data: readStatus = [] } = useQuery({
    queryKey: ['chat-read-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('chat_read_status')
        .select('*')
        .eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: latestMessages = [] } = useQuery({
    queryKey: ['chat-latest-messages'],
    queryFn: async () => {
      const groupIds = groups.map((g: any) => g.id);
      if (groupIds.length === 0) return [];
      const results = [];
      for (const gid of groupIds) {
        const { data } = await supabase
          .from('chat_messages')
          .select('group_id, created_at')
          .eq('group_id', gid)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);
        if (data?.[0]) results.push(data[0]);
      }
      return results;
    },
    enabled: groups.length > 0,
  });

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groups.forEach((g: any) => {
      const rs = readStatus.find((r: any) => r.group_id === g.id);
      const latest = latestMessages.find((m: any) => m.group_id === g.id);
      if (latest && (!rs || new Date(latest.created_at) > new Date(rs.last_read_at))) {
        counts[g.id] = 1; // simplified — just show dot
      }
    });
    return counts;
  }, [groups, readStatus, latestMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!activeGroup) return;
    const channel = supabase
      .channel(`chat-${activeGroup}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${activeGroup}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', activeGroup] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroup, queryClient]);

  // Mark as read when entering group
  useEffect(() => {
    if (!activeGroup || !user?.id) return;
    const markRead = async () => {
      await supabase.from('chat_read_status').upsert({
        user_id: user.id,
        group_id: activeGroup,
        last_read_at: new Date().toISOString(),
      }, { onConflict: 'user_id,group_id' });
      queryClient.invalidateQueries({ queryKey: ['chat-read-status'] });
    };
    markRead();
  }, [activeGroup, user?.id, queryClient]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-select first group
  useEffect(() => {
    if (!activeGroup && groups.length > 0) setActiveGroup(groups[0].id);
  }, [groups, activeGroup]);

  const handleSend = async () => {
    if (!message.trim() || !activeGroup || !user?.id) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      group_id: activeGroup,
      sender_id: user.id,
      content: message.trim(),
    });
    setSending(false);
    if (error) { toast.error('Failed to send'); return; }
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    const { error } = await supabase.from('chat_groups').insert({
      name: newGroupName.trim(),
      is_fixed: false,
      role_access: ['admin', 'supervisor', 'technician', 'accounting'],
    });
    if (error) { toast.error('Failed to create group'); return; }
    toast.success('Group created');
    setShowCreateGroup(false);
    setNewGroupName('');
    queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (activeRole !== 'admin') return;
    const { error } = await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', msgId);
    if (error) { toast.error('Failed to delete'); return; }
    queryClient.invalidateQueries({ queryKey: ['chat-messages', activeGroup] });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeGroup || !user?.id) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }

    const ext = file.name.split('.').pop();
    const path = `chat/${activeGroup}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('profile-photos').upload(path, file);
    if (uploadError) { toast.error('Upload failed'); return; }
    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);

    await supabase.from('chat_messages').insert({
      group_id: activeGroup,
      sender_id: user.id,
      content: '📷 Photo',
      photo_url: urlData.publicUrl,
    });
  };

  const insertMention = (type: string) => {
    const mentions: Record<string, string> = {
      ticket: '@ticket FS-',
      property: '@property ',
      inspection: '@inspection INS-',
      technician: '@technician ',
    };
    setMessage((prev) => prev + (mentions[type] || ''));
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  // Parse mentions in message content — resolve to detail routes
  const handleMentionClick = async (type: string, value: string) => {
    if (type === 'ticket') {
      const { data } = await supabase.from('tickets').select('id').eq('fs_number', value).maybeSingle();
      if (data) { navigate(`/tickets/${data.id}`); return; }
    } else if (type === 'property') {
      const { data } = await supabase.from('properties').select('id').eq('name', value).maybeSingle();
      if (data) { navigate(`/properties/${data.id}`); return; }
    } else if (type === 'inspection') {
      const { data } = await supabase.from('inspections').select('id').eq('ins_number', value).maybeSingle();
      if (data) { navigate(`/inspections/${data.id}`); return; }
    }
    toast.error(`Could not find ${type}: ${value}`);
  };

  const renderContent = (content: string) => {
    const mentionRegex = /@(ticket|property|inspection|technician)\s+([^\s,]+(?:\s+[^\s,@]+)*)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
      const type = match[1];
      const value = match[2];
      parts.push(
        <span key={match.index} className="text-primary font-medium cursor-pointer hover:underline" onClick={() => handleMentionClick(type, value)}>
          @{type} {value}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return parts.length > 0 ? parts : content;
  };

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  };

  const activeGroupData = groups.find((g: any) => g.id === activeGroup);
  const showList = isMobile ? !activeGroup : true;
  const showChat = isMobile ? !!activeGroup : true;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Group List */}
      {showList && (
        <div className={`${isMobile ? 'w-full' : 'w-64 border-r border-border'} flex flex-col bg-card`}>
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Chat</h2>
            {activeRole === 'admin' && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreateGroup(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {groups.map((g: any) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`w-full text-left px-3 py-3 flex items-center gap-2 transition-colors ${
                  activeGroup === g.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-secondary border-l-2 border-transparent'
                }`}
              >
                <span className="text-sm font-medium text-foreground flex-1 truncate">{g.name}</span>
                {unreadCounts[g.id] && (
                  <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Area */}
      {showChat && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveGroup(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <span className="text-sm font-bold text-foreground">{activeGroupData?.name || 'Select a group'}</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {!activeGroup && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a group to start chatting</div>
            )}
            {messages.map((msg: any, idx: number) => {
              const prevMsg = messages[idx - 1];
              const showDateSep = !prevMsg || format(new Date(msg.created_at), 'yyyy-MM-dd') !== format(new Date(prevMsg.created_at), 'yyyy-MM-dd');
              const isOwn = msg.sender_id === user?.id;

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground">{formatDateSeparator(msg.created_at)}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isOwn ? 'bg-primary/15' : 'bg-secondary'}`}>
                      {!isOwn && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5">
                          {(msg.users as any)?.full_name || 'Unknown'}
                        </p>
                      )}
                      {msg.photo_url && (
                        <img
                          src={msg.photo_url}
                          alt="Photo"
                          className="w-48 h-32 object-cover rounded mb-1 cursor-pointer"
                          onClick={() => window.open(msg.photo_url, '_blank')}
                        />
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{renderContent(msg.content || '')}</p>
                      <p className="text-[9px] text-muted-foreground mt-1 text-right">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                    {activeRole === 'admin' && !isOwn && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 self-center p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {activeGroup && (
            <div className="p-2 border-t border-border bg-card">
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMentionMenu(!showMentionMenu)}>
                    <AtSign className="w-4 h-4" />
                  </Button>
                  {showMentionMenu && (
                    <div className="absolute bottom-10 left-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                      {['ticket', 'property', 'inspection', 'technician'].map((t) => (
                        <button key={t} onClick={() => insertMention(t)} className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-secondary capitalize">
                          @{t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <span><Image className="w-4 h-4" /></span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
                <Input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 h-8 text-sm"
                />
                <Button size="icon" className="h-8 w-8" onClick={handleSend} disabled={sending || !message.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
          <div>
            <Label>Group Name</Label>
            <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Maintenance" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;

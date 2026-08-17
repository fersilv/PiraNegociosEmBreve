import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Check, Trash2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  isNotificationSupported, 
  requestNotificationPermission 
} from '../lib/notifications';

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      if (Array.isArray(res.data)) {
        setNotifications(res.data);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error(err);
      setNotifications([]);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Check if notification permission is already granted
    if (isNotificationSupported() && Notification.permission === 'granted') {
      setIsPushEnabled(true);
    }

    fetchNotifications();

    // Set up polling for real-time notifications
    const intervalId = setInterval(fetchNotifications, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [user]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleRequestPush = async () => {
    if (!user) return;
    const token = await requestNotificationPermission(user.uid);
    if (token) {
      setIsPushEnabled(true);
      alert('Notificações push ativadas com sucesso neste dispositivo!');
    } else {
      alert('Não foi possível ativar as notificações push. Verifique as permissões de notificação do seu navegador.');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative z-40" ref={dropdownRef}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-all focus:outline-none flex items-center justify-center"
        aria-label="Notificações"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-terracotta-600 rounded-full ring-2 ring-white animate-pulse" />
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
          
          {/* Header */}
          <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <div>
              <h3 className="font-bold text-stone-900 flex items-center gap-2">
                Notificações
                {unreadCount > 0 && (
                  <span className="bg-terracotta-100 text-terracotta-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} novas
                  </span>
                )}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">Alertas de vagas e processos</p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-xs text-terracotta-600 hover:text-terracotta-800 font-bold transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Ler todas
              </button>
            )}
          </div>

          {/* Push Permission Prompt */}
          {!isPushEnabled && isNotificationSupported() && (
            <div className="p-3 bg-amber-50/70 border-b border-amber-100/50 flex items-center justify-between gap-3">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 font-medium leading-normal">
                  Ative as notificações push para receber alertas mesmo offline!
                </p>
              </div>
              <button 
                onClick={handleRequestPush}
                className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 transition-all shadow-sm"
              >
                Ativar
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-[350px] overflow-y-auto divide-y divide-stone-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <BellOff className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-medium">Nenhuma notificação por enquanto</p>
                <p className="text-xs text-stone-400 mt-1">Nós te avisaremos quando houver atualizações!</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => {
                    handleMarkAsRead(notif.id);
                    if (notif.link) {
                      navigate(notif.link);
                      setIsOpen(false);
                    } else if (notif.appId) {
                      navigate(`/dashboard/admissao/${notif.appId}`);
                      setIsOpen(false);
                    } else if (notif.jobId) {
                      navigate(`/dashboard/vaga-detalhes/${notif.jobId}`);
                      setIsOpen(false);
                    }
                  }}
                  className={`p-4 hover:bg-stone-50 transition-colors cursor-pointer flex gap-3 relative group ${
                    !notif.read ? 'bg-terracotta-50/20' : ''
                  }`}
                >
                  {/* Status Indicator */}
                  {!notif.read && (
                    <div className="absolute left-2.5 top-5 w-1.5 h-1.5 bg-terracotta-600 rounded-full" />
                  )}

                  {/* Icon Column */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    notif.type === 'status_update' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {notif.type === 'status_update' ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>

                  {/* Content Column */}
                  <div className="flex-1 min-w-0 pr-4">
                    <p className={`text-xs font-bold text-stone-900 ${!notif.read ? 'font-extrabold' : ''}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed break-words">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1.5">
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : 'Recent'}
                    </p>
                  </div>

                  {/* Actions Column */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center shrink-0">
                    <button 
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      className="p-1 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-stone-100 text-center bg-stone-50/50">
            <span className="text-[10px] text-stone-400 font-medium">PiraNegócios Alertas e Vagas</span>
          </div>

        </div>
      )}
    </div>
  );
}


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { 
  Thermometer, 
  LogOut, 
  FileBarChart, 
  Users as UsersIcon, 
  Plus, 
  Scan,
  Settings,
  User as UserIcon
} from 'lucide-react';
import { ACUnit, User, UserRole, UserStatus, MaintenanceRecord, Ticket, ServiceType, UnitStatus, PlannedMaintenance, MaintenanceReminder } from './types';
import { supabase } from './services/supabase';
import { mapUserFromDB, mapUnitFromDB, mapMaintenanceFromDB, mapTicketFromDB } from './services/dataMapper';
import { useTheme } from './contexts/ThemeContext';
import { useUnits } from './contexts/UnitsContext';
import { useTickets } from './contexts/TicketsContext';

// Pages
import HomePage from './pages/HomePage';
import UnitDetailsPage from './pages/UnitDetailsPage';
import ReportsPage from './pages/ReportsPage';
import UsersManagementPage from './pages/UsersManagementPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';

// Components
import PrintQRCodeModal from './components/PrintQRCodeModal';
import ProfileModal from './components/ProfileModal';

const App: React.FC = () => {
  const { appName, logoUrl } = useTheme();
  // Inicializa estados vazios, o useEffect irá popular com dados do Supabase
  const { units, setUnits } = useUnits();
  const [users, setUsers] = useState<User[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(() => {
    // Mantemos a sessão do usuário no localStorage para persistência de reload simples
    const saved = localStorage.getItem('arcontrol_user');
    return saved ? JSON.parse(saved) : null;
  });
  const { tickets: activeTickets, setTickets: setActiveTickets } = useTickets();
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleAcceptReminder = (id: string, date: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'CONFIRMED', confirmedDate: date } : r));
    // Here you would also call Supabase to update the database
  };

  const handleRemoveReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    // Here you would also call Supabase to delete the database entry
  };

  const [qrModalState, setQrModalState] = useState<{ isOpen: boolean, unit: ACUnit | null, all: boolean }>({ 
    isOpen: false, 
    unit: null, 
    all: false 
  });
  const [showProfileModal, setShowProfileModal] = useState(false);

  const audioIntervalRef = useRef<number | null>(null);

  // --- Fetch Data ---

  const fetchTicketsOnly = useCallback(async () => {
    try {
      const { data: ticketsData, error: ticketsError } = await supabase.from('tickets').select('*');
      if (ticketsError) throw ticketsError;
      
      const newTickets = ticketsData.map(mapTicketFromDB).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setActiveTickets(prevTickets => {
        if (JSON.stringify(newTickets) !== JSON.stringify(prevTickets)) {
          return newTickets;
        }
        return prevTickets;
      });
    } catch (error) {
      console.error("Erro ao realizar polling de chamados:", error);
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(fetchTicketsOnly, 5000);
    return () => clearInterval(intervalId);
  }, [fetchTicketsOnly]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Auto-clean tickets older than 6 months (180 days)
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const isoThreshold = sixMonthsAgo.toISOString();
        
        await supabase
          .from('tickets')
          .delete()
          .lt('created_at', isoThreshold);
      } catch (cleanError) {
        console.error("Erro ao limpar chamados com mais de 6 meses:", cleanError);
      }
      
      // 1. Fetch Users
      const { data: usersData, error: usersError } = await supabase.from('users').select('*');
      if (usersError) throw usersError;
      setUsers(usersData.map(mapUserFromDB));

      // 2. Fetch Units (with History and Planned relations)
      // Note: We use the join syntax. Assuming foreign keys are set up correctly in SQL.
      const { data: unitsData, error: unitsError } = await supabase
        .from('ac_units')
        .select(`
          *,
          history:maintenance_records(*),
          planned:planned_maintenance(*)
        `);
      
      if (unitsError) throw unitsError;
      // Sort history inside map function if needed, usually better to order by date in SQL but here we map first
      const mappedUnits = unitsData.map(mapUnitFromDB).map(u => ({
        ...u,
        history: u.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      setUnits(mappedUnits);

      // 3. Fetch Tickets
      const { data: ticketsData, error: ticketsError } = await supabase.from('tickets').select('*');
      if (ticketsError) throw ticketsError;
      // Sort tickets: Open/Urgent first logic is in HomePage, here just raw data
      setActiveTickets(ticketsData.map(mapTicketFromDB).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    } catch (error) {
      console.error("Erro ao carregar dados do Supabase:", error);
      // Fallback or Alert could go here
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Audio Notification Logic ---

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playTone = (freq: number, start: number, volume: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, start);
        oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, start + 1.5);

        gainNode.gain.setValueAtTime(volume, start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + 1.5);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start(start);
        oscillator.stop(start + 1.5);
      };

      const now = audioContext.currentTime;
      playTone(987.77, now, 0.1); // B5
      playTone(1318.51, now + 0.1, 0.08); // E6
      
    } catch (e) {
      console.warn("Alerta sonoro falhou (interação do usuário necessária):", e);
    }
  }, []);

  useEffect(() => {
    const hasOpenTickets = activeTickets.some(t => t.status === 'Aberto');
    
    // Alerta sonoro para Admin e Técnicos quando há chamados abertos
    const shouldPlayAlert = hasOpenTickets && authUser && (
      authUser.role === UserRole.ADMIN || 
      authUser.role === UserRole.TECHNICIAN
    );

    if (shouldPlayAlert) {
      if (!audioIntervalRef.current) {
        playNotificationSound();
        audioIntervalRef.current = window.setInterval(() => {
          playNotificationSound();
        }, 10000);
      }
    } else {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    }

    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    };
  }, [activeTickets, authUser, playNotificationSound]);

  // --- Auth Handlers ---

  const handleLoginSuccess = async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', user.username)
        .eq('password', user.password)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const loggedUser = mapUserFromDB(data);
        if (loggedUser.status === UserStatus.BLOCKED) {
            alert("Usuário bloqueado.");
            return;
        }
        setAuthUser(loggedUser);
        localStorage.setItem('arcontrol_user', JSON.stringify(loggedUser));
        fetchData(); // Recarregar dados ao logar
      } else {
        alert("Falha na autenticação.");
      }
    } catch (e) {
      console.error("Erro na autenticação:", e);
      alert("Erro ao realizar login.");
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    localStorage.removeItem('arcontrol_user');
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
  };

  // --- Data Manipulation Handlers (CRUD) ---

  const handleAddUnit = async (unit: ACUnit) => {
    try {
      const dbUnit = {
        id: unit.id,
        client_name: unit.clientName,
        department: unit.department,
        brand: unit.brand,
        model: unit.model,
        serial_number: unit.serialNumber,
        btu: unit.btu,
        location: unit.location,
        regional: unit.regional,
        install_date: unit.installDate,
        status: unit.status,
        unit_photos: unit.unitPhotos
      };
      
      const { error } = await supabase.from('ac_units').insert(dbUnit);
      if (error) throw error;
      
      // Se houver histórico inicial (raro na criação), salvar também
      // Para este app, assume-se que unidades novas vêm sem histórico
      
      setUnits(prev => [unit, ...prev]);
    } catch (e) {
      console.error("Erro ao adicionar unidade:", e);
      alert("Erro ao salvar equipamento no banco de dados.");
    }
  };

  const handleUpdateUnit = async (id: string, data: Partial<ACUnit>) => {
    try {
      const dbUpdate: any = {};
      if (data.clientName) dbUpdate.client_name = data.clientName;
      if (data.department !== undefined) dbUpdate.department = data.department;
      if (data.brand) dbUpdate.brand = data.brand;
      if (data.model !== undefined) dbUpdate.model = data.model;
      if (data.serialNumber) dbUpdate.serial_number = data.serialNumber;
      if (data.btu) dbUpdate.btu = data.btu;
      if (data.location) dbUpdate.location = data.location;
      if (data.regional) dbUpdate.regional = data.regional;
      if (data.installDate) dbUpdate.install_date = data.installDate;
      if (data.status) dbUpdate.status = data.status;
      if (data.unitPhotos) dbUpdate.unit_photos = data.unitPhotos;

      const { error } = await supabase.from('ac_units').update(dbUpdate).eq('id', id);
      if (error) throw error;

      setUnits(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    } catch (e) {
      console.error("Erro ao atualizar unidade:", e);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    try {
      const { error } = await supabase.from('ac_units').delete().eq('id', id);
      if (error) throw error;
      setUnits(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      console.error("Erro ao deletar unidade:", e);
    }
  };
  
  const handleAddUser = async (user: User) => {
    try {
      const dbUser = {
        id: user.id,
        username: user.username,
        password: user.password,
        email: user.email,
        phone: user.phone,
        role: user.role,
        client_name: user.clientName,
        status: user.status,
        avatar_url: user.avatarUrl
      };
      const { error } = await supabase.from('users').insert(dbUser);
      if (error) throw error;
      setUsers(prev => [...prev, user]);
    } catch (e) {
      console.error("Erro ao criar usuário:", e);
      alert("Erro ao criar usuário. Verifique se o username já existe.");
    }
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    try {
      const dbUpdate: any = {};
      if (data.username) dbUpdate.username = data.username;
      if (data.password) dbUpdate.password = data.password;
      if (data.email) dbUpdate.email = data.email;
      if (data.phone) dbUpdate.phone = data.phone;
      if (data.role) dbUpdate.role = data.role;
      if (data.clientName !== undefined) dbUpdate.client_name = data.clientName;
      if (data.status) dbUpdate.status = data.status;
      if (data.avatarUrl !== undefined) dbUpdate.avatar_url = data.avatarUrl;

      const { error } = await supabase.from('users').update(dbUpdate).eq('id', id);
      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
      if (authUser?.id === id) {
        setAuthUser(prev => prev ? { ...prev, ...data } : null);
        const updatedLocal = JSON.parse(localStorage.getItem('arcontrol_user') || '{}');
        localStorage.setItem('arcontrol_user', JSON.stringify({ ...updatedLocal, ...data }));
      }
    } catch (e) {
      console.error("Erro ao atualizar usuário:", e);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      console.error("Erro ao deletar usuário:", e);
    }
  };

  const handleAddMaintenance = async (unitId: string, record: MaintenanceRecord) => {
    try {
      const dbRecord = {
        id: record.id,
        unit_id: unitId,
        type: record.type,
        technician: record.technician,
        description: record.description,
        date: record.date,
        time: record.time,
        photos: record.photos,
        photo_descriptions: record.photoDescriptions,
        rating: record.rating,
        technical_report: record.technicalReport,
        documents: record.documents
      };

      const { error } = await supabase.from('maintenance_records').insert(dbRecord);
      if (error) throw error;
      
      // Update local state to reflect change immediately
      setUnits(prev => prev.map(u => u.id === unitId ? { 
        ...u, 
        history: [record, ...u.history], 
        status: UnitStatus.OPERATIONAL // Automaticamente volta para operacional após manutenção
      } : u));

      // Also update unit status in DB
      await supabase.from('ac_units').update({ status: 'Operacional' }).eq('id', unitId);

    } catch (e) {
      console.error("Erro ao adicionar manutenção:", e);
    }
  };

  const handleUpdateMaintenance = async (unitId: string, recordId: string, data: Partial<MaintenanceRecord>) => {
    try {
      const dbUpdate: any = {};
      if (data.type) dbUpdate.type = data.type;
      if (data.technician) dbUpdate.technician = data.technician;
      if (data.description) dbUpdate.description = data.description;
      if (data.date) dbUpdate.date = data.date;
      if (data.time) dbUpdate.time = data.time;
      if (data.photos) dbUpdate.photos = data.photos;
      if (data.photoDescriptions) dbUpdate.photo_descriptions = data.photoDescriptions;
      if (data.technicalReport) dbUpdate.technical_report = data.technicalReport;
      if (data.documents) dbUpdate.documents = data.documents;

      const { error } = await supabase.from('maintenance_records').update(dbUpdate).eq('id', recordId);
      if (error) throw error;

      setUnits(prev => prev.map(u => {
        if (u.id === unitId) {
          return {
            ...u,
            history: u.history.map(r => r.id === recordId ? { ...r, ...data } : r)
          };
        }
        return u;
      }));
    } catch (e) {
      console.error("Erro ao atualizar manutenção:", e);
    }
  };

  const handleAddPlannedMaintenance = async (unitId: string, planned: any) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      if (planned.expectedDate < today) {
        alert("A data não pode estar no passado.");
        return;
      }

      const dbPlanned = {
        id: planned.id,
        unit_id: unitId,
        type: planned.type,
        description: planned.description,
        expected_date: planned.expectedDate
      };

      const { error } = await supabase.from('planned_maintenance').insert(dbPlanned);
      if (error) throw error;

      setUnits(prev => prev.map(u => u.id === unitId ? {
        ...u,
        planned: [...u.planned, planned]
      } : u));
    } catch (e) {
      console.error("Erro ao adicionar manutenção planejada:", e);
    }
  };

  const handleUpdatePlannedMaintenance = async (unitId: string, plannedId: string, data: Partial<PlannedMaintenance>) => {
    try {
      if (data.expectedDate) {
        const today = new Date().toISOString().split('T')[0];
        if (data.expectedDate < today) {
          alert("A data não pode estar no passado.");
          return;
        }
      }

      const dbUpdate: any = {};
      if (data.type) dbUpdate.type = data.type;
      if (data.description) dbUpdate.description = data.description;
      if (data.expectedDate) dbUpdate.expected_date = data.expectedDate;

      const { error } = await supabase.from('planned_maintenance').update(dbUpdate).eq('id', plannedId);
      if (error) throw error;

      setUnits(prev => prev.map(u => u.id === unitId ? {
        ...u,
        planned: u.planned.map(p => p.id === plannedId ? { ...p, ...data } : p)
      } : u));
    } catch (e) {
      console.error("Erro ao atualizar manutenção planejada:", e);
    }
  };

  const handleDeletePlannedMaintenance = async (unitId: string, plannedId: string) => {
    try {
      const { error } = await supabase.from('planned_maintenance').delete().eq('id', plannedId);
      if (error) throw error;

      setUnits(prev => prev.map(u => u.id === unitId ? {
        ...u,
        planned: u.planned.filter(p => p.id !== plannedId)
      } : u));
    } catch (e) {
      console.error("Erro ao deletar manutenção planejada:", e);
    }
  };

  const handleRateMaintenance = async (unitId: string, recordId: string, rating: number) => {
    try {
      const { error } = await supabase.from('maintenance_records').update({ rating }).eq('id', recordId);
      if (error) throw error;

      setUnits(prev => prev.map(u => {
        if (u.id === unitId) {
          return {
            ...u,
            history: u.history.map(r => r.id === recordId ? { ...r, rating } : r)
          };
        }
        return u;
      }));
    } catch (e) {
      console.error("Erro ao avaliar manutenção:", e);
    }
  };

  const handleAddTicket = async (ticket: Ticket) => {
    try {
      const dbTicket = {
        id: ticket.id,
        unit_id: ticket.unitId,
        client_name: ticket.clientName,
        description: ticket.description,
        date: ticket.date,
        status: ticket.status,
        priority: ticket.priority,
        technician_id: ticket.technicianId
      };
      
      const { error } = await supabase.from('tickets').insert(dbTicket);
      if (error) throw error;

      setActiveTickets(prev => [ticket, ...prev]);
    } catch (e) {
      console.error("Erro ao criar chamado:", e);
    }
  };

  const handleUpdateTicket = async (id: string, data: Partial<Ticket>) => {
    try {
      const dbUpdate: any = {};
      if (data.status) dbUpdate.status = data.status;
      if (data.technicianId) dbUpdate.technician_id = data.technicianId;
      if (data.rescheduleReason) dbUpdate.reschedule_reason = data.rescheduleReason;
      if (data.date) dbUpdate.date = data.date;
      if (data.rating) dbUpdate.rating = data.rating;
      if (data.solution) dbUpdate.solution = data.solution;
      if (data.technicalReport) dbUpdate.technical_report = data.technicalReport;
      if (data.photos) dbUpdate.photos = data.photos;
      if (data.documents) dbUpdate.documents = data.documents;
      if (data.archived !== undefined) dbUpdate.archived = data.archived;
      if (data.isTransferred !== undefined) dbUpdate.is_transferred = data.isTransferred;

      let { error } = await supabase.from('tickets').update(dbUpdate).eq('id', id);
      if (error && (dbUpdate.archived !== undefined || dbUpdate.is_transferred !== undefined)) {
        console.warn("Colunas novas podem não existir no banco, tentando novamente sem elas:", error.message);
        const { archived, is_transferred, ...otherFields } = dbUpdate;
        const retryResult = await supabase.from('tickets').update(otherFields).eq('id', id);
        error = retryResult.error;
      }
      if (error) throw error;

      setActiveTickets(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    } catch (e) {
      console.error("Erro ao atualizar chamado:", e);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) throw error;
      setActiveTickets(prev => prev.filter(t => t.id !== id));
    } catch (e) {
       console.error("Erro ao deletar chamado:", e);
    }
  };

  const isPublicView = window.location.hash.includes('/public/');

  // Componente de loading interno para usar dentro do ThemeProvider
  const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[var(--theme-bg)] transition-colors duration-500">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--theme-primary)]"></div>
    </div>
  );

  if (!authUser && !isPublicView) {
    return (
      <LoginPage users={users} onLoginSuccess={handleLoginSuccess} />
    );
  }

  return (
    isLoading && !isPublicView && authUser ? <LoadingScreen /> : (
        <Router>
        <div className="min-h-screen bg-[var(--theme-bg)] flex flex-col pb-24 lg:pb-0 lg:pl-20 transition-colors duration-500">
            
            {!isPublicView && authUser && (
            <nav className="bg-white/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50 border-b border-gray-100 flex justify-between items-center lg:hidden no-print">
                <div className="flex items-center gap-2">
                {/* Updated to use dynamic primary color */}
                <div className="p-2 rounded-xl bg-[var(--theme-primary)] flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                         <img src={logoUrl} alt="Logo" className="w-5 h-5 object-contain" />
                    ) : (
                         <Thermometer className="w-5 h-5 text-white" />
                    )}
                </div>
                <span className="font-black text-xl tracking-tighter text-[var(--theme-text)] italic">{appName}</span>
                </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setShowProfileModal(true)} className="w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                        {authUser.avatarUrl ? (
                          <img src={authUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </button>
                      <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-all p-2 bg-gray-50 rounded-xl">
                      <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                </nav>
                )}

                {!isPublicView && authUser && (
                <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 bg-white border-r border-gray-100 flex-col items-center py-8 z-50 no-print">
                    {/* Updated to use dynamic primary color and shadow */}
                    <div className="p-3 rounded-2xl mb-12 shadow-lg bg-[var(--theme-primary)] shadow-[var(--theme-primary-light)] flex items-center justify-center overflow-hidden">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain" />
                        ) : (
                            <Thermometer className="w-6 h-6 text-white" />
                        )}
                    </div>
                    <div className="flex-1 flex flex-col gap-8">
                    {/* Updated hover states to dynamic primary */}
                    <Link to="/" title="Início" className="p-3 rounded-2xl hover:bg-[var(--theme-primary-light)] text-gray-400 hover:text-[var(--theme-primary)] transition-all">
                        <Thermometer className="w-6 h-6" />
                    </Link>
                    <Link to="/reports" title="Relatórios" className="p-3 rounded-2xl hover:bg-[var(--theme-primary-light)] text-gray-400 hover:text-[var(--theme-primary)] transition-all">
                        <FileBarChart className="w-6 h-6" />
                    </Link>
                    {authUser.role === UserRole.ADMIN && (
                        <>
                        <Link to="/register" title="Novo Equipamento" className="p-3 rounded-2xl hover:bg-[var(--theme-primary-light)] text-gray-400 hover:text-[var(--theme-primary)] transition-all">
                            <Plus className="w-6 h-6" />
                        </Link>
                        <Link to="/users" title="Usuários" className="p-3 rounded-2xl hover:bg-[var(--theme-primary-light)] text-gray-400 hover:text-[var(--theme-primary)] transition-all">
                            <UsersIcon className="w-6 h-6" />
                        </Link>
                        <Link to="/settings" title="Configurações" className="p-3 rounded-2xl hover:bg-[var(--theme-primary-light)] text-gray-400 hover:text-[var(--theme-primary)] transition-all">
                            <Settings className="w-6 h-6" />
                        </Link>
                        </>
                    )}
                    </div>
                    <button onClick={() => setShowProfileModal(true)} title="Meu Perfil" className="mb-4">
                      {authUser.avatarUrl ? (
                        <img src={authUser.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-transparent hover:border-[var(--theme-primary)] transition-all" />
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-full text-gray-400 hover:bg-[var(--theme-primary-light)] hover:text-[var(--theme-primary)] transition-all">
                          <UserIcon className="w-5 h-5" />
                        </div>
                      )}
                    </button>
                    <button onClick={handleLogout} className="p-3 rounded-2xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all">
                    <LogOut className="w-6 h-6" />
                    </button>
                </aside>
                )}

                <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 relative">
                <Routes>
                    <Route path="/public/unit/:id" element={<UnitDetailsPage units={units} user={null} tickets={activeTickets} isPublic={true} onUpdateUnit={() => {}} onDeleteUnit={() => {}} onOpenQR={(u) => setQrModalState({ isOpen: true, unit: u, all: false })} onAddMaintenance={() => {}} onUpdateMaintenance={() => {}} onAddPlannedMaintenance={() => {}} onUpdatePlannedMaintenance={() => {}} onDeletePlannedMaintenance={() => {}} onRateMaintenance={handleRateMaintenance} />} />
                    <Route path="/" element={authUser ? <HomePage units={units} user={authUser} tickets={activeTickets} users={users} onOpenQR={(u) => setQrModalState({ isOpen: true, unit: u, all: false })} onOpenAllQR={() => setQrModalState({ isOpen: true, unit: null, all: true })} onAddTicket={handleAddTicket} onUpdateTicket={handleUpdateTicket} onDeleteTicket={handleDeleteTicket} onAddUnit={handleAddUnit} onUpdateUnit={handleUpdateUnit} onAddPlannedMaintenance={handleAddPlannedMaintenance} reminders={reminders} onAcceptReminder={handleAcceptReminder} onRemoveReminder={handleRemoveReminder} /> : <Navigate to="/login" />} />
                    <Route path="/unit/:id" element={<UnitDetailsPage units={units} user={authUser} tickets={activeTickets} onUpdateUnit={handleUpdateUnit} onDeleteUnit={handleDeleteUnit} onOpenQR={(u) => setQrModalState({ isOpen: true, unit: u, all: false })} onAddMaintenance={handleAddMaintenance} onUpdateMaintenance={handleUpdateMaintenance} onAddPlannedMaintenance={handleAddPlannedMaintenance} onUpdatePlannedMaintenance={handleUpdatePlannedMaintenance} onDeletePlannedMaintenance={handleDeletePlannedMaintenance} onRateMaintenance={handleRateMaintenance} />} />
                    <Route path="/reports" element={authUser ? <ReportsPage units={units} user={authUser} tickets={activeTickets} users={users} /> : <Navigate to="/login" />} />
                    <Route path="/users" element={authUser?.role === UserRole.ADMIN ? <UsersManagementPage users={users} currentUser={authUser} onAdd={handleAddUser} onDelete={handleDeleteUser} onUpdate={handleUpdateUser} /> : <Navigate to="/" />} />
                    <Route path="/register" element={authUser?.role === UserRole.ADMIN ? <RegisterPage onAdd={handleAddUnit} /> : <Navigate to="/" />} />
                    <Route path="/settings" element={authUser?.role === UserRole.ADMIN ? <SettingsPage /> : <Navigate to="/" />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </main>

                {!isPublicView && authUser && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-[60] no-print" style={{ zIndex: 60 }}>
                    <Link to="/" className="flex flex-col items-center">
                    <Thermometer className="w-6 h-6 text-[var(--theme-primary)]" />
                    <span className="text-[9px] font-black mt-1 uppercase text-[var(--theme-primary)] tracking-tighter">Início</span>
                    </Link>
                    <Link to="/reports" className="flex flex-col items-center">
                    <FileBarChart className="w-6 h-6 text-gray-300" />
                    <span className="text-[9px] font-black mt-1 uppercase text-gray-400 tracking-tighter">Relatórios</span>
                    </Link>
                    {authUser.role === UserRole.ADMIN ? (
                    <div className="w-14 relative flex justify-center">
                        <Link to="/register" className="absolute -top-10 flex items-center justify-center w-14 h-14 rounded-2xl shadow-xl border-4 border-white bg-[var(--theme-primary)] z-50 hover:scale-105 active:scale-95 transition-all">
                            <Plus className="w-6 h-6 text-white" />
                        </Link>
                    </div>
                    ) : (
                    <div className="w-14"></div>
                    )}
                    {authUser.role === UserRole.ADMIN ? (
                    <Link to="/settings" className="flex flex-col items-center">
                        <Settings className="w-6 h-6 text-gray-300" />
                        <span className="text-[9px] font-black mt-1 uppercase text-gray-400 tracking-tighter">Config</span>
                    </Link>
                    ) : (
                    <div className="w-12 h-6"></div>
                    )}
                    <button onClick={handleLogout} className="flex flex-col items-center">
                    <LogOut className="w-6 h-6 text-gray-300" />
                    <span className="text-[9px] font-black mt-1 uppercase text-gray-400 tracking-tighter">Sair</span>
                    </button>
                </div>
                )}

                <PrintQRCodeModal 
                isOpen={qrModalState.isOpen} 
                onClose={() => setQrModalState(s => ({ ...s, isOpen: false }))} 
                unit={qrModalState.unit} 
                allUnits={qrModalState.all ? units : []} 
                />

                {showProfileModal && authUser && (
                  <ProfileModal 
                    user={authUser} 
                    onClose={() => setShowProfileModal(false)} 
                    onUpdate={handleUpdateUser} 
                  />
                )}
            </div>
            </Router>
        )
  );
};

export default App;

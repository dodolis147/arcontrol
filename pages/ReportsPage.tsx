
import React, { useState, useMemo } from 'react';
import { 
  FileBarChart, 
  Filter, 
  FileDown, 
  Thermometer, 
  BarChart3, 
  ChevronRight,
  Star,
  Wrench,
  ClipboardList,
  Clock,
  AlertTriangle,
  Calendar,
  ShieldAlert,
  Info,
  CheckSquare,
  Share2
} from 'lucide-react';
import { ACUnit, User, UserRole, MaintenanceRecord, ServiceType, Ticket } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface ReportsPageProps {
  units: ACUnit[];
  user: User;
  tickets?: Ticket[];
  users?: User[];
}

const ReportsPage: React.FC<ReportsPageProps> = ({ units, user, tickets = [], users = [] }) => {
  const { appName } = useTheme();
  const [selectedClient, setSelectedClient] = useState<string>(user.role === UserRole.CLIENT ? (user.clientName || '') : '');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedTechnician, setSelectedTechnician] = useState<string>(
    user.role === UserRole.TECHNICIAN ? user.username : ''
  );

  const clients = useMemo(() => Array.from(new Set(units.map(u => u.clientName))), [units]);

  const technicians = useMemo(() => {
    const list: string[] = [];
    
    // Add all registered technicians from the users list
    if (users) {
      users.forEach(u => {
        if (u.role === UserRole.TECHNICIAN && u.username && !list.includes(u.username)) {
          list.push(u.username);
        }
      });
    }

    // Add any technicians registered on maintenance logs
    units.forEach(u => {
      u.history.forEach(r => {
        if (r.technician && !list.includes(r.technician)) {
          list.push(r.technician);
        }
      });
    });
    return list.sort();
  }, [units, users]);
  
  const filteredUnits = useMemo(() => {
    let result = units;
    if (user.role === UserRole.CLIENT) {
        result = result.filter(u => u.clientName === user.clientName);
    } else if (selectedClient) {
        result = result.filter(u => u.clientName === selectedClient);
    }
    return result;
  }, [units, selectedClient, user]);

  const allRecords = useMemo(() => {
    const list: { unit: ACUnit, record: MaintenanceRecord }[] = [];
    const isTechnician = user.role === UserRole.TECHNICIAN;
    const targetTech = user.username.toLowerCase().trim();

    filteredUnits.forEach(u => {
      u.history.forEach(r => {
        const matchesType = !selectedType || r.type === selectedType;
        
        // Match technician name loosely (lowercase / contains)
        const recordTech = (r.technician || '').toLowerCase().trim();
        const selectedTech = (selectedTechnician || '').toLowerCase().trim();
        const matchesTechnician = isTechnician 
          ? (recordTech === targetTech || recordTech.includes(targetTech) || targetTech.includes(recordTech))
          : (!selectedTechnician || 
             recordTech === selectedTech ||
             recordTech.includes(selectedTech) || 
             selectedTech.includes(recordTech));

        if (matchesType && matchesTechnician) {
          list.push({ unit: u, record: r });
        }
      });
    });
    return list.sort((a, b) => new Date(b.record.date).getTime() - new Date(a.record.date).getTime());
  }, [filteredUnits, selectedType, selectedTechnician, user]);

  const filteredTickets = useMemo(() => {
    let list = [...tickets];
    if (user.role === UserRole.CLIENT) {
      list = list.filter(t => t.clientName === user.clientName);
    } else if (selectedClient) {
      list = list.filter(t => t.clientName === selectedClient);
    }

    if (user.role === UserRole.TECHNICIAN) {
      list = list.filter(t => {
        const tTech = (t.technicianId || '').toLowerCase().trim();
        const me = user.username.toLowerCase().trim();
        const myId = user.id.toLowerCase().trim();
        return tTech === me || tTech === myId;
      });
    }

    if (user.role === UserRole.ADMIN && selectedTechnician) {
      list = list.filter(t => {
        const tTech = (t.technicianId || '').toLowerCase().trim();
        const selTech = selectedTechnician.toLowerCase().trim();
        return tTech === selTech || tTech.includes(selTech) || selTech.includes(tTech);
      });
    }

    if (selectedType) {
      const typeLower = selectedType.toLowerCase().trim();
      list = list.filter(t => {
        const desc = (t.description || '').toLowerCase();
        const sol = (t.solution || '').toLowerCase();
        
        if (desc.includes(typeLower) || sol.includes(typeLower)) return true;
        
        if (typeLower === 'corretiva') {
          if (desc.includes('corretiv') || sol.includes('corretiv') || desc.includes('conserto') || sol.includes('conserto') || desc.includes('repar') || sol.includes('repar')) return true;
        }
        if (typeLower === 'preventiva') {
          if (desc.includes('preventiv') || sol.includes('preventiv') || desc.includes('manutenção') || sol.includes('manutenção') || desc.includes('revis') || sol.includes('revis')) return true;
        }
        if (typeLower === 'limpeza') {
          if (desc.includes('limp') || sol.includes('limp') || desc.includes('higien') || sol.includes('higien')) return true;
        }
        if (typeLower === 'instalação') {
          if (desc.includes('instal') || sol.includes('instal') || desc.includes('monta') || sol.includes('monta')) return true;
        }
        return false;
      });
    }

    return list.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [tickets, user, selectedClient, selectedTechnician, selectedType]);

  const stats = useMemo(() => {
    const ratedRecords = allRecords.filter(r => r.record.rating && r.record.rating > 0);
    const avgRating = ratedRecords.length > 0 
      ? (ratedRecords.reduce((acc, r) => acc + (r.record.rating || 0), 0) / ratedRecords.length).toFixed(1)
      : '0.0';

    return {
      total: allRecords.length,
      preventive: allRecords.filter(r => r.record.type === ServiceType.PREVENTIVE).length,
      corrective: allRecords.filter(r => r.record.type === ServiceType.CORRECTIVE).length,
      cleaning: allRecords.filter(r => r.record.type === ServiceType.CLEANING).length,
      avgRating
    };
  }, [allRecords]);

  const handleShareGlobalWhatsApp = () => {
    const techName = user.role === UserRole.TECHNICIAN ? user.username : (selectedTechnician || 'Todos');
    const clientName = selectedClient || 'Todos os Clientes';
    
    const text = `📊 *${appName.toUpperCase()} - RESUMO DE MANUTENÇÕES* 📊\n\n` +
      `*Técnico:* ${techName}\n` +
      `*Cliente Filtro:* ${clientName}\n` +
      `*Data:* ${new Date().toLocaleDateString('pt-BR')}\n\n` +
      `*Estatísticas de Atendimento:*\n` +
      `• Total de Serviços: ${stats.total}\n` +
      `• Preventivas: ${stats.preventive}\n` +
      `• Corretivas: ${stats.corrective}\n` +
      `• Limpezas: ${stats.cleaning}\n` +
      `• Satisfação Média: ${stats.avgRating} / 5 ⭐\n\n` +
      `_Gerado por ${appName}_`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <>
      <div className="space-y-8 pb-20 animate-in fade-in duration-500 print:hidden">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Alterado bg-blue-600 para bg-purple-700 */}
          <div className="bg-purple-700 p-4 rounded-3xl shadow-xl shadow-purple-200">
            <FileBarChart className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-gray-900 leading-none">Relatórios</h1>
            <p className="text-gray-400 font-bold text-sm mt-1 uppercase tracking-widest">Análise de Performance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleShareGlobalWhatsApp} 
            className="p-4 bg-emerald-600 text-white rounded-2xl shadow-xl hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            title="Enviar Resumo p/ WhatsApp"
          >
            <Share2 className="w-5 h-5" />
            <span className="hidden sm:inline font-black text-xs uppercase tracking-widest">WhatsApp</span>
          </button>
        </div>
      </header>

      <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {/* Alterado text-blue-500 para text-purple-600 */}
            <Filter className="w-4 h-4 text-purple-600" />
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtros Avançados</h2>
          </div>
          {user.role === UserRole.TECHNICIAN && (
            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
              Apenas Seus Atendimentos
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Cliente */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Cliente</label>
            {user.role === UserRole.ADMIN ? (
              <select 
                // Alterado focus:border-blue-500 para focus:border-purple-500
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-black focus:border-purple-500 transition-all outline-none" 
                value={selectedClient} 
                onChange={e => setSelectedClient(e.target.value)}
              >
                <option value="">Todos os Clientes</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <div className="bg-gray-50 px-5 py-4 rounded-2xl flex items-center justify-between border-2 border-transparent h-[58px]">
                <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Acesso Perfil</span>
                <span className="text-sm font-black text-gray-800">{user.role}</span>
              </div>
            )}
          </div>

          {/* Tipo de Serviço */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tipo de Serviço</label>
            <select 
              // Alterado focus:border-blue-500 para focus:border-purple-500
              className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-black focus:border-purple-500 transition-all outline-none" 
              value={selectedType} 
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="">Todos os Tipos de Serviço</option>
              {Object.values(ServiceType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Técnico */}
          {user.role === UserRole.ADMIN ? (
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Técnico</label>
              <div className="flex gap-2">
                <select 
                  className="flex-1 px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-black focus:border-purple-500 transition-all outline-none" 
                  value={selectedTechnician} 
                  onChange={e => setSelectedTechnician(e.target.value)}
                >
                  <option value="">Todos os Técnicos</option>
                  {technicians.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {selectedTechnician && (
                  <div className="px-5 py-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl flex items-center justify-center gap-1.5 flex-shrink-0 animate-in zoom-in-95 duration-200" title="Satisfação Média">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-black text-yellow-800 uppercase tracking-wider">
                      {stats.avgRating}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : user.role === UserRole.TECHNICIAN ? (
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Técnico</label>
              <div className="bg-gray-50 px-5 py-4 rounded-2xl flex items-center justify-between border-2 border-transparent h-[58px]">
                <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Seu Perfil</span>
                <span className="text-sm font-black text-purple-700">{user.username} (Você)</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          // Alterado para roxo
          { label: 'Total', value: stats.total, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Preventivas', value: stats.preventive, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Corretivas', value: stats.corrective, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Limpezas', value: stats.cleaning, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <div key={i} className={`p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center ${stat.bg}`}>
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <div className="flex items-center gap-2">
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* SEÇÃO DE HISTÓRICO DE CHAMADOS DO CLIENTE (RETENÇÃO 6 MESES) */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-purple-50/50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-700" />
            <div>
              <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest block leading-3 animate-pulse">Armazenamento Temporário</span>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Histórico de Chamados Ocorridos</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-yellow-50 text-yellow-800 text-[10px] sm:text-xs font-semibold px-3 py-1.5 rounded-xl border border-yellow-250">
            <Info className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
            <span>Retenção de 6 meses (exclusão de chamados antigos automática)</span>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => {
              const getPriorityBadge = (p: string) => {
                switch (p) {
                  case 'Urgente': return 'bg-red-50 text-red-800 border-red-200';
                  case 'Alta': return 'bg-orange-50 text-orange-800 border-orange-200';
                  case 'Média': return 'bg-amber-50 text-amber-800 border-amber-200';
                  default: return 'bg-blue-50 text-blue-800 border-blue-200';
                }
              };

              const getStatusBadge = (s: string) => {
                switch (s) {
                  case 'Finalizado': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  case 'Em Atendimento': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
                  case 'Reagendado': return 'bg-purple-55 text-purple-800 border-purple-250';
                  default: return 'bg-blue-50 text-blue-800 border-blue-205';
                }
              };

              const getStripeColorClass = (p: string, s: string) => {
                if (s === 'Finalizado') return 'border-l-emerald-500 bg-emerald-50/5';
                switch (p) {
                  case 'Urgente': return 'border-l-red-500 bg-red-50/5';
                  case 'Alta': return 'border-l-orange-500 bg-orange-50/5';
                  case 'Média': return 'border-l-amber-500 bg-amber-50/5';
                  default: return 'border-l-blue-500 bg-blue-50/5';
                }
              };

              const stripeClass = getStripeColorClass(ticket.priority, ticket.status);

              return (
                <div key={ticket.id} className={`p-6 hover:bg-gray-50/55 transition-all border-l-[6px] ${stripeClass}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-bold text-xs flex-shrink-0">
                        #
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-gray-900">{ticket.id}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getPriorityBadge(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </div>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-wider mt-1">
                          Aberto em: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('pt-BR') : ticket.date} • Cliente: {ticket.clientName}
                        </p>
                      </div>
                    </div>
                    
                    {ticket.unitId && (
                      <div className="bg-gray-50 border border-gray-150 rounded-xl px-3 py-1.5 self-start md:self-auto flex flex-col">
                        <span className="text-[9px] font-black text-gray-450 uppercase tracking-widest block leading-3">Equipamento</span>
                        <span className="text-xs font-black text-gray-800">{ticket.unitId}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição do Problema</p>
                    <p className="text-sm font-bold text-gray-700 leading-relaxed">{ticket.description}</p>
                    


                    {ticket.technicalReport && (
                      <div className="mt-3 pt-3 border-t border-gray-200/60">
                        <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1">Relatório Técnico</p>
                        <p className="text-xs font-medium text-gray-650 italic leading-relaxed bg-white p-3 rounded-xl border border-gray-150">
                          {ticket.technicalReport}
                        </p>
                      </div>
                    )}

                    {ticket.photos && ticket.photos.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200/60">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Relatório Fotográfico</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {ticket.photos.map((photo, pIdx) => (
                            <img 
                              key={pIdx} 
                              src={photo} 
                              alt={`Foto do chamado - ${pIdx + 1}`} 
                              className="w-full aspect-video rounded-xl object-cover border border-gray-250 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Botões de Ação para o Chamado */}
                    <div className="mt-4 pt-4 border-t border-gray-200/60 flex flex-wrap gap-2">
                      <button 
                        onClick={() => {
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(`
                              <html>
                                <head>
                                  <title>Relatório de Chamado - #${ticket.id}</title>
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                                  <style>
                                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; }
                                    .header { border-bottom: 3px solid #7e22ce; padding-bottom: 15px; margin-bottom: 20px; }
                                    .title { font-size: 24px; font-weight: 950; color: #7e22ce; font-style: italic; margin: 0; }
                                    .subtitle { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; font-weight: bold; margin-top: 5px; }
                                    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; page-break-inside: avoid; }
                                    .meta-item label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; display: block; margin-bottom: 2px; }
                                    .meta-item value { font-weight: bold; font-size: 13px; word-break: break-all; }
                                    .content-section { margin-bottom: 20px; page-break-inside: avoid; }
                                    .content-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #4b5563; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-top: 0; margin-bottom: 10px; }
                                    .content-body { font-size: 13px; color: #374151; white-space: pre-wrap; word-break: break-word; }
                                    .photo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px; }
                                    .photo-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fff; text-align: center; page-break-inside: avoid; }
                                    .photo-item img { max-width: 100%; height: auto; max-height: 250px; object-fit: contain; border-radius: 6px; display: block; margin: 0 auto 8px auto; }
                                    .photo-caption { font-size: 10px; color: #666; font-weight: bold; margin-top: 4px; word-break: break-word; }
                                    .footer { font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 30px; }
                                    
                                    @media print {
                                      @page { size: auto; margin: 15mm; }
                                      body { padding: 0; max-width: 100%; }
                                      .meta-grid { grid-template-columns: 1fr 1fr; background: transparent; border: none; padding: 0; gap: 10px; }
                                      .meta-item { border-bottom: 1px solid #eee; padding-bottom: 5px; }
                                      .photo-grid { grid-template-columns: 1fr 1fr; }
                                      .photo-item { border: none; padding: 0; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <h1 class="title">${appName}</h1>
                                    <div class="subtitle">Relatório Técnico de Chamado Ocorrido</div>
                                  </div>
                                  
                                  <div class="meta-grid">
                                    <div class="meta-item"><label>ID Chamado</label><value>#${ticket.id}</value></div>
                                    <div class="meta-item"><label>Cliente</label><value>${ticket.clientName}</value></div>
                                    <div class="meta-item"><label>Equipamento ID</label><value>${ticket.unitId || 'Não informado'}</value></div>
                                    <div class="meta-item"><label>Data de Abertura</label><value>${ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('pt-BR') : ticket.date}</value></div>
                                    <div class="meta-item"><label>Status</label><value>${ticket.status}</value></div>
                                    <div class="meta-item"><label>Prioridade</label><value>${ticket.priority}</value></div>
                                  </div>

                                  <div class="content-section">
                                    <h3>Descrição do Problema</h3>
                                    <div class="content-body">${ticket.description}</div>
                                  </div>


                                  ${ticket.technicalReport ? `
                                  <div class="content-section">
                                    <h3>Parecer Técnico</h3>
                                    <div class="content-body">${ticket.technicalReport}</div>
                                  </div>
                                  ` : ''}

                                  ${ticket.photos && ticket.photos.length > 0 ? `
                                  <div class="content-section">
                                    <h3>Relatório Fotográfico</h3>
                                    <div class="photo-grid">
                                      ${ticket.photos.map((photo, pIdx) => `
                                        <div class="photo-item">
                                          <img src="${photo}" referrerpolicy="no-referrer" alt="Foto ${pIdx + 1}" />
                                          <div class="photo-caption">${ticket.photoDescriptions?.[pIdx] || `Foto de Registro #${pIdx + 1}`}</div>
                                        </div>
                                      `).join('')}
                                    </div>
                                  </div>
                                  ` : ''}

                                  <div class="footer">Relatório de Chamado - Sistema ${appName} - ${new Date().toLocaleDateString('pt-BR')}</div>
                                  
                                  <script>
                                    window.onload = function() {
                                      window.print();
                                      setTimeout(function() { window.close(); }, 500);
                                    }
                                  </script>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        title="Imprimir Ficha do Chamado em PDF"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Ficha (PDF)
                      </button>
                      <button 
                        onClick={() => {
                          const text = `🎫 *${appName.toUpperCase()} - DETALHES DO CHAMADO* 🎫\n\n` +
                            `*Ticket:* #${ticket.id}\n` +
                            `*Cliente:* ${ticket.clientName}\n` +
                            (ticket.unitId ? `*Equipamento ID:* ${ticket.unitId}\n` : '') +
                            `*Data de Abertura:* ${ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('pt-BR') : ticket.date}\n` +
                            `*Status:* ${ticket.status}\n` +
                            `*Prioridade:* ${ticket.priority}\n\n` +
                            `*Descrição do Problema:* \n${ticket.description}\n\n` +
                            (ticket.technicalReport ? `*Relatório Técnico:* \n${ticket.technicalReport}\n\n` : '') +
                            `_Gerado via ${appName}_`;
                            
                          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        title="Enviar Chamado p/ WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Enviar p/ WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-20 text-center">
              <ClipboardList className="w-12 h-12 text-gray-250 mx-auto mb-3" />
              <p className="text-gray-400 font-bold uppercase text-xs tracking-[0.2em]">Nenhum chamado disponível nos últimos 6 meses</p>
              <p className="text-gray-300 text-[10px] font-semibold mt-1">Registros antigos são limpos automaticamente após 180 dias.</p>
            </div>
          )}
        </div>
      </div>
      </div>
      
      {/* Hidden view for browser printing */}
      <div id="report-printable-area" className="hidden p-8 sm:p-10 bg-white text-black font-sans">
        <header className="flex justify-between items-center border-b-4 border-purple-700 pb-6 mb-8">
          <div>
            {/* Alterado para roxo */}
            <h1 className="text-4xl font-black text-purple-800 italic tracking-tighter">{appName}</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Relatório Analítico de Manutenção</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-600">Gerado: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </header>
        <div className="mb-10 p-6 bg-gray-50 border border-gray-200 rounded-2xl print-grid-3 md:grid md:grid-cols-3 gap-10">
           <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Cliente</p><p className="font-bold">{selectedClient || 'Relatório Global'}</p></div>
           <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Satisfação Média</p><p className="font-bold text-yellow-600">{stats.avgRating} Estrelas</p></div>
           <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Volume</p><p className="font-bold">{stats.total} Atendimentos</p></div>
        </div>
        {filteredTickets.length > 0 && (
          <>
            <div className="mt-2 mb-6 border-b-2 border-gray-300 pb-2">
              <h2 className="text-xl font-bold text-gray-800">Relatório Histórico de Chamados Ocorridos</h2>
              <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Chamados registrados (Política de Retenção de 6 Meses)</p>
            </div>
            <table className="w-full border-collapse print-table">
              <thead>
                <tr className="bg-purple-700 text-white text-left text-[9px] font-black uppercase">
                  <th className="px-4 py-3">ID Chamado</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[11px]">
                {filteredTickets.map((t, i) => {
                  let rowStripe = 'border-l-4 border-l-blue-500';
                  if (t.status === 'Finalizado') rowStripe = 'border-l-4 border-l-emerald-500';
                  else if (t.priority === 'Urgente') rowStripe = 'border-l-4 border-l-red-500';
                  else if (t.priority === 'Alta') rowStripe = 'border-l-4 border-l-orange-500';
                  else if (t.priority === 'Média') rowStripe = 'border-l-4 border-l-amber-500';

                  return (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'} ${rowStripe}`}>
                      <td className="px-4 py-4 font-black">{t.id}</td>
                      <td className="px-4 py-4 font-bold">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : t.date}</td>
                      <td className="px-4 py-4 font-bold">{t.status}</td>
                      <td className="px-4 py-4 font-black">{t.priority}</td>
                      <td className="px-4 py-4 text-gray-700 break-words max-w-[200px]">
                        <p className="font-bold">{t.description}</p>
                        
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-printable-area, #report-printable-area * { visibility: visible; }
          #report-printable-area { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            display: block !important; 
            background: white !important;
            margin: 0 !important;
          }
          .print-grid-3 {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 1.5rem !important;
          }
          .print-table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
          }
          .print-table th, .print-table td {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
};

export default ReportsPage;

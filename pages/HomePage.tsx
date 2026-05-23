import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useUnits } from "../contexts/UnitsContext";
import { useTickets } from "../contexts/TicketsContext";
import { useImageUpload } from "../src/hooks/useImageUpload";
import {
  Search,
  Scan,
  Thermometer,
  ChevronRight,
  Printer,
  Bell,
  BellOff,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  X,
  AlertCircle,
  Trash2,
  Pencil,
  CheckCircle2,
  ChevronLeft,
  Activity,
  QrCode,
  Star,
  MapPin,
  User as UserIcon,
  Wrench,
  PlayCircle,
  CheckSquare,
  CalendarClock,
  Calendar,
  History,
  Building2,
  Camera,
  FileText,
  Upload,
  ArrowRightLeft,
  Fan,
  LayoutList,
  LayoutGrid,
  Archive,
  ArchiveRestore,
  AirVent,
  Clock,
  Save,
} from "lucide-react";
import {
  ACUnit,
  User,
  UserRole,
  Ticket,
  UnitStatus,
  ServiceType,
  MaintenanceReminder,
} from "../types";
import QRScannerModal from "../components/QRScannerModal";
import RemindersModal from "../components/RemindersModal";
import { TicketCountdown } from "../components/TicketCountdown";
import { supabase } from '../services/supabase';
import imageCompression from 'browser-image-compression';

interface HomePageProps {
  units: ACUnit[];
  user: User;
  users?: User[];
  tickets: Ticket[];
  onOpenQR: (u: ACUnit) => void;
  onOpenAllQR: () => void;
  onAddTicket: (t: Ticket) => Promise<void> | void;
  onUpdateTicket: (id: string, data: Partial<Ticket>) => void;
  onDeleteTicket: (id: string) => void;
  onAddUnit: (u: ACUnit) => Promise<void> | void;
  onUpdateUnit: (id: string, data: Partial<ACUnit>) => Promise<void> | void;
  onAddPlannedMaintenance: (
    unitId: string,
    planned: any,
  ) => Promise<void> | void;
  reminders: MaintenanceReminder[];
  onAcceptReminder: (id: string, date: string) => void;
  onRemoveReminder: (id: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  units,
  user,
  users = [],
  tickets,
  onOpenQR,
  onOpenAllQR,
  onAddTicket,
  onUpdateTicket,
  onDeleteTicket,
  onAddUnit,
  onUpdateUnit,
  onAddPlannedMaintenance,
  reminders,
  onAcceptReminder,
  onRemoveReminder,
}) => {
  const { appName } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [priorityFilter, setPriorityFilter] = useState<string>("Todas");
  const [clientActiveTab, setClientActiveTab] = useState<"tickets" | "equipments">("tickets");
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState<string>("Todos");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [uploading, setUploading] = useState(false);
  const { uploadImages, uploading: isImageUploading } = useImageUpload('maintenance-photos');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    const files = Array.from(e.target.files) as File[];
    
    try {
      const uploadedUrls = await uploadImages(files);
      
      setTicketPhotos(prev => [...prev, ...uploadedUrls]);
      setTicketPhotoDescriptions(prev => [...prev, ...files.map(() => '')]);
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleArchiveTab = (archive: boolean) => {
    setShowArchived(archive);
    setVisibleCount(50);
    if (!archive && statusFilter === "Finalizado") {
      setStatusFilter("Todos");
    } else if (archive && statusFilter !== "Todos" && statusFilter !== "Finalizado") {
      setStatusFilter("Todos");
    }
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    if (val === "Finalizado") {
      setShowArchived(true);
    } else if (val !== "Todos") {
      setShowArchived(false);
    }
  };

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketFlowStep, setTicketFlowStep] = useState<
    "selection" | "new-unit" | "problem" | "success"
  >("selection");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [lastCreatedTicket, setLastCreatedTicket] = useState<Ticket | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPriority, setTicketPriority] = useState<
    "Baixa" | "Média" | "Alta" | "Urgente"
  >("Média");
  const [ticketStatus, setTicketStatus] = useState<
    "Aberto" | "Em Atendimento" | "Finalizado" | "Reagendado"
  >("Aberto");
  const [ticketDate, setTicketDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [ticketPhotos, setTicketPhotos] = useState<string[]>([]);
  const [ticketPhotoDescriptions, setTicketPhotoDescriptions] = useState<
    string[]
  >([]);
  const [ticketTechnicalReport, setTicketTechnicalReport] = useState("");

  const [ratingTicket, setRatingTicket] = useState<Ticket | null>(null);
  const [ratingValue, setRatingValue] = useState(0);

  const [reportTicket, setReportTicket] = useState<Ticket | null>(null);

  const [deleteTicketConfirmation, setDeleteTicketConfirmation] =
    useState<Ticket | null>(null);

  const [rescheduleTicket, setRescheduleTicket] = useState<Ticket | null>(null);
  const [rescheduleData, setRescheduleData] = useState({
    date: "",
    reason: "",
  });

  const [finishingTicket, setFinishingTicket] = useState<Ticket | null>(null);
  const [finishStep, setFinishStep] = useState(0);
  const [finishData, setFinishData] = useState<{
    solution: string;
    technicalReport: string;
    photos: string[];
    photoDescriptions: string[];
  }>({ solution: "", technicalReport: "", photos: [], photoDescriptions: [] });

  const [transferTicket, setTransferTicket] = useState<Ticket | null>(null);
  const [selectedTransferTech, setSelectedTransferTech] = useState("");

  const [newUnitData, setNewUnitData] = useState({
    brand: "",
    btu: "",
    location: "",
    serialNumber: "",
  });

  const [maintenanceAlerts, setMaintenanceAlerts] = useState<
    { unitId: string; unitName: string; date: string; daysLeft: number }[]
  >([]);

  const [remindMaintenanceTicket, setRemindMaintenanceTicket] =
    useState<Ticket | null>(null);
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);

  const [notifiedTickets, setNotifiedTickets] = useState<string[]>(() => {
    const saved = localStorage.getItem("arcontrol_notified_tickets");
    return saved ? JSON.parse(saved) : [];
  });

  const [ticketViewMode, setTicketViewMode] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem("arcontrol_ticket_view_mode");
    return (saved as "list" | "grid") || "grid";
  });

  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (location.state?.searchTerm) {
      setSearchTerm(location.state.searchTerm);
    }
  }, [location.state]);

  const myUnits = useMemo(() => {
    if (user.role === UserRole.CLIENT) {
      return units.filter((u) => u.clientName === user.clientName);
    }
    return units;
  }, [units, user]);

  const filteredClientUnits = useMemo(() => {
    let result = myUnits;

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.id.toLowerCase().includes(s) ||
          u.brand.toLowerCase().includes(s) ||
          (u.model && u.model.toLowerCase().includes(s)) ||
          (u.serialNumber && u.serialNumber.toLowerCase().includes(s)) ||
          u.location.toLowerCase().includes(s) ||
          (u.department && u.department.toLowerCase().includes(s)),
      );
    }

    if (equipmentStatusFilter !== "Todos") {
      result = result.filter((u) => u.status === equipmentStatusFilter);
    }

    return result;
  }, [myUnits, searchTerm, equipmentStatusFilter]);

  // Effect to calculate maintenance alerts
  React.useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alerts: {
      unitId: string;
      unitName: string;
      date: string;
      daysLeft: number;
    }[] = [];

    myUnits.forEach((unit) => {
      unit.planned.forEach((p) => {
        const expectedDate = new Date(p.expectedDate);
        const diffTime = expectedDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Alert if maintenance is in exactly 5 days or less (but not in the past)
        if (diffDays >= 0 && diffDays <= 5) {
          alerts.push({
            unitId: unit.id,
            unitName: `${unit.brand} - ${unit.location}`,
            date: p.expectedDate,
            daysLeft: diffDays,
          });
        }
      });
    });

    setMaintenanceAlerts(alerts.sort((a, b) => a.daysLeft - b.daysLeft));
  }, [myUnits]);

  const avgSatisfaction = useMemo(() => {
    let allRatings: number[] = [];
    myUnits.forEach((u) =>
      u.history.forEach((r) => {
        if (r.rating) allRatings.push(r.rating);
      }),
    );
    tickets.forEach((t) => {
      if (t.rating) allRatings.push(t.rating);
    });

    if (allRatings.length === 0) return null;
    return (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(
      1,
    );
  }, [myUnits, tickets]);

  const filteredUnits = useMemo(
    () =>
      myUnits.filter(
        (u) =>
          u.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.brand.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [myUnits, searchTerm],
  );

  const availableTechnicians = useMemo(() => {
    return users.filter((u) => u.role === UserRole.TECHNICIAN);
  }, [users]);

  const handleOpenTicketModal = () => {
    setEditingTicket(null);
    setTicketDescription("");
    setTicketPriority("Média");
    setTicketStatus("Aberto");
    setTicketDate(new Date().toISOString().split("T")[0]);
    setTicketPhotos([]);
    setTicketPhotoDescriptions([]);
    setTicketFlowStep("selection");
    setSelectedUnitId(null);
    setLastCreatedTicket(null);
    setNewUnitData({ brand: "", btu: "", location: "", serialNumber: "" });
    setIsTicketModalOpen(true);
    setIsSubmitting(false);
  };

  const handleEditTicketModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setTicketDescription(ticket.description);
    setTicketPriority(ticket.priority);
    setTicketStatus(ticket.status);
    setTicketDate(ticket.date);
    setTicketPhotos(ticket.photos || []);
    setTicketPhotoDescriptions(ticket.photoDescriptions || []);
    setTicketTechnicalReport(ticket.technicalReport || "");
    setTicketFlowStep("problem");
    setIsTicketModalOpen(true);
    setIsSubmitting(false);
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (
        editingTicket &&
        user.role === UserRole.TECHNICIAN &&
        editingTicket.status !== "Aberto" &&
        editingTicket.technicianId !== user.username
      ) {
        alert("Você não tem permissão para editar este chamado.");
        setIsSubmitting(false);
        return;
      }

      let targetUnitId = selectedUnitId;

      if (
        ticketFlowStep === "new-unit" ||
        (ticketFlowStep === "problem" && !selectedUnitId && !editingTicket)
      ) {
        if (newUnitData.brand) {
          const newId = `AC-${Math.floor(Math.random() * 9000) + 1000}`;
          const newUnit: ACUnit = {
            id: newId,
            clientName: user.clientName || "Geral",
            brand: newUnitData.brand,
            btu: parseInt(newUnitData.btu) || 0,
            location: newUnitData.location,
            serialNumber: newUnitData.serialNumber,
            regional: "Salvador",
            installDate: new Date().toISOString().split("T")[0],
            status: UnitStatus.MAINTENANCE_REQUIRED,
            history: [],
            planned: [],
            department: "",
            model: "",
          };
          await onAddUnit(newUnit);
          targetUnitId = newId;
        }
      }

      if (editingTicket) {
        const isConcluido = ticketStatus === "Finalizado";
        onUpdateTicket(editingTicket.id, {
          description: ticketDescription,
          priority: ticketPriority,
          status: ticketStatus,
          date: ticketDate,
          photos: ticketPhotos,
          photoDescriptions: ticketPhotoDescriptions,
          technicalReport: ticketTechnicalReport,
          archived: isConcluido,
        });
        setIsTicketModalOpen(false);
      } else {
        const today = new Date().toISOString().split("T")[0];
        if (ticketDate < today) {
          alert("Não é possível abrir chamados com data retroativa.");
          setIsSubmitting(false);
          return;
        }

        const newTicket: Ticket = {
          id: `TK-${Math.floor(Math.random() * 9000) + 1000}`,
          unitId: targetUnitId || undefined,
          clientName: user.clientName || "Geral",
          description: ticketDescription,
          date: ticketDate,
          status: "Aberto",
          priority: ticketPriority,
          openedAt: new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          photos: ticketPhotos,
          photoDescriptions: ticketPhotoDescriptions,
          technicalReport: ticketTechnicalReport,
        };
        await onAddTicket(newTicket);
        setLastCreatedTicket(newTicket);
        setTicketFlowStep("success");
      }
    } catch (error) {
      console.error("Erro ao salvar chamado:", error);
      alert("Erro ao processar solicitação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotifyTechnician = (ticket: Ticket) => {
    if (notifiedTickets.includes(ticket.id)) return;

    const techPhone =
      localStorage.getItem("arcontrol_wa_central") || "71988638342";
    const message = `*NOVO CHAMADO ABERTO - ${appName}*\n\n*ID do Chamado:* ${ticket.id}\n*Equipamento:* ${ticket.unitId || "Não Vinculado"}\n*Cliente:* ${ticket.clientName}\n*Prioridade:* ${ticket.priority}\n*Descrição:* ${ticket.description}\n*Data de Previsão:* ${ticket.date}\n\n_Por favor, verifique o painel administrativo._`;
    window.open(
      `https://wa.me/${techPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );

    const updatedNotified = [...notifiedTickets, ticket.id];
    setNotifiedTickets(updatedNotified);
    localStorage.setItem(
      "arcontrol_notified_tickets",
      JSON.stringify(updatedNotified),
    );
  };

  const toggleTicketViewMode = () => {
    const newMode = ticketViewMode === "grid" ? "list" : "grid";
    setTicketViewMode(newMode);
    localStorage.setItem("arcontrol_ticket_view_mode", newMode);
  };

  const handleAcceptTicket = (ticket: Ticket) => {
    onUpdateTicket(ticket.id, {
      status: "Em Atendimento",
      technicianId: user.username,
    });
  };

  const handleRemindUser = (ticket: Ticket) => {
    setRemindMaintenanceTicket(ticket);
    // Default to 6 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    setNextMaintenanceDate(d.toISOString().split("T")[0]);
  };

  const handleConfirmMaintenanceReminder = async () => {
    if (
      remindMaintenanceTicket &&
      remindMaintenanceTicket.unitId &&
      nextMaintenanceDate
    ) {
      const unit = units.find((u) => u.id === remindMaintenanceTicket.unitId);
      if (unit) {
        const newPlanned = {
          id: `P-${Math.floor(Math.random() * 9000) + 1000}`,
          type: ServiceType.PREVENTIVE,
          description: "Manutenção Preventiva Agendada pelo Administrador",
          expectedDate: nextMaintenanceDate,
        };
        await onAddPlannedMaintenance(unit.id, newPlanned);
        alert(
          `Nova manutenção agendada para ${nextMaintenanceDate.split("-").reverse().join("/")}. O cliente será notificado quando faltarem 5 dias.`,
        );
        setRemindMaintenanceTicket(null);
      }
    }
  };

  const handleOpenTransferModal = (ticket: Ticket) => {
    setTransferTicket(ticket);
    setSelectedTransferTech("");
  };

  const handleTransferConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferTicket && selectedTransferTech) {
      onUpdateTicket(transferTicket.id, {
        technicianId: selectedTransferTech,
        isTransferred: true
      });
      setTransferTicket(null);
      setSelectedTransferTech("");
    }
  };

  const handleOpenFinishModal = (ticket: Ticket) => {
    setFinishingTicket(ticket);
    setFinishStep(0);
    setFinishData({
      solution: ticket.solution || "",
      technicalReport: ticket.technicalReport || ticket.solution || "",
      photos: ticket.photos || [],
      photoDescriptions: ticket.photoDescriptions || [],
    });
  };

  const handleSaveDraft = () => {
    if (finishingTicket) {
      onUpdateTicket(finishingTicket.id, {
        solution: finishData.technicalReport,
        technicalReport: finishData.technicalReport,
        photos: finishData.photos,
        photoDescriptions: finishData.photoDescriptions,
      });
      alert(
        "Relatório técnico salvo com sucesso! O chamado continuará aberto.",
      );
      setFinishingTicket(null);
      setFinishData({
        solution: "",
        technicalReport: "",
        photos: [],
        photoDescriptions: [],
      });
    }
  };

  const handleConfirmFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (finishingTicket) {
      const techReport = finishData.technicalReport.trim();

      if (!techReport) {
        alert("O Relatório Técnico é obrigatório para concluir o serviço!");
        return;
      }

      try {
        onUpdateTicket(finishingTicket.id, {
          status: "Finalizado",
          solution: techReport,
          technicalReport: techReport,
          photos: finishData.photos,
          photoDescriptions: finishData.photoDescriptions,
          finishedAt: new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          archived: true,
        });
      } catch (error) {
        console.error("Erro ao finalizar chamado:", error);
        alert("Erro ao encerrar chamado. Tente novamente.");
        return;
      }
      setFinishingTicket(null);
      setFinishData({
        solution: "",
        technicalReport: "",
        photos: [],
        photoDescriptions: [],
      });
    }
  };

  const handleDeleteTicketConfirm = () => {
    if (deleteTicketConfirmation) {
      onDeleteTicket(deleteTicketConfirmation.id);
      setDeleteTicketConfirmation(null);
    }
  };

  const handleRateTicket = () => {
    if (ratingTicket && ratingValue > 0) {
      onUpdateTicket(ratingTicket.id, {
        rating: ratingValue,
      });
      setRatingTicket(null);
      setRatingValue(0);
    }
  };

  const handleOpenReschedule = (ticket: Ticket) => {
    setRescheduleTicket(ticket);
    setRescheduleData({
      date: ticket.date,
      reason: ticket.rescheduleReason || "",
    });
  };

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (rescheduleTicket && rescheduleData.date && rescheduleData.reason) {
      onUpdateTicket(rescheduleTicket.id, {
        status: "Reagendado",
        date: rescheduleData.date,
        rescheduleReason: rescheduleData.reason,
      });
      setRescheduleTicket(null);
      setRescheduleData({ date: "", reason: "" });
    }
  };

  const sortedTickets = useMemo(() => {
    let filtered = tickets;

    // 0. Archive filtering
    if (showArchived) {
      filtered = filtered.filter(
        (t) => t.archived === true || t.status === "Finalizado",
      );
    } else {
      filtered = filtered.filter(
        (t) => t.archived !== true && t.status !== "Finalizado",
      );
    }

    // 1. Role-based filtering
    if (user.role === UserRole.CLIENT) {
      filtered = filtered.filter((t) => t.clientName === user.clientName);
    } else if (user.role === UserRole.TECHNICIAN) {
      const todayDate = new Date().toISOString().split("T")[0];
      filtered = filtered.filter(
        (t) => (t.status === "Aberto" || t.technicianId === user.username) && t.date === todayDate,
      );
    }

    // 2. Status filter
    if (statusFilter !== "Todos") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    // 3. Priority filter
    if (priorityFilter !== "Todas") {
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    }

    // 4. Search term filter (on tickets too)
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.id.toLowerCase().includes(s) ||
          t.clientName.toLowerCase().includes(s) ||
          t.description.toLowerCase().includes(s) ||
          (t.technicianId && t.technicianId.toLowerCase().includes(s)) ||
          (t.date && t.date.includes(s)) ||
          (t.status && t.status.toLowerCase().includes(s)) ||
          (t.unitId && t.unitId.toLowerCase().includes(s)),
      );
    }

    return [...filtered].sort((a, b) => {
      if (showArchived) {
        // Sort by date DESC for archived
        const dateA = new Date(a.createdAt || a.date).getTime();
        const dateB = new Date(b.createdAt || b.date).getTime();
        return dateB - dateA;
      }

      const order = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
      if (a.status === "Finalizado" && b.status !== "Finalizado") return 1;
      if (b.status === "Finalizado" && a.status !== "Finalizado") return -1;

      const pA = order[a.priority as keyof typeof order] || 4;
      const pB = order[b.priority as keyof typeof order] || 4;
      return pA - pB;
    });
  }, [tickets, user, statusFilter, priorityFilter, searchTerm, showArchived]);
  
  const visibleTickets = useMemo(() => sortedTickets.slice(0, visibleCount), [sortedTickets, visibleCount]);

  const getPriorityStyles = (priority: string, status: string) => {
    if (status === "Finalizado")
      return "border-gray-100 bg-gray-50/50 opacity-60";
    if (status === "Em Atendimento")
      return "border-orange-300 bg-orange-50 shadow-orange-100 ring-1 ring-orange-200";
    if (status === "Reagendado")
      return "border-indigo-300 bg-indigo-50 shadow-indigo-100";

    if (status === "Aberto") {
      // Cores bem mais fortes e pulsantes para chamados em aberto
      switch (priority) {
        case "Urgente":
          return "border-red-600 bg-red-100 shadow-xl shadow-red-200 animate-alert-pulsing ring-4 ring-red-500/50 border-opacity-100";
        case "Alta":
          return "border-orange-600 bg-orange-100 shadow-xl shadow-orange-200 animate-alert-pulsing ring-4 ring-orange-500/50 border-opacity-100";
        case "Média":
          return "border-blue-600 bg-blue-100 shadow-lg shadow-blue-200 animate-status-pulse-blue ring-4 ring-blue-500/40 border-opacity-100";
        case "Baixa":
          return "border-emerald-600 bg-emerald-100 shadow-lg shadow-emerald-200 animate-status-pulse-green ring-4 ring-emerald-500/40 border-opacity-100";
        default:
          return "border-gray-400 bg-gray-100 animate-pulse";
      }
    }

    let baseStyles = "";
    switch (priority) {
      case "Urgente":
        baseStyles = "border-red-600 bg-red-50 shadow-red-200";
        break;
      case "Alta":
        baseStyles = "border-orange-500 bg-orange-50 shadow-orange-100";
        break;
      case "Média":
        baseStyles =
          "border-[var(--theme-primary)] bg-[var(--theme-primary-light)] shadow-sm";
        break;
      case "Baixa":
        baseStyles = "border-emerald-500 bg-emerald-50 shadow-emerald-100";
        break;
      default:
        baseStyles = "border-gray-100 bg-white shadow-gray-100";
        break;
    }

    return baseStyles;
  };

  const getPriorityBadgeStyles = (priority: string, status: string) => {
    if (status === "Finalizado")
      return "bg-emerald-500 text-white shadow-lg shadow-emerald-100 px-4 py-1.5 rounded-xl";
    if (status === "Em Atendimento")
      return "bg-orange-600 text-white shadow-lg shadow-orange-100 px-4 py-1.5 rounded-xl animate-pulse";
    if (status === "Reagendado")
      return "bg-indigo-600 text-white shadow-lg shadow-indigo-100 px-4 py-1.5 rounded-xl";
    if (status === "Aberto") {
      switch (priority) {
        case "Urgente":
          return "bg-red-600 text-white shadow-lg shadow-red-100 px-4 py-1.5 rounded-xl";
        case "Alta":
          return "bg-orange-500 text-white shadow-lg shadow-orange-100 px-4 py-1.5 rounded-xl";
        case "Média":
          return "bg-[var(--theme-primary)] text-white shadow-lg shadow-blue-100 px-4 py-1.5 rounded-xl";
        case "Baixa":
          return "bg-emerald-500 text-white shadow-lg shadow-emerald-100 px-4 py-1.5 rounded-xl";
        default:
          return "bg-gray-400 text-white px-4 py-1.5 rounded-xl";
      }
    }
    return "bg-gray-400 text-white px-4 py-1.5 rounded-xl";
  };

  const getUnitStatusStyles = (status: UnitStatus) => {
    switch (status) {
      case UnitStatus.OPERATIONAL:
        return "border-green-200 bg-green-50/30 animate-status-pulse-green";
      case UnitStatus.MAINTENANCE_REQUIRED:
      case UnitStatus.AWAITING_PARTS:
        return "border-orange-200 bg-orange-50/30 animate-status-pulse-orange";
      case UnitStatus.STOPPED:
        return "border-red-200 bg-red-50/30 animate-status-pulse-red";
      case UnitStatus.EQUIPAMENTO:
      default:
        return "border-blue-200 bg-blue-50/30 animate-status-pulse-blue";
    }
  };

  const getUnitStatusBadgeStyles = (status: UnitStatus) => {
    switch (status) {
      case UnitStatus.OPERATIONAL:
        return "bg-green-100 text-green-700";
      case UnitStatus.MAINTENANCE_REQUIRED:
      case UnitStatus.AWAITING_PARTS:
        return "bg-orange-100 text-orange-700";
      case UnitStatus.STOPPED:
        return "bg-red-100 text-red-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getTicketOpenedTime = (ticket: Ticket) => {
    if (ticket.openedAt) return ticket.openedAt;
    if (ticket.createdAt) {
      const date = new Date(ticket.createdAt);
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--theme-text)] tracking-tighter">
            Olá,{" "}
            <span className="capitalize text-[var(--theme-primary)]">
              {user.username}
            </span>
            !
          </h1>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">
            Painel de Gestão •{" "}
            {user.role === "ADMIN"
              ? "Administrador"
              : user.role === "TECHNICIAN"
                ? "Técnico"
                : "Cliente"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative p-3 bg-white hover:bg-emerald-50/50 rounded-2xl border border-gray-150 hover:border-emerald-200 shadow-sm transition-all group flex items-center justify-center"
            title="Notificações e Alertas (WhatsApp)"
          >
            <MessageCircle
              className={`w-6 h-6 transition-transform group-hover:scale-110 ${maintenanceAlerts.length > 0 ? "text-emerald-500 fill-emerald-100 animate-swing" : "text-[#25D366] fill-[#25D366]/10"}`}
            />
            {myUnits.flatMap((u) => u.planned).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {myUnits.flatMap((u) => u.planned).length}
              </span>
            )}
          </button>
          {reminders.filter(r => r.status === 'PENDING').length > 0 && (
            <button
              onClick={() => setIsRemindersModalOpen(true)}
              className="relative p-3 bg-white rounded-2xl border border-gray-150 shadow-sm transition-all group flex items-center justify-center animate-pulse"
              title="Lembretes de Manutenção"
            >
              <Calendar className="w-6 h-6 text-blue-500" />
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {reminders.filter(r => r.status === 'PENDING').length}
              </span>
            </button>
          )}
          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Maintenance Alerts Section */}
      {maintenanceAlerts.length > 0 && (
        <section className="px-2">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-[2.5rem] p-6 animate-maintenance-alert">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-200">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black text-orange-900 tracking-tight italic">
                  Lembrete de Manutenção!
                </h3>
                <p className="text-orange-700/70 text-[10px] font-black uppercase tracking-widest">
                  Atenção aos prazos preventivos
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {maintenanceAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-orange-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-black text-xs">
                      {alert.daysLeft}d
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">
                        {alert.unitName}
                      </p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Próxima: {alert.date.split("-").reverse().join("/")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/unit/${alert.unitId}`)}
                    className="p-2 bg-orange-500 text-white rounded-xl shadow-md active:scale-90 transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Client Section Tabs */}
      {user.role === UserRole.CLIENT && (
        <section className="flex justify-start border-b border-gray-100 pb-2 px-2 gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-gray-150 shadow-sm w-full max-w-sm">
            <button
              onClick={() => {
                setClientActiveTab("tickets");
                setSearchTerm("");
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                clientActiveTab === "tickets"
                  ? "bg-[var(--theme-primary)] text-white shadow-md shadow-emerald-100"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FileText className="w-4 h-4" />
              Chamados
            </button>
            <button
              onClick={() => {
                setClientActiveTab("equipments");
                setSearchTerm("");
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                clientActiveTab === "equipments"
                  ? "bg-[var(--theme-primary)] text-white shadow-md shadow-emerald-100"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              <AirVent className="w-4 h-4" />
              Meus Equipamentos
            </button>
          </div>
        </section>
      )}

      {/* Search & Actions */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[var(--theme-primary)] transition-colors" />
            <input
              type="text"
              placeholder={
                user.role === UserRole.CLIENT && clientActiveTab === "equipments"
                  ? "Buscar equipamentos por marca, modelo, local..."
                  : "Buscar por ID, Cliente ou Marca..."
              }
              className="w-full pl-14 pr-6 py-5 bg-white border-2 border-gray-100 rounded-[2rem] outline-none font-bold text-[var(--theme-text)] focus:border-[var(--theme-primary)] transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-8 py-5 bg-[var(--theme-primary)] text-white rounded-[2rem] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all w-full md:w-auto"
          >
            <Scan className="w-6 h-6" />{" "}
            <span className="hidden sm:inline">Escanear QR</span>
          </button>
        </div>

        {/* Filters Row */}
        {user.role === UserRole.CLIENT && clientActiveTab === "equipments" ? (
          <div className="flex flex-wrap items-center gap-3 px-2">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
              <Activity className="w-4 h-4 text-gray-400" />
              <select
                className="bg-transparent text-xs font-black uppercase tracking-widest outline-none text-gray-600 cursor-pointer"
                value={equipmentStatusFilter}
                onChange={(e) => setEquipmentStatusFilter(e.target.value)}
              >
                <option value="Todos">Todos os Status</option>
                <option value="Operacional">Operacional</option>
                <option value="Necessita Manutenção">Necessita Manutenção</option>
                <option value="Parado">Parado</option>
                <option value="Aguardando peça">Aguardando peça</option>
              </select>
            </div>

            {equipmentStatusFilter !== "Todos" && (
              <button
                onClick={() => setEquipmentStatusFilter("Todos")}
                className="text-[10px] font-black text-[var(--theme-primary)] uppercase tracking-widest hover:underline"
              >
                Limpar Filtro
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 px-2">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
              <Activity className="w-4 h-4 text-gray-400" />
              <select
                className="bg-transparent text-xs font-black uppercase tracking-widest outline-none text-gray-600"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <option value="Todos">Todos os Status</option>
                <option value="Aberto">Aberto</option>
                <option value="Em Atendimento">Em Atendimento</option>
                <option value="Reagendado">Reagendado</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <select
                className="bg-transparent text-xs font-black uppercase tracking-widest outline-none text-gray-600"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="Todas">Todas as Prioridades</option>
                <option value="Urgente">Urgente</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>

            {(statusFilter !== "Todos" || priorityFilter !== "Todas") && (
              <button
                onClick={() => {
                  setStatusFilter("Todos");
                  setPriorityFilter("Todas");
                }}
                className="text-[10px] font-black text-[var(--theme-primary)] uppercase tracking-widest hover:underline"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        )}
      </section>

      {/* Stats Summary */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Satisfação Média
            </p>
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              <h3 className="text-3xl font-black text-[var(--theme-text)]">
                {avgSatisfaction || "N/A"}
              </h3>
            </div>
          </div>
          <Activity className="w-10 h-10 text-[var(--theme-primary)] opacity-50" />
        </div>

        {maintenanceAlerts.length > 0 && user.role !== UserRole.CLIENT && (
          <div className="bg-orange-50 p-8 rounded-[2.5rem] border border-orange-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">
                Alertas de Manutenção
              </p>
              <div className="flex items-center gap-2 text-orange-700">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-black">
                  {maintenanceAlerts.length} Próximas em 7 dias
                </h3>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Client Equipments Section */}
      {user.role === UserRole.CLIENT && clientActiveTab === "equipments" ? (
        <section className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[var(--theme-primary-light)] text-[var(--theme-primary)] rounded-2xl">
                <AirVent className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--theme-text)] tracking-tight">
                  Meus Equipamentos ({filteredClientUnits.length})
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                  Equipamentos climatizados vinculados à sua conta
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenTicketModal}
              className="p-3 bg-gray-900 text-white rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" />
              Abrir Chamado
            </button>
          </div>

          {filteredClientUnits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClientUnits.map((unit) => {
                let statusBg = "bg-emerald-50 text-emerald-700 border-emerald-100";
                if (unit.status === UnitStatus.MAINTENANCE_REQUIRED) {
                  statusBg = "bg-amber-50 text-amber-700 border-amber-100";
                } else if (unit.status === UnitStatus.STOPPED) {
                  statusBg = "bg-rose-50 text-rose-700 border-rose-100";
                } else if (unit.status === UnitStatus.AWAITING_PARTS) {
                  statusBg = "bg-indigo-50 text-indigo-700 border-indigo-100";
                }

                return (
                  <div
                    key={unit.id}
                    onClick={() => navigate(`/unit/${unit.id}`)}
                    className="bg-white rounded-[2.2rem] border-2 border-gray-100 p-6 shadow-sm hover:shadow-lg hover:border-[var(--theme-primary)] transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="space-y-4">
                      {/* Brand & Status Banner */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="p-3 bg-gray-50 text-gray-400 rounded-2xl group-hover:bg-[var(--theme-primary)] group-hover:text-white transition-colors">
                          <AirVent className="w-6 h-6" />
                        </div>
                        <span className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider ${statusBg}`}>
                          {unit.status}
                        </span>
                      </div>

                      {/* Header Info */}
                      <div>
                        <h4 className="font-black text-[var(--theme-text)] text-lg leading-tight flex items-center gap-1.5 break-all">
                          {unit.brand}
                          {unit.model && <span className="text-gray-400 font-bold text-sm">({unit.model})</span>}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-300" /> {unit.location}
                        </p>
                      </div>

                      {/* Specification Details */}
                      <div className="grid grid-cols-2 gap-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 text-xs font-bold text-gray-500">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">Capacidade</span>
                          <span className="text-gray-800 font-black">{unit.btu.toLocaleString()} BTU/h</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">Nº de Série</span>
                          <span className="text-gray-800 font-black truncate block" title={unit.serialNumber}>{unit.serialNumber || 'N/D'}</span>
                        </div>
                      </div>

                      {/* Planned Maintenance indicators / Alerts */}
                      {unit.planned && unit.planned.length > 0 && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 bg-amber-50/30 border border-amber-100/50 px-3 py-2 rounded-xl">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            Prox. Preventiva: {unit.planned[0].expectedDate.split("-").reverse().join("/")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-black uppercase tracking-wider text-gray-400 group-hover:text-[var(--theme-primary)] transition-colors">
                      <span>Ver Histórico & Detalhes</span>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-150 p-8 space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                <AirVent className="w-8 h-8" />
              </div>
              <div>
                <p className="text-gray-400 font-black uppercase text-xs tracking-widest">
                  Nenhum equipamento localizado
                </p>
                <p className="text-gray-300 text-[10px] font-bold uppercase tracking-widest mt-1">
                  Tente alterar os termos de busca ou o filtro de status
                </p>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Bell className="w-6 h-6 text-[var(--theme-primary)]" />
            <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm animate-in fade-in duration-300">
              <button
                onClick={() => handleToggleArchiveTab(false)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!showArchived ? "bg-[var(--theme-primary)] text-white shadow-md" : "text-gray-400 hover:text-gray-600"}`}
              >
                Ativos
              </button>
              <button
                onClick={() => handleToggleArchiveTab(true)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${showArchived ? "bg-[var(--theme-primary)] text-white shadow-md" : "text-gray-400 hover:text-gray-600"}`}
              >
                Ver Arquivados
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm mr-2">
              <button
                onClick={() => {
                  setTicketViewMode("grid");
                  localStorage.setItem("arcontrol_ticket_view_mode", "grid");
                }}
                className={`p-2 rounded-lg transition-all ${ticketViewMode === "grid" ? "bg-[var(--theme-primary)] text-white shadow-md" : "text-gray-400 hover:bg-gray-50"}`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setTicketViewMode("list");
                  localStorage.setItem("arcontrol_ticket_view_mode", "list");
                }}
                className={`p-2 rounded-lg transition-all ${ticketViewMode === "list" ? "bg-[var(--theme-primary)] text-white shadow-md" : "text-gray-400 hover:bg-gray-50"}`}
                title="Visualização em Lista"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleOpenTicketModal}
              className="p-3 bg-gray-900 text-white rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />{" "}
              <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">
                Abrir Chamado
              </span>
            </button>
          </div>
        </div>

        <div
          className={
            ticketViewMode === "grid" ? "grid gap-4" : "flex flex-col gap-3"
          }
        >
          {visibleTickets.length > 0 ? (
            <>
              {visibleTickets.map((ticket) =>
                ticketViewMode === "grid" ? (
                  <div
                    key={ticket.id}
                  className={`p-6 rounded-[2.2rem] border-2 transition-all group ${getPriorityStyles(ticket.priority, ticket.status)}`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <div
                          className={`p-3 rounded-2xl ${
                            ticket.status === "Finalizado"
                              ? "bg-gray-100 text-gray-400"
                              : ticket.status === "Em Atendimento"
                                ? "bg-orange-100 text-orange-600"
                                : ticket.status === "Aberto"
                                  ? ticket.priority === "Urgente"
                                    ? "bg-red-500 text-white"
                                    : "bg-red-500 text-white"
                                  : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          <AirVent
                            className={`w-6 h-6 ${ticket.status === "Em Atendimento" ? "animate-spin-slow" : ""}`}
                          />
                        </div>

                        <div className="flex flex-col">
                          <span
                            className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
                              ticket.status === "Finalizado"
                                ? "text-gray-400"
                                : ticket.status === "Em Atendimento"
                                  ? "text-orange-600"
                                  : "text-indigo-600"
                            }`}
                          >
                            {ticket.status === "Aberto"
                              ? `Chamado ${ticket.priority}`
                              : ticket.status.toUpperCase()}
                          </span>
                          {getTicketOpenedTime(ticket) && (
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                              Aberto às {getTicketOpenedTime(ticket)}
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest ${getPriorityBadgeStyles(ticket.priority, ticket.status)}`}
                          >
                            {ticket.status === "Em Atendimento"
                              ? "EM ATENDIMENTO"
                              : ticket.status === "Reagendado"
                                ? "REAGENDADO"
                                : ticket.status === "Finalizado"
                                  ? "CONCLUÍDO"
                                  : ticket.priority}
                          </span>
                          {ticket.isTransferred && (
                            <span className="ml-2 text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg shadow-blue-200 px-4 py-1.5 rounded-xl">
                              TRANSFERIDO
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-gray-500">
                          Agendado: {ticket.date.split("-").reverse().join("/")}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                          {ticket.id}
                        </span>
                      </div>

                      {/* Ticket Times: Opening and Closing */}
                      <div className="flex gap-4 mb-3 flex-wrap">
                        {getTicketOpenedTime(ticket) && (
                          <div className="flex items-center gap-2 text-[var(--theme-primary)] bg-[var(--theme-primary-light)] px-3 py-1.5 rounded-full">
                            <Clock className="w-4 h-4" />
                            <p className="text-[11px] font-black uppercase tracking-widest">
                              Aberto às: <span className="font-bold">{getTicketOpenedTime(ticket)}</span>
                            </p>
                          </div>
                        )}
                        {ticket.finishedAt && (
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <p className="text-[10px] font-black uppercase tracking-widest">
                              Finalizado:{" "}
                              <span className="text-gray-900">
                                {ticket.finishedAt}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>

                      {(ticket.status === "Aberto" ||
                        ticket.status === "Em Atendimento") && (
                        <div className="mb-4">
                          <TicketCountdown ticket={ticket} />
                        </div>
                      )}

                      <h4 className="font-black text-[var(--theme-text)] text-lg leading-tight mb-3">
                        {ticket.description}
                      </h4>

                      {/* Highlighted Client and Technician Info */}
                      <div className="flex flex-wrap gap-3 mb-2">
                        {/* Dynamic style for Client */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--theme-primary-light)] text-[var(--theme-primary)] rounded-lg border-l-4 border-[var(--theme-primary)] shadow-sm">
                          <Building2 className="w-4 h-4" />
                          <div>
                            <p className="text-[8px] opacity-70 font-bold uppercase tracking-widest leading-none">
                              Cliente
                            </p>
                            <p className="font-black text-xs uppercase tracking-wide">
                              {ticket.clientName}
                            </p>
                          </div>
                        </div>

                        {ticket.technicianId && (() => {
                          const techUser = users.find(u => u.username === ticket.technicianId);
                          return (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-900 rounded-lg border-l-4 border-orange-600 shadow-sm">
                              {techUser?.avatarUrl ? (
                                <img src={techUser.avatarUrl} alt={techUser.username} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <Wrench className="w-4 h-4 text-orange-700" />
                              )}
                              <div>
                                <p className="text-[8px] text-orange-600/70 font-bold uppercase tracking-widest leading-none">
                                  Técnico
                                </p>
                                <p className="font-black text-xs uppercase tracking-wide">
                                  {ticket.technicianId}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {ticket.unitId && (
                        <p className="text-xs font-bold text-gray-500 flex items-center gap-1 ml-1 mb-2">
                          <Thermometer className="w-3 h-3" /> Equipamento:{" "}
                          {ticket.unitId}
                        </p>
                      )}

                      {/* Service Report Display (Visible when ticket is Completed or has a technical report) */}
                      {(ticket.status === "Finalizado" ||
                        ticket.technicalReport) && (
                        <div className="mt-4 p-4 bg-white/60 rounded-2xl border border-gray-200">
                          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Relatório de
                            Serviço
                          </p>
                          {ticket.technicalReport && (
                            <div className="mb-2">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                Parecer Técnico
                              </p>
                              <p className="text-xs font-medium text-gray-800 whitespace-pre-line">
                                {ticket.technicalReport}
                              </p>
                            </div>
                          )}
                          {ticket.photos && ticket.photos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mt-3">
                              {ticket.photos.map((photo, idx) => (
                                <img
                                  key={idx}
                                  src={photo}
                                  alt="Serviço"
                                  className="w-16 h-16 rounded-xl object-cover border border-gray-100"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Justification for Rescheduled */}
                      {ticket.status === "Reagendado" &&
                        ticket.rescheduleReason && (
                          <div className="mt-3 p-3 bg-indigo-100 rounded-xl border border-indigo-200">
                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                              <History className="w-3 h-3" /> Motivo do
                              Reagendamento
                            </p>
                            <p className="text-xs font-medium text-indigo-900">
                              {ticket.rescheduleReason}
                            </p>
                          </div>
                        )}

                      {/* Rating Display for Completed Tickets */}
                      {ticket.status === "Finalizado" && ticket.rating && (
                        <div className="flex items-center gap-1 mt-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i < ticket.rating! ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                            />
                          ))}
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            Avaliado
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {/* Ficha do Equipamento Shortcut */}
                      {ticket.unitId && (
                        <button
                          onClick={() => navigate(`/unit/${ticket.unitId}`)}
                          className="flex-1 md:flex-none p-3 bg-slate-700 text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center gap-2"
                          title="Ficha do Equipamento"
                        >
                          <FileText className="w-5 h-5 mx-auto" />
                          <span className="text-[10px] font-black uppercase hidden sm:inline">
                            Ficha
                          </span>
                        </button>
                      )}

                      {/* Technician Quick Action: Aceitar or Finalizar next to Ficha */}
                      {user.role === UserRole.TECHNICIAN &&
                        (ticket.status === "Aberto" ? (
                          <button
                            onClick={() => handleAcceptTicket(ticket)}
                            className="flex-1 md:flex-none p-3 bg-orange-600 text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center gap-2"
                            title="Aceitar Chamado"
                          >
                            <PlayCircle className="w-5 h-5 mx-auto" />
                            <span className="text-[10px] font-black uppercase hidden sm:inline">
                              Aceitar
                            </span>
                          </button>
                        ) : (ticket.status === "Em Atendimento" ||
                            ticket.status === "Reagendado") &&
                          ticket.technicianId === user.username ? (
                          <button
                            onClick={() => handleOpenFinishModal(ticket)}
                            className="flex-1 md:flex-none p-3 bg-green-600 text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center gap-2 animate-status-pulse-green"
                            title="Registrar Relatório Técnico Fotográfico"
                          >
                            <CheckSquare className="w-5 h-5 mx-auto" />
                            <span className="text-[10px] font-black uppercase hidden sm:inline">
                              Relatório Técnico
                            </span>
                          </button>
                        ) : null)}

                      {/* Transfer Action */}
                      {(user.role === UserRole.ADMIN ||
                        (user.role === UserRole.TECHNICIAN &&
                          ticket.technicianId === user.username)) &&
                        ticket.status !== "Finalizado" && (
                          <button
                            onClick={() => handleOpenTransferModal(ticket)}
                            className="flex-1 md:flex-none flex flex-col items-center justify-center p-2 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all min-w-[76px]"
                            title="Transferir Chamado"
                          >
                            <ArrowRightLeft className="w-4 h-4 mb-1 mx-auto" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">
                              Transferir
                            </span>
                          </button>
                        )}

                      {/* Technician Secondary Action: Reschedule */}
                      {user.role === UserRole.TECHNICIAN &&
                        (ticket.status === "Em Atendimento" ||
                          ticket.status === "Reagendado") &&
                        ticket.technicianId === user.username && (
                          <button
                            onClick={() => handleOpenReschedule(ticket)}
                            className="flex-1 md:flex-none flex flex-col items-center justify-center p-2 bg-indigo-500 text-white rounded-xl shadow-lg active:scale-95 transition-all min-w-[84px]"
                            title="Reagendar Chamado"
                          >
                            <CalendarClock className="w-4 h-4 mb-1 mx-auto" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">
                              Agendamento
                            </span>
                          </button>
                        )}

                      {/* Photographic Report Action */}
                      {ticket.status === "Finalizado" && (
                        <button
                          onClick={() => setReportTicket(ticket)}
                          className="flex-1 md:flex-none p-3 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                          title="Relatório Fotográfico"
                        >
                          <Camera className="w-5 h-5 mx-auto" />
                          <span className="text-[10px] font-black uppercase hidden sm:inline">
                            Relatório
                          </span>
                        </button>
                      )}

                      {/* Archive/Restore Action (Admin Only) */}
                      {user.role === UserRole.ADMIN &&
                        (ticket.status === "Finalizado" && !ticket.archived ? (
                          <button
                            onClick={() =>
                              onUpdateTicket(ticket.id, { archived: true })
                            }
                            className="flex-1 md:flex-none p-3 bg-gray-100 text-gray-600 rounded-xl shadow-sm hover:bg-gray-200 transition-all"
                            title="Arquivar Chamado"
                          >
                            <Archive className="w-5 h-5 mx-auto" />
                          </button>
                        ) : ticket.archived ? (
                          <button
                            onClick={() => {
                              const confirmRestore = window.confirm("Restaurar este chamado arquivado reabrirá o mesmo para 'Em Atendimento'. Deseja continuar?");
                              if (confirmRestore) {
                                onUpdateTicket(ticket.id, { archived: false, status: 'Em Atendimento' })
                              }
                            }}
                            className="flex-1 md:flex-none p-3 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm hover:bg-emerald-200 transition-all flex items-center justify-center gap-2"
                            title="Desarquivar / Reabrir"
                          >
                            <ArchiveRestore className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">Restaurar</span>
                          </button>
                        ) : null)}

                      {/* Client Rating Action */}
                      {user.role === UserRole.CLIENT &&
                        ticket.status === "Finalizado" &&
                        !ticket.rating && (
                          <button
                            onClick={() => {
                              setRatingTicket(ticket);
                              setRatingValue(0);
                            }}
                            className="flex-1 md:flex-none px-4 py-3 bg-yellow-500 text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center gap-2"
                          >
                            <Star className="w-5 h-5" />{" "}
                            <span className="text-xs font-black uppercase">
                              Avaliar
                            </span>
                          </button>
                        )}

                      {/* General Actions */}
                      {ticket.status === "Finalizado" &&
                        user.role === UserRole.ADMIN && (
                          <button
                            onClick={() => handleRemindUser(ticket)}
                            className="flex-1 md:flex-none p-3 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center gap-2 group/remind"
                            title="Relembrar Cliente"
                          >
                            <Bell className="w-5 h-5 mx-auto" />
                            <span className="text-[10px] font-black uppercase hidden sm:inline">
                              Relembrar
                            </span>
                          </button>
                        )}

                      {ticket.status !== "Finalizado" &&
                        (user.role === UserRole.ADMIN ||
                          user.role === UserRole.CLIENT) && (
                          <button
                            onClick={() => handleNotifyTechnician(ticket)}
                            className={`flex-1 md:flex-none p-3 rounded-xl shadow-lg active:scale-90 transition-all ${
                              notifiedTickets.includes(ticket.id)
                                ? "bg-gray-200 text-gray-500 shadow-none cursor-default"
                                : "bg-emerald-600 text-white shadow-emerald-100"
                            }`}
                            title={
                              notifiedTickets.includes(ticket.id)
                                ? "Notificação já enviada"
                                : "Notificar via WhatsApp"
                            }
                            disabled={notifiedTickets.includes(ticket.id)}
                          >
                            {notifiedTickets.includes(ticket.id) ? (
                              <CheckCircle2 className="w-5 h-5 mx-auto" />
                            ) : (
                              <Send className="w-5 h-5 mx-auto" />
                            )}
                          </button>
                        )}

                      {(user.role === UserRole.ADMIN ||
                        (user.role === UserRole.CLIENT &&
                          ticket.status === "Aberto")) && (
                        <>
                          <button
                            onClick={() => handleEditTicketModal(ticket)}
                            className="flex-1 md:flex-none p-3 bg-white text-gray-900 border border-gray-200 rounded-xl shadow-sm active:scale-90 transition-all"
                          >
                            <Pencil className="w-5 h-5 mx-auto" />
                          </button>
                          <button
                            onClick={() => setDeleteTicketConfirmation(ticket)}
                            className="flex-1 md:flex-none p-3 bg-white text-red-500 border border-red-100 rounded-xl shadow-sm active:scale-90 transition-all"
                          >
                            <Trash2 className="w-5 h-5 mx-auto" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* COMPACT LIST VIEW */
                <div
                  key={ticket.id}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${getPriorityStyles(ticket.priority, ticket.status)}`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      ticket.status === "Finalizado"
                        ? "bg-gray-100 text-gray-400"
                        : ticket.status === "Em Atendimento"
                          ? "bg-orange-100 text-orange-600"
                          : ticket.status === "Aberto"
                            ? ticket.priority === "Urgente"
                              ? "bg-red-600 text-white shadow-xl shadow-red-200"
                              : "bg-red-500 text-white animate-bounce"
                            : ticket.priority === "Urgente"
                              ? "bg-red-100 text-red-600"
                              : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {ticket.status === "Finalizado" ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : ticket.status === "Em Atendimento" ? (
                      <AirVent className="w-6 h-6 animate-spin-slow" />
                    ) : ticket.status === "Aberto" ? (
                      <AirVent className="w-6 h-6" />
                    ) : (
                      <AirVent className="w-6 h-6" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                        {ticket.id}
                      </span>
                      {ticket.technicianId && (() => {
                        const techUser = users.find(u => u.username === ticket.technicianId);
                        return techUser?.avatarUrl ? (
                          <img src={techUser.avatarUrl} alt={techUser.username} className="w-5 h-5 rounded-full object-cover ml-1" title={ticket.technicianId} />
                         ) : null;
                      })()}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ml-auto ${getPriorityBadgeStyles(ticket.priority, ticket.status)}`}
                      >
                        {ticket.status}
                      </span>
                      {ticket.isTransferred && (
                        <span className="px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-sm ml-1">
                          TRANSFERIDO
                        </span>
                      )}
                      <span className="text-[9px] font-black text-gray-900 ml-auto">
                        {ticket.date.split("-").reverse().join("/")}
                      </span>
                    </div>
                    <h4 className="font-black text-[var(--theme-text)] text-sm truncate">
                      {ticket.description}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[9px] font-bold text-gray-500 uppercase truncate max-w-[100px]">
                        {ticket.clientName}
                      </p>
                      {ticket.unitId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/unit/${ticket.unitId}`);
                          }}
                          className="text-[9px] text-gray-450 hover:text-[var(--theme-primary)] font-black hover:underline cursor-pointer bg-gray-50 hover:bg-gray-100/80 border border-gray-150 rounded px-1.5 py-0.5 flex items-center gap-1 transition-all"
                          title="Ficha do Equipamento"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          <span>Ficha: {ticket.unitId}</span>
                        </button>
                      )}
                    </div>
                    {(ticket.status === "Aberto" ||
                      ticket.status === "Em Atendimento") && (
                      <div className="mt-1 w-full max-w-[200px]">
                        <TicketCountdown ticket={ticket} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {(user.role === UserRole.ADMIN ||
                      (user.role === UserRole.CLIENT &&
                        ticket.status === "Aberto") ||
                      (user.role === UserRole.TECHNICIAN &&
                        (ticket.status === "Aberto" ||
                          ticket.technicianId === user.username))) && (
                      <button
                        onClick={() => handleEditTicketModal(ticket)}
                        className="p-2 text-gray-400 hover:text-[var(--theme-primary)] transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ),
              )}
            </>
          ) : (
            <div className="text-center py-10 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
              <p className="text-gray-300 font-black uppercase text-xs tracking-widest">
                Nenhum chamado pendente
              </p>
            </div>
          )}
        </div>
        {sortedTickets.length > visibleCount && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setVisibleCount((prev) => prev + 50)}
              className="px-6 py-3 bg-[var(--theme-primary-light)] text-[var(--theme-primary)] rounded-full font-black text-xs uppercase tracking-widest hover:bg-[var(--theme-primary)] hover:text-white transition-all shadow-sm"
            >
              Exibir mais resultados ({sortedTickets.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </section>
      )}

      {/* Units Section removed as per user request */}

      {/* Ticket Wizard Modal */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex flex-col items-center pt-10 sm:pt-20 pb-10 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative">
            <button
              onClick={() => setIsTicketModalOpen(false)}
              className="absolute top-8 right-8 p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-all"
            >
              <X className="w-6 h-6" />
            </button>

            {ticketFlowStep === "selection" && (
              <div key="selection" className="space-y-8 animate-in slide-in-from-bottom-4">
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-black tracking-tighter italic text-[var(--theme-text)]">
                    Como podemos ajudar?
                  </h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                    Selecione o equipamento
                  </p>
                </div>
                <div className="grid gap-4">
                  <button
                    onClick={() => setTicketFlowStep("problem")}
                    className="w-full p-6 bg-[var(--theme-primary)] text-white rounded-3xl font-black text-left flex items-center justify-between shadow-xl active:scale-95 transition-all"
                  >
                    <div>
                      <p className="text-[10px] opacity-70 uppercase tracking-widest mb-1">
                        Equipamento já cadastrado
                      </p>
                      <p className="text-xl">Selecionar da Lista</p>
                    </div>
                    <ChevronRight className="w-8 h-8" />
                  </button>
                  <button
                    onClick={() => setTicketFlowStep("new-unit")}
                    className="w-full p-6 bg-white border-2 border-gray-100 text-gray-900 rounded-3xl font-black text-left flex items-center justify-between active:scale-95 transition-all"
                  >
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                        Novo ou não identificado
                      </p>
                      <p className="text-xl text-[var(--theme-text)]">
                        Cadastrar e Abrir
                      </p>
                    </div>
                    <Plus className="w-8 h-8 text-[var(--theme-primary)]" />
                  </button>
                </div>
              </div>
            )}

            {ticketFlowStep === "new-unit" && (
              <div key="new-unit" className="space-y-6 animate-in slide-in-from-right-4">
                <button
                  onClick={() => setTicketFlowStep("selection")}
                  className="flex items-center gap-2 text-[var(--theme-primary)] font-black text-[10px] uppercase tracking-widest mb-4"
                >
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <h3 className="text-2xl font-black tracking-tighter italic text-[var(--theme-text)]">
                  Novo Equipamento
                </h3>
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Marca
                    </label>
                    <input
                      type="text"
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-bold"
                      value={newUnitData.brand}
                      onChange={(e) =>
                        setNewUnitData({
                          ...newUnitData,
                          brand: e.target.value,
                        })
                      }
                      placeholder="Ex: Samsung"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Capacidade (BTU)
                    </label>
                    <input
                      type="text"
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-bold"
                      value={newUnitData.btu}
                      onChange={(e) =>
                        setNewUnitData({ ...newUnitData, btu: e.target.value })
                      }
                      placeholder="Ex: 12000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Localização
                    </label>
                    <input
                      type="text"
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-bold"
                      value={newUnitData.location}
                      onChange={(e) =>
                        setNewUnitData({
                          ...newUnitData,
                          location: e.target.value,
                        })
                      }
                      placeholder="Ex: Sala 202"
                    />
                  </div>
                  <button
                    onClick={() => setTicketFlowStep("problem")}
                    className="w-full bg-[var(--theme-primary)] text-white py-5 rounded-2xl font-black shadow-xl mt-4"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}

            {ticketFlowStep === "problem" && (
              <form
                key="problem"
                onSubmit={handleSaveTicket}
                className="space-y-6 animate-in slide-in-from-right-4"
              >
                {(user.role === UserRole.TECHNICIAN ||
                  user.role === UserRole.ADMIN) && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Relatório Técnico
                    </label>
                    <textarea
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-medium border-2 border-transparent focus:border-[var(--theme-primary)] outline-none h-32 resize-none"
                      placeholder="Parecer técnico, observações, peças trocadas..."
                      value={ticketTechnicalReport}
                      onChange={(e) => setTicketTechnicalReport(e.target.value)}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setTicketFlowStep(
                      editingTicket
                        ? "problem"
                        : selectedUnitId
                          ? "selection"
                          : "selection",
                    )
                  }
                  className="flex items-center gap-2 text-[var(--theme-primary)] font-black text-[10px] uppercase tracking-widest mb-4"
                >
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <h3 className="text-2xl font-black tracking-tighter italic text-[var(--theme-text)]">
                  {editingTicket ? "Editar Chamado" : "Relate o Problema"}
                </h3>
                
                {editingTicket && getTicketOpenedTime(editingTicket) && (
                    <div className="flex items-center gap-2 text-[var(--theme-primary)] bg-[var(--theme-primary-light)] px-4 py-2 rounded-full w-fit">
                        <Clock className="w-4 h-4" />
                        <p className="text-[11px] font-black uppercase tracking-widest">
                            Aberto às: <span className="font-bold">{getTicketOpenedTime(editingTicket)}</span>
                        </p>
                    </div>
                )}


                {!editingTicket && !newUnitData.brand && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Vincular a:
                    </label>
                    <select
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-[var(--theme-primary)] outline-none"
                      value={selectedUnitId || ""}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                    >
                      <option value="">Nenhum (Problema Geral)</option>
                      {myUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.id} - {u.brand} ({u.location})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Descrição do Problema
                  </label>
                  <textarea
                    className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-medium border-2 border-transparent focus:border-[var(--theme-primary)] outline-none h-32 resize-none"
                    placeholder="Ex: Ar condicionado parou de esfriar e está fazendo barulho estranho..."
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Fotos do Serviço
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {ticketPhotos.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100">
                        <img src={url} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => {
                            const newPhotos = [...ticketPhotos];
                            const newDescs = [...ticketPhotoDescriptions];
                            newPhotos.splice(idx, 1);
                            newDescs.splice(idx, 1);
                            setTicketPhotos(newPhotos);
                            setTicketPhotoDescriptions(newDescs);
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[var(--theme-primary)] hover:bg-blue-50 transition-all">
                      {isImageUploading ? <p className="text-[10px] font-bold">Carregando...</p> : <Plus className="w-6 h-6 text-gray-400" />}
                      <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Prioridade
                    </label>
                    <select
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-bold"
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value as any)}
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Previsão
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-bold"
                      value={ticketDate}
                      onChange={(e) => setTicketDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Only Admin can change status manually here, or if editing. Technicians use buttons. */}
                {editingTicket && user.role === UserRole.ADMIN && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Status
                    </label>
                    <select
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-xl font-bold"
                      value={ticketStatus}
                      onChange={(e) => setTicketStatus(e.target.value as any)}
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Em Atendimento">Em Atendimento</option>
                      <option value="Reagendado">Reagendado</option>
                      <option value="Finalizado">Finalizado</option>
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full text-white py-5 rounded-2xl font-black shadow-xl mt-4 transition-all ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-[var(--theme-primary)] hover:opacity-90 active:scale-95"}`}
                >
                  {isSubmitting
                    ? "Processando..."
                    : editingTicket
                      ? "Salvar Alterações"
                      : "Confirmar Chamado"}
                </button>
              </form>
            )}

            {ticketFlowStep === "success" && lastCreatedTicket && (
              <div key="success" className="text-center space-y-8 animate-in zoom-in-95">
                <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div>
                  <h3 className="text-3xl font-black tracking-tighter italic text-[var(--theme-text)]">
                    Chamado Aberto!
                  </h3>
                  <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">
                    ID: {lastCreatedTicket.id}
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl text-left border border-gray-100">
                  <div className="text-sm font-bold text-gray-800 leading-relaxed">
                    ✅ O técnico responsável será notificado sobre o seu chamado.
                    <br />
                    ⏳ O prazo de um retorno Técnico de 30 minutos.
                    <br />
                    Você poderá acompanhar o andamento em tempo real pelo sistema.
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleNotifyTechnician(lastCreatedTicket)}
                    className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <MessageSquare className="w-5 h-5" /> Notificar via WhatsApp
                  </button>
                  <button
                    onClick={() => setIsTicketModalOpen(false)}
                    className="w-full bg-gray-100 text-gray-400 py-5 rounded-2xl font-black"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transfer Ticket Modal */}
      {transferTicket && (
        <div className="fixed inset-0 z-[3100] bg-black/80 backdrop-blur-sm flex flex-col items-center pt-10 sm:pt-20 pb-10 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter text-[var(--theme-text)]">
                  Transferir Chamado
                </h2>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                  Selecione o novo técnico
                </p>
              </div>
              <button
                onClick={() => setTransferTicket(null)}
                className="p-2 bg-gray-50 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferConfirm} className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                  Chamado Atual
                </p>
                <p className="font-bold text-blue-900 mb-2">
                  {transferTicket.id} - {transferTicket.description}
                </p>
                <p className="text-xs text-blue-700">
                  Técnico atual:{" "}
                  <span className="font-black">
                    {transferTicket.technicianId || "Nenhum"}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Novo Responsável <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl font-bold outline-none focus:border-blue-500 transition-all"
                  value={selectedTransferTech}
                  onChange={(e) => setSelectedTransferTech(e.target.value)}
                  required
                >
                  <option value="">Selecione um técnico...</option>
                  {availableTechnicians.map((tech) => (
                    <option key={tech.id} value={tech.username}>
                      {tech.username}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!selectedTransferTech}
                className="w-full bg-blue-600 disabled:bg-gray-300 text-white py-5 rounded-[1.8rem] font-black shadow-xl active:scale-95 transition-all text-lg mt-4 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-5 h-5" /> Confirmar Transferência
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Reminder Modal */}
      {remindMaintenanceTicket && (
        <div className="fixed inset-0 z-[3100] bg-black/80 backdrop-blur-sm flex flex-col items-center pt-10 sm:pt-20 pb-10 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter text-[var(--theme-text)]">
                  Agendar Próxima
                </h2>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                  Manutenção Preventiva
                </p>
              </div>
              <button
                onClick={() => setRemindMaintenanceTicket(null)}
                className="p-2 bg-gray-50 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 mb-6">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">
                  Equipamento
                </p>
                <p className="font-black text-indigo-900">
                  {
                    units.find((u) => u.id === remindMaintenanceTicket.unitId)
                      ?.brand
                  }{" "}
                  -{" "}
                  {
                    units.find((u) => u.id === remindMaintenanceTicket.unitId)
                      ?.location
                  }
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Data da Próxima Manutenção
                </label>
                <input
                  type="date"
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl font-black outline-none focus:border-indigo-500 transition-all"
                  value={nextMaintenanceDate}
                  onChange={(e) => setNextMaintenanceDate(e.target.value)}
                />
              </div>

              <button
                onClick={handleConfirmMaintenanceReminder}
                className="w-full bg-indigo-600 text-white py-5 rounded-[1.8rem] font-black shadow-xl active:scale-95 transition-all text-lg mt-4 flex items-center justify-center gap-2"
              >
                <CalendarClock className="w-5 h-5" /> Confirmar Agendamento
              </button>

              <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">
                O cliente receberá um alerta animado em seu painel quando
                faltarem 5 dias para esta data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-[4000] bg-black/80 backdrop-blur-sm flex flex-col items-center pt-10 sm:pt-20 pb-10 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                  <MessageCircle className="w-6 h-6 fill-emerald-600/10" />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter text-[var(--theme-text)]">
                    Notificações
                  </h2>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                    Próximas Manutenções
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNotificationsOpen(false)}
                className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
              {units.flatMap((u) =>
                u.planned.map((p) => ({ unit: u, planned: p })),
              ).length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">
                    Nenhuma notificação
                  </p>
                </div>
              ) : (
                units
                  .filter((u) =>
                    user.role === UserRole.CLIENT
                      ? u.clientName === user.clientName
                      : true,
                  )
                  .flatMap((u) =>
                    u.planned.map((p) => ({ unit: u, planned: p })),
                  )
                  .sort(
                    (a, b) =>
                      new Date(a.planned.expectedDate).getTime() -
                      new Date(b.planned.expectedDate).getTime(),
                  )
                  .map((item, idx) => {
                    const days = Math.ceil(
                      (new Date(item.planned.expectedDate).getTime() -
                        new Date().getTime()) /
                        (1000 * 60 * 60 * 24),
                    );
                    const isUrgent = days <= 5 && days >= 0;

                    return (
                      <div
                        key={idx}
                        className={`p-5 rounded-3xl border-2 transition-all ${isUrgent ? "bg-orange-50 border-orange-200 shadow-lg shadow-orange-100" : "bg-gray-50 border-transparent hover:border-gray-200"}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${isUrgent ? "bg-orange-500 animate-pulse" : "bg-indigo-400"}`}
                            ></div>
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest ${isUrgent ? "text-orange-600" : "text-gray-400"}`}
                            >
                              {isUrgent
                                ? "Urgente • Manutenção Próxima"
                                : "Agendado"}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-gray-400">
                            {item.planned.expectedDate
                              .split("-")
                              .reverse()
                              .join("/")}
                          </span>
                        </div>
                        <h4 className="font-black text-gray-900 text-lg leading-tight mb-1">
                          {item.unit.brand}
                        </h4>
                        <p className="text-xs font-bold text-gray-500 mb-4">
                          {item.unit.location}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isUrgent ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-600"}`}
                            >
                              {days < 0
                                ? "Atrasado"
                                : days === 0
                                  ? "Hoje"
                                  : `Faltam ${days} dias`}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              navigate(`/unit/${item.unit.id}`);
                            }}
                            className={`p-2 rounded-xl transition-all ${isUrgent ? "bg-orange-600 text-white shadow-md" : "bg-white text-gray-400 border border-gray-200"}`}
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <button
              onClick={() => setIsNotificationsOpen(false)}
              className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Finish Ticket Modal (Report) */}
      {finishingTicket && (
        <div className="fixed inset-0 z-[3100] bg-black/80 backdrop-blur-sm flex p-4 justify-center items-center overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black italic tracking-tighter text-[var(--theme-text)]">
                {finishStep === 0
                  ? "Registrar Relatório Técnico Fotográfico"
                  : "Confirmar Encerramento"}
              </h2>
              <button
                onClick={() => { setFinishingTicket(null); setFinishStep(0); }}
                className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {finishStep === 0 && (
              <form onSubmit={(e) => { e.preventDefault(); setFinishStep(1); }} className="space-y-6">
                {/* Relatório Técnico Section (Always editable so technician can save and update) */}
                <div className="p-5 bg-purple-50/75 border border-purple-100 rounded-[1.8rem] space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
                  <div className="flex justify-between items-center relative z-10">
                    <p className="text-xs text-purple-800 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                      Relatório Técnico (Editável)
                    </p>
                    {finishingTicket?.technicalReport && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[8px] font-black uppercase rounded-full">
                        Salvo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 font-semibold leading-normal relative z-10">
                    Insira ou faça alterações no seu parecer técnico de
                    diagnóstico e condições do equipamento.
                  </p>
                  <div className="space-y-1 relative z-10">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                      Conteúdo do Relatório{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-4 py-3 bg-white border border-purple-100 focus:border-purple-500 rounded-xl font-medium outline-none text-xs h-28 resize-none transition-all shadow-sm"
                      placeholder="Insira o seu parecer técnico, o que foi diagnosticado, estado do equipamento, etc..."
                      value={finishData.technicalReport}
                      onChange={(e) =>
                        setFinishData({
                          ...finishData,
                          technicalReport: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Fotos do Serviço
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {finishData.photos.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100">
                        <img src={url} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => {
                            const newPhotos = [...finishData.photos];
                            const newDescs = [...finishData.photoDescriptions];
                            newPhotos.splice(idx, 1);
                            newDescs.splice(idx, 1);
                            setFinishData({...finishData, photos: newPhotos, photoDescriptions: newDescs});
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[var(--theme-primary)] hover:bg-purple-50 transition-all">
                      {isImageUploading ? <p className="text-[10px] font-bold">Carregando...</p> : <Plus className="w-6 h-6 text-gray-400" />}
                      <input type="file" className="hidden" multiple accept="image/*" onChange={async (e) => {
                          if (!e.target.files || e.target.files.length === 0) return;
                          
                          const files = Array.from(e.target.files) as File[];
                          const uploadedUrls = await uploadImages(files);
                          setFinishData(prev => ({
                              ...prev,
                              photos: [...prev.photos, ...uploadedUrls],
                              photoDescriptions: [...prev.photoDescriptions, ...files.map(() => '')]
                          }));
                      }} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 border-2 border-purple-200 py-4 rounded-[1.5rem] font-black transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
                  >
                    <Save className="w-4 h-4" /> Salvar Rascunho
                  </button>
                  <button
                    type="submit"
                    className="w-full bg-green-600 text-white hover:bg-green-700 py-4 rounded-[1.5rem] font-black shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <CheckSquare className="w-4 h-4" /> Concluir e Fechar
                  </button>
                </div>
              </form>
            )}

            {finishStep === 1 && (
              <div className="text-center py-6 space-y-6">
                <p className="text-lg font-bold text-gray-800">Deseja finalizar o atendimento?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setFinishStep(0)} className="py-3 bg-gray-200 rounded-full font-bold">Voltar</button>
                    <button onClick={() => setFinishStep(2)} className="py-3 bg-green-600 text-white rounded-full font-bold">Sim</button>
                </div>
              </div>
            )}

            {finishStep === 2 && (
              <div className="text-center py-6 space-y-6">
                <p className="text-lg font-bold text-red-600">Tem certeza? O chamado será encerrado definitivamente e não poderá mais ser editado.</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setFinishStep(1)} className="py-3 bg-gray-200 rounded-full font-bold">Voltar</button>
                    <button onClick={() => {
                        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                        handleConfirmFinish(fakeEvent);
                    }} className="py-3 bg-red-600 text-white rounded-full font-bold">Encerrar Chamado</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTicket && (
        <div className="fixed inset-0 z-[3100] bg-black/80 backdrop-blur-sm flex flex-col items-center pt-10 sm:pt-20 pb-10 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter text-[var(--theme-text)]">
                  Reagendar
                </h2>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                  Defina nova data e motivo
                </p>
              </div>
              <button
                onClick={() => setRescheduleTicket(null)}
                className="p-2 bg-gray-50 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Nova Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl font-bold outline-none focus:border-purple-500 transition-all"
                  value={rescheduleData.date}
                  onChange={(e) =>
                    setRescheduleData({
                      ...rescheduleData,
                      date: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Justificativa <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl font-medium outline-none focus:border-purple-500 transition-all h-32 resize-none"
                  placeholder="Explique o motivo do reagendamento..."
                  value={rescheduleData.reason}
                  onChange={(e) =>
                    setRescheduleData({
                      ...rescheduleData,
                      reason: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-5 rounded-[1.8rem] font-black shadow-xl active:scale-95 transition-all text-lg mt-4"
              >
                Confirmar Reagendamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingTicket && (
        <div className="fixed inset-0 z-[3100] bg-black/80 backdrop-blur-sm flex flex-col items-center pt-10 sm:pt-20 pb-10 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[var(--theme-text)] mb-2">
              Avaliar Atendimento
            </h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">
              Como foi o serviço para o chamado {ratingTicket.id}?
            </p>

            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setRatingValue(star)}
                  onClick={() => setRatingValue(star)}
                  className="transition-transform hover:scale-125"
                >
                  <Star
                    className={`w-10 h-10 ${star <= ratingValue ? "text-yellow-500 fill-yellow-500" : "text-gray-200 fill-gray-100"}`}
                  />
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRateTicket}
                disabled={ratingValue === 0}
                className="w-full bg-[var(--theme-primary)] disabled:bg-gray-300 text-white py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95"
              >
                Enviar Avaliação
              </button>
              <button
                onClick={() => setRatingTicket(null)}
                className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl font-black"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTicketConfirmation && (
        <div className="fixed inset-0 z-[3200] bg-black/80 backdrop-blur-sm flex flex-col items-center pt-10 sm:pt-20 pb-10 p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in-95">
            <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-2xl font-black text-[var(--theme-text)] mb-2">
              Excluir Chamado?
            </h3>
            <p className="text-gray-500 text-sm mb-8">
              Tem certeza que deseja remover o chamado{" "}
              <span className="font-bold text-[var(--theme-text)]">
                {deleteTicketConfirmation.id}
              </span>
              ? Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteTicketConfirm}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-red-100 active:scale-95 transition-all"
              >
                Sim, Excluir
              </button>
              <button
                onClick={() => setDeleteTicketConfirmation(null)}
                className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl font-black active:scale-95 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report ticket removed */}


      {isScannerOpen && (
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {isRemindersModalOpen && (
        <RemindersModal
          isOpen={isRemindersModalOpen}
          onClose={() => setIsRemindersModalOpen(false)}
          reminders={reminders}
          onAccept={onAcceptReminder}
          onRemove={onRemoveReminder}
        />
      )}
    </div>
  );
};

export default HomePage;

import { User, ACUnit, MaintenanceRecord, Ticket, UserRole, UserStatus, ServiceType, UnitStatus } from '../types';

export const mapUserFromDB = (u: any): User => ({
  id: u.id,
  username: u.username,
  password: u.password,
  email: u.email,
  phone: u.phone,
  role: u.role as UserRole,
  clientName: u.client_name,
  status: u.status as UserStatus,
  avatarUrl: u.avatar_url
});

export const mapMaintenanceFromDB = (r: any): MaintenanceRecord => ({
  id: r.id,
  type: r.type as ServiceType,
  technician: r.technician,
  description: r.description,
  date: r.date,
  time: r.time,
  photos: r.photos || [],
  photoDescriptions: r.photo_descriptions || [],
  rating: r.rating,
  technicalReport: r.technical_report,
  documents: r.documents || []
});

export const mapUnitFromDB = (u: any): ACUnit => ({
  id: u.id,
  clientName: u.client_name,
  department: u.department || '',
  brand: u.brand,
  model: u.model || '',
  serialNumber: u.serial_number,
  btu: u.btu,
  location: u.location,
  regional: u.regional,
  installDate: u.install_date,
  status: u.status as UnitStatus,
  unitPhotos: u.unit_photos || [],
  history: (u.history || []).map((h: any) => mapMaintenanceFromDB(h)),
  planned: (u.planned || []).map((p: any) => ({
    id: p.id,
    type: p.type as ServiceType,
    description: p.description,
    expectedDate: p.expected_date
  }))
});

export const mapTicketFromDB = (t: any): Ticket => ({
  id: t.id,
  unitId: t.unit_id,
  clientName: t.client_name,
  description: t.description,
  date: t.date,
  status: t.status === 'Concluído' ? 'Finalizado' : t.status,
  priority: t.priority,
  technicianId: t.technician_id,
  rating: t.rating,
  feedback: t.feedback,
  rescheduleReason: t.reschedule_reason,
  solution: t.solution,
  technicalReport: t.technical_report,
  photos: t.photos || [],
  documents: t.documents || [],
  createdAt: t.created_at,
  archived: t.archived === true,
  isTransferred: t.is_transferred === true
});

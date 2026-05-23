import React, { useState } from 'react';
import { X, Calendar, CheckCircle } from 'lucide-react';
import { MaintenanceReminder } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reminders: MaintenanceReminder[];
  onAccept: (reminderId: string, date: string) => void;
  onRemove: (reminderId: string) => void;
}

const RemindersModal: React.FC<Props> = ({ isOpen, onClose, reminders, onAccept, onRemove }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [view, setView] = useState<'list' | 'date-picker'>('list');
  const [selectedReminder, setSelectedReminder] = useState<MaintenanceReminder | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  const handleAccept = (reminder: MaintenanceReminder) => {
    setSelectedReminder(reminder);
    setView('date-picker');
  };

  const handleConfirmDate = () => {
    if (selectedReminder && selectedDate) {
      setShowConfirm(true);
    }
  };

  const finalConfirm = () => {
    if (selectedReminder && selectedDate) {
      onAccept(selectedReminder.id, selectedDate);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">Lembretes de Manutenção</h2>
          <button onClick={onClose}><X /></button>
        </div>

        {view === 'list' && (
          <div className="space-y-4">
            {reminders.filter(r => r.status === 'PENDING').map(r => (
              <div key={r.id} className="border p-4 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold">{r.unitName}</p>
                  <p className="text-sm text-gray-500">Manutenção Preventiva</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onRemove(r.id)}
                    className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm"
                  >
                    Excluir
                  </button>
                  <button 
                    onClick={() => handleAccept(r)}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm"
                  >
                    Aceitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'date-picker' && !showConfirm && (
          <div className="space-y-4">
            <h3 className="font-bold">Escolha a data para {selectedReminder?.unitName}</h3>
            <input 
              type="date"
              className="w-full border p-3 rounded-lg"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <button 
              onClick={handleConfirmDate}
              disabled={!selectedDate}
              className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold disabled:opacity-50"
            >
              Confirmar Seleção
            </button>
          </div>
        )}

        {showConfirm && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-center">Confirmar agendamento?</h3>
            <p className="text-center text-gray-600">
              Você deseja agendar a manutenção para {selectedDate.split('-').reverse().join('/')}?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 border p-3 rounded-lg font-bold">Voltar</button>
              <button onClick={finalConfirm} className="flex-1 bg-emerald-600 text-white p-3 rounded-lg font-bold">Confirmar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemindersModal;

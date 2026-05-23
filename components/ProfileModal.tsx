import React, { useState } from 'react';
import { User } from '../types';
import { X, Check } from 'lucide-react';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<User>) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onUpdate }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user.avatarUrl);

  const handleSave = () => {
    onUpdate(user.id, { avatarUrl: avatarUrl || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 my-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black italic tracking-tighter text-gray-900">Meu Perfil</h2>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="mb-8 hidden">
        </div>

        <div className="text-center mb-8 space-y-1">
          <h3 className="text-xl font-bold text-gray-900">{user.username}</h3>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">{user.role}</p>
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-[var(--theme-primary)] text-white py-4 rounded-[1.8rem] font-black uppercase tracking-widest text-sm shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Check className="w-5 h-5" /> Salvar Alterações
        </button>
      </div>
    </div>
  );
};

export default ProfileModal;

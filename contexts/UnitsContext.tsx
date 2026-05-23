
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ACUnit } from '../types';

interface UnitsContextType {
  units: ACUnit[];
  setUnits: React.Dispatch<React.SetStateAction<ACUnit[]>>;
}

const UnitsContext = createContext<UnitsContextType | undefined>(undefined);

export const UnitsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [units, setUnits] = useState<ACUnit[]>([]);
  return (
    <UnitsContext.Provider value={{ units, setUnits }}>
      {children}
    </UnitsContext.Provider>
  );
};

export const useUnits = () => {
  const context = useContext(UnitsContext);
  if (!context) throw new Error('useUnits must be used within a UnitsProvider');
  return context;
};

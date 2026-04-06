import { create } from 'zustand';

interface SetupData {
  // Step 1
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  // Step 2
  companyName: string;
  contactEmail: string;
  phone: string;
  city: string;
  physicalAddress: string;
}

interface SetupState {
  data: SetupData;
  updateData: (partial: Partial<SetupData>) => void;
  reset: () => void;
}

const initialData: SetupData = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  contactEmail: '',
  phone: '',
  city: '',
  physicalAddress: '',
};

export const useSetupStore = create<SetupState>((set) => ({
  data: initialData,
  updateData: (partial) =>
    set((state) => ({ data: { ...state.data, ...partial } })),
  reset: () => set({ data: initialData }),
}));

import React from 'react';

interface ToggleSwitchProps {
  isOn: boolean;
  handleToggle: () => void;
  label: string;
  offColor?: string;
  onColor?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, handleToggle, label, offColor = 'bg-gray-600', onColor = 'bg-blue-600' }) => {
  return (
    <div className="flex items-center justify-center gap-2">
      <label htmlFor={`toggle-switch-${label}`} className="text-sm font-medium text-gray-300">{label}</label>
      <button
        id={`toggle-switch-${label}`}
        onClick={handleToggle}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 ${isOn ? onColor : offColor}`}
        aria-checked={isOn}
        role="switch"
      >
        <span
          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
};

export default ToggleSwitch;
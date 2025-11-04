import React from 'react';

interface CockpitButtonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

const CockpitButton: React.FC<CockpitButtonProps> = ({ title, description, icon, onClick, disabled = false }) => {
  const baseClasses = "h-full w-full group flex flex-col items-center justify-center text-center p-6 bg-gray-800 rounded-lg border border-gray-700 transition-all duration-300 transform focus:outline-none";
  const enabledClasses = "hover:border-blue-500 hover:bg-gray-700 hover:-translate-y-1 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50";
  const disabledClasses = "opacity-50 cursor-not-allowed";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${disabled ? disabledClasses : enabledClasses}`}
      title={description}
    >
      <div className={`mb-4 text-blue-400 ${!disabled && "group-hover:text-blue-300"} transition-colors`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-100 mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </button>
  );
};

export default CockpitButton;
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { log } from '@/services/loggingService';

const LogoutButton: React.FC = () => {
    const auth = useAuth();

    const handleLogout = async () => {
        try {
            await auth.logout();
            log.info('User successfully logged out.');
        } catch (error) {
            log.error('Failed to log out.', error);
        }
    };

    if (!auth.currentUser) {
        return null;
    }

    return (
        <button
            onClick={handleLogout}
            className="p-3 bg-gray-700 text-gray-300 rounded-full shadow-lg hover:bg-red-600 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 animate-fade-in"
            title="Logout"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
        </button>
    );
};

export default LogoutButton;

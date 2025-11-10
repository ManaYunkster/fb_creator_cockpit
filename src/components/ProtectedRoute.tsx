
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { log } from '../services/loggingService';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        // You might want to render a loading spinner here
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <p>Authenticating...</p>
            </div>
        );
    }

    if (!currentUser) {
        log.info('ProtectedRoute: No user found, redirecting to login.');
        return <Navigate to="/login" />;
    }

    log.info(`ProtectedRoute: User ${currentUser.uid} authenticated, rendering children.`);
    return <>{children}</>;
};

export default ProtectedRoute;

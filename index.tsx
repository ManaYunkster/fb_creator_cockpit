
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './src/App';
import LoginPage from './src/components/LoginPage';
import ProtectedRoute from './src/components/ProtectedRoute';
import { AuthProvider } from './src/contexts/AuthContext';
import { TestModeProvider } from './src/contexts/TestModeContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <TestModeProvider>
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route
                            path="/*" // Match all other paths
                            element={
                                <ProtectedRoute>
                                    <App />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Router>
            </AuthProvider>
        </TestModeProvider>
    </React.StrictMode>
);

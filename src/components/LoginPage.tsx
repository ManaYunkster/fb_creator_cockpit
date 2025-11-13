import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { log } from '@/services/loggingService';

declare const google: any; // Declare the 'google' global variable

const LoginPage: React.FC = () => {
    const { currentUser, loginWithGoogle, loginWithEmail, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loading) {
            log.info('LoginPage: Initializing Google One-tap.');
            try {
                google.accounts.id.initialize({
                    client_id: import.meta.env.VITE_FIREBASE_CLIENT_ID,
                    callback: handleGoogleOneTap,
                });
            } catch (e) {
                log.error('LoginPage: Google One-tap initialization failed.', e);
                setError('Could not initialize Google Sign-In.');
            }
        }
    }, [loading]);

    const handleGoogleOneTap = async (response: any) => {
        log.info('LoginPage: Google One-tap credential received.');
        setError(null);
        try {
            await loginWithGoogle(response.credential);
        } catch (error) {
            log.error('LoginPage: Google One-tap login failed.', error);
            setError('Failed to sign in with Google One-tap.');
        }
    };

    const handleGoogleSignInClick = () => {
        log.info('LoginPage: "Sign in with Google" button clicked, triggering prompt.');
        setError(null);
        try {
            google.accounts.id.prompt(); // Manually trigger the prompt on click
        } catch (error) {
            log.error('LoginPage: Failed to trigger Google One-tap prompt.', error);
            setError('Could not start Google Sign-In.');
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        log.info(`LoginPage: Attempting to sign in with email.`);
        try {
            await loginWithEmail(email, password);
        } catch (err: any) {
            log.error('LoginPage: Email authentication failed', { code: err.code, message: err.message });
            setError(err.message || `Failed to sign in.`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <p>Loading...</p>
            </div>
        );
    }

    if (currentUser) {
        log.info('LoginPage: User already logged in, redirecting to home.');
        return <Navigate to="/" />;
    }

    return (
        <div className="flex items-center justify-center h-screen bg-gray-900">
            <div className="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
                <h1 className="text-3xl font-bold text-white text-center mb-4">Sign In</h1>
                {error && <p className="text-red-400 text-center mb-4">{error}</p>}
                <form onSubmit={handleEmailAuth}>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2" htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                    >
                        Sign In
                    </button>
                </form>
                <div className="text-center my-4">
                    <span className="text-gray-500">OR</span>
                </div>
                <button
                    onClick={handleGoogleSignInClick}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                >
                    Sign in with Google
                </button>
            </div>
        </div>
    );
};

export default LoginPage;

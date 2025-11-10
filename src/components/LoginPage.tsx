import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { log } from '@/services/loggingService';

const LoginPage: React.FC = () => {
    const { currentUser, loginWithGoogle, loginWithEmail, signupWithEmail, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        log.info('LoginPage: Initiating Google login.');
        try {
            await loginWithGoogle();
        } catch (error) {
            log.error('LoginPage: Google login failed.', error);
            setError('Failed to sign in with Google.');
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        log.info(`LoginPage: Attempting to ${isSignUp ? 'sign up' : 'sign in'} with email.`);
        try {
            if (isSignUp) {
                await signupWithEmail(email, password);
            } else {
                await loginWithEmail(email, password);
            }
        } catch (err: any) {
            log.error('LoginPage: Email authentication failed', { code: err.code, message: err.message });
            setError(err.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}.`);
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

    // User is not logged in, show the login/signup form.
    return (
        <div className="flex items-center justify-center h-screen bg-gray-900">
            <div className="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
                <h1 className="text-3xl font-bold text-white text-center mb-4">{isSignUp ? 'Create Account' : 'Sign In'}</h1>
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
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                    </button>
                </form>
                <div className="text-center my-4">
                    <span className="text-gray-500">OR</span>
                </div>
                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                >
                    Sign in with Google
                </button>
                <div className="text-center mt-6">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }}
                        className="text-blue-400 hover:underline"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;

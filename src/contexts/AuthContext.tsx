import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Auth, User, onAuthStateChanged, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCredential } from 'firebase/auth';
import { auth } from '@/firebase'; // Assuming 'auth' is exported from your firebase config
import { log } from '@/services/loggingService';

// Define the shape of the context's value
interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    loginWithGoogle: (idToken: string) => Promise<void>;
    logout: () => Promise<void>;
    signupWithEmail: (email: string, password: string) => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
}

// Create the context with a default undefined value
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the AuthContext
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Define the props for the provider component
interface AuthProviderProps {
    children: ReactNode;
}

// Create the provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Subscribe to Firebase auth state changes
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            setLoading(false);
            log.info(`AuthProvider: Auth state changed. User: ${user ? user.uid : 'null'}`);
        });

        // Cleanup subscription on unmount
        return unsubscribe;
    }, []);

    const loginWithGoogle = async (idToken: string) => {
        setLoading(true);
        log.info('AuthProvider: Initiating Google One-tap login.');
        try {
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
            log.info('AuthProvider: Successfully logged in with Google One-tap.');
        } catch (error) {
            log.error('AuthProvider: Error logging in with Google One-tap', error);
        } finally {
            setLoading(false);
        }
    };

    const signupWithEmail = async (email: string, password: string) => {
        setLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            log.info(`AuthProvider: Successfully signed up with email: ${email}`);
        } catch (error) {
            log.error('AuthProvider: Error signing up with email', error);
        } finally {
            setLoading(false);
        }
    };

    const loginWithEmail = async (email: string, password: string) => {
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            log.info(`AuthProvider: Successfully logged in with email: ${email}`);
        } catch (error) {
            log.error('AuthProvider: Error logging in with email', error);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await signOut(auth);
            log.info('AuthProvider: Successfully logged out.');
        } catch (error) {
            log.error('AuthProvider: Error logging out', error);
        } finally {
            setLoading(false);
        }
    };

    // The value provided to the consumer components
    const value = {
        currentUser,
        loading,
        loginWithGoogle,
        logout,
        signupWithEmail,
        loginWithEmail
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

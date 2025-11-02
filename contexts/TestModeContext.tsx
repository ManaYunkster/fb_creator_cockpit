import React, { createContext, useState, ReactNode, useCallback } from 'react';

type TestId = 'NAME_CACHE_TEST';

const ALL_TEST_IDS: TestId[] = ['NAME_CACHE_TEST'];

interface TestModeContextType {
    isTestMode: boolean;
    activeTests: Set<TestId>;
    toggleTestMode: () => void;
    toggleTest: (testId: TestId) => void;
    setAllTestsOn: () => void;
    setAllTestsOff: () => void;
}

export const TestModeContext = createContext<TestModeContextType>({
    isTestMode: false,
    activeTests: new Set(),
    toggleTestMode: () => {},
    toggleTest: () => {},
    setAllTestsOn: () => {},
    setAllTestsOff: () => {},
});

export const TestModeProvider = ({ children }: { children: ReactNode }) => {
    const [isTestMode, setIsTestMode] = useState(false);
    const [activeTests, setActiveTests] = useState<Set<TestId>>(new Set(ALL_TEST_IDS));

    const toggleTestMode = useCallback(() => {
        setIsTestMode(prev => !prev);
    }, []);

    const toggleTest = useCallback((testId: TestId) => {
        setActiveTests(prev => {
            const newSet = new Set(prev);
            if (newSet.has(testId)) {
                newSet.delete(testId);
            } else {
                newSet.add(testId);
            }
            return newSet;
        });
    }, []);
    
    const setAllTestsOn = useCallback(() => {
        setActiveTests(new Set(ALL_TEST_IDS));
    }, []);

    const setAllTestsOff = useCallback(() => {
        setActiveTests(new Set());
    }, []);

    return (
        <TestModeContext.Provider value={{ isTestMode, activeTests, toggleTestMode, toggleTest, setAllTestsOn, setAllTestsOff }}>
            {children}
        </TestModeContext.Provider>
    );
};

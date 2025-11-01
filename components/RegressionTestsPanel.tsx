import React, { useContext } from 'react';
import { TestModeContext } from '../contexts/TestModeContext';

const RegressionTestsPanel: React.FC = () => {
    const { activeTests, toggleTest, setAllTestsOn, setAllTestsOff } = useContext(TestModeContext);
    
    return (
        <div className="space-y-6 text-gray-300 animate-fade-in-up">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-100">Available Regression Tests</h3>
                        <p className="text-sm text-gray-400 mt-1">
                            Enable specific test conditions to validate application features. These tests may alter default behavior or load specific test data.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button onClick={setAllTestsOn} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md">All On</button>
                        <button onClick={setAllTestsOff} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md">All Off</button>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="name-cache-test"
                            checked={activeTests.has('NAME_CACHE_TEST')}
                            onChange={() => toggleTest('NAME_CACHE_TEST')}
                            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                            <label htmlFor="name-cache-test" className="text-sm font-medium text-gray-200">
                                Name Cache Test
                            </label>
                            <p className="text-xs text-gray-400">
                                Tests the display name caching feature. When enabled, a test file ('cache_test.txt') is uploaded with a different internal name ('__cc_test_cache_test.txt') but displayed with its original name in the UI.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegressionTestsPanel;

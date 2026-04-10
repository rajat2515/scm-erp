import React from 'react';

const MarksEntry: React.FC = () => {
    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
            <div className="text-center max-w-lg">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 mb-4">
                    Marks Entry
                </h1>
                <p className="text-slate-500">
                    This section is currently under development. Soon, you will be able to input student exam scores and calculate grades directly from here.
                </p>
            </div>
        </div>
    );
};

export default MarksEntry;

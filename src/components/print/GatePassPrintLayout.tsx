import React from 'react';

// Using props so the main component can inject the exact details for printing.
export interface GatePassData {
    studentName: string;
    studentClass: string;
    srNo: string;
    placeOfLiving: string;
    parentName: string;
    parentContact: string;
    reason: string;
    date: string;
    time: string;
}

interface PrintLayoutProps {
    data: GatePassData;
}

export const GatePassPrintLayout: React.FC<PrintLayoutProps> = ({ data }) => {
    return (
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white px-6 py-4 font-sans text-black z-[9999]">
            {/* Header Section */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
                <img 
                    src="/school-logo.png" 
                    alt="School Logo" 
                    className="w-16 h-16 object-contain"
                />
                <div className="text-center flex-1 mx-4">
                    <h1 className="text-xl font-black uppercase tracking-wider text-black m-0 leading-tight">S.C.M. CHILDREN ACADEMY</h1>
                    <p className="text-xs font-semibold m-0 leading-tight mt-0.5">Affiliation No: 2132374 | School Code: 81858</p>
                    <p className="text-xs font-bold mt-0.5 m-0 leading-tight">HALDAUR, BIJNOR</p>
                </div>
            </div>

            {/* Title */}
            <div className="text-center mb-2">
                <h2 className="text-base font-bold uppercase underline decoration-2 underline-offset-2 m-0">Gate Pass - Early Departure</h2>
            </div>

            {/* Pass Body */}
            <div className="border border-black p-3 rounded-xl text-sm space-y-2">
                
                {/* Datetime row */}
                <div className="flex justify-between font-bold text-xs">
                    <div>Date: <span className="font-normal underline decoration-dotted">{data.date || '_________________'}</span></div>
                    <div>Time Out: <span className="font-normal underline decoration-dotted">{data.time || '_________________'}</span></div>
                </div>

                <div className="space-y-1 pt-1.5 border-t border-gray-300 text-xs">
                    <h3 className="font-bold text-sm bg-gray-100 p-1 rounded mb-1">Student Information</h3>
                    <div className="grid grid-cols-2 gap-y-1">
                        <div><span className="font-semibold">Student Name:</span> {data.studentName || '________________________'}</div>
                        <div><span className="font-semibold">S.R. No:</span> {data.srNo || '________________________'}</div>
                        <div><span className="font-semibold">Class:</span> {data.studentClass || '________________________'}</div>
                        <div><span className="font-semibold">Place of Living:</span> {data.placeOfLiving || '________________________'}</div>
                    </div>
                </div>

                <div className="space-y-1 pt-1.5 border-t border-gray-300 text-xs">
                    <h3 className="font-bold text-sm bg-gray-100 p-1 rounded mb-1">Parent / Guardian Information</h3>
                    <div className="grid grid-cols-2 gap-y-1">
                        <div><span className="font-semibold">Authorized By:</span> {data.parentName || '________________________'}</div>
                        <div><span className="font-semibold">Contact No:</span> {data.parentContact || '________________________'}</div>
                    </div>
                </div>
                
                <div className="space-y-1 pt-1.5 border-t border-gray-300 pb-1 text-xs">
                    <div><span className="font-semibold">Reason for Early Leave:</span></div>
                    <div className="w-full border-b border-dotted border-black min-h-[1.2rem] pt-0.5 leading-snug">
                        {data.reason || ''}
                    </div>
                    {!data.reason && <div className="w-full border-b border-dotted border-black min-h-[1.2rem] mt-1"></div>}
                </div>

            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-3 gap-8 mt-5 text-center">
                <div className="flex flex-col items-center">
                    <div className="w-28 border-t border-black pt-1 font-bold uppercase text-[9px] leading-tight">Parent / Guardian<br/>Signature</div>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-28 border-t border-black pt-1 font-bold uppercase text-[9px] leading-tight">Security Officer<br/>Signature</div>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-28 border-t border-black pt-1 font-bold uppercase text-[9px] leading-tight">Administration<br/>Signature</div>
                </div>
            </div>
            
            <div className="text-center text-[9px] text-gray-500 mt-2 font-medium">
                Generated by SCM ERP System • Valid only for the Date and Time stated above
            </div>

            {/* Print specific CSS to force page formatting and hide everything else */}
            <style>{`
                @media print {
                    @page { size: A5 landscape; margin: 5mm; }
                    body * { visibility: hidden; }
                    .print\\:block, .print\\:block * { visibility: visible !important; }
                    .print\\:block {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        box-sizing: border-box;
                    }
                }
            `}</style>
        </div>
    );
};

export default GatePassPrintLayout;

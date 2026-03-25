import React from 'react';

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
        <div className="hidden print:block">
            <style>{`
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }

                    html, body {
                        width: 80mm;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white;
                    }

                    body * {
                        visibility: hidden;
                    }

                    .thermal-print-root,
                    .thermal-print-root * {
                        visibility: visible !important;
                    }

                    .thermal-print-root {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 80mm !important;
                        margin: 0 !important;
                        padding: 3mm !important;
                        box-sizing: border-box !important;
                    }
                }
            `}</style>

            <div
                className="thermal-print-root"
                style={{
                    width: '80mm',
                    padding: '3mm',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '10px',
                    color: '#000',
                    backgroundColor: '#fff',
                    boxSizing: 'border-box',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '2mm', marginBottom: '2mm' }}>
                    <img
                        src="/school-logo.png"
                        alt="Logo"
                        style={{ width: '10mm', height: '10mm', objectFit: 'contain', marginRight: '2mm' }}
                    />
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            S.C.M. CHILDREN ACADEMY
                        </div>
                        <div style={{ fontSize: '7px', fontWeight: 600 }}>Aff. No: 2132374 | Code: 81858</div>
                        <div style={{ fontSize: '7px', fontWeight: 700 }}>HALDAUR, BIJNOR</div>
                    </div>
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '10px', textDecoration: 'underline', textTransform: 'uppercase' }}>
                        Gate Pass - Early Departure
                    </div>
                </div>

                {/* Date & Time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', marginBottom: '2mm' }}>
                    <span>Date: <span style={{ fontWeight: 'normal' }}>{data.date}</span></span>
                    <span>Time: <span style={{ fontWeight: 'normal' }}>{data.time}</span></span>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #ccc', marginBottom: '2mm' }} />

                {/* Student Info */}
                <div style={{ fontSize: '9px', marginBottom: '2mm' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px', background: '#eee', padding: '1mm 2mm', marginBottom: '1mm' }}>
                        Student Information
                    </div>
                    <div><span style={{ fontWeight: 600 }}>Name:</span> {data.studentName || '—'}</div>
                    <div style={{ display: 'flex', gap: '4mm' }}>
                        <span><span style={{ fontWeight: 600 }}>Class:</span> {data.studentClass || '—'}</span>
                        <span><span style={{ fontWeight: 600 }}>SR:</span> {data.srNo || '—'}</span>
                    </div>
                    <div><span style={{ fontWeight: 600 }}>Address:</span> {data.placeOfLiving || '—'}</div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #ccc', marginBottom: '2mm' }} />

                {/* Parent Info */}
                <div style={{ fontSize: '9px', marginBottom: '2mm' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px', background: '#eee', padding: '1mm 2mm', marginBottom: '1mm' }}>
                        Parent / Guardian
                    </div>
                    <div><span style={{ fontWeight: 600 }}>Name:</span> {data.parentName || '—'}</div>
                    <div><span style={{ fontWeight: 600 }}>Contact:</span> {data.parentContact || '—'}</div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #ccc', marginBottom: '2mm' }} />

                {/* Reason */}
                <div style={{ fontSize: '9px', marginBottom: '3mm' }}>
                    <div style={{ fontWeight: 600, marginBottom: '1mm' }}>Reason for Early Leave:</div>
                    <div style={{ borderBottom: '1px dotted black', minHeight: '5mm', paddingBottom: '1mm' }}>
                        {data.reason || ''}
                    </div>
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5mm', fontSize: '8px', textAlign: 'center' }}>
                    {['Parent', 'Security', 'Admin'].map((label) => (
                        <div key={label} style={{ width: '28%' }}>
                            <div style={{ borderTop: '1px solid black', paddingTop: '1mm', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                {label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', fontSize: '7px', color: '#666', marginTop: '2mm' }}>
                    SCM ERP System • Valid for date &amp; time stated above
                </div>
            </div>
        </div>
    );
};

export default GatePassPrintLayout;
import React from 'react';

interface A4PrintLayoutProps {
    title: string;
    children: React.ReactNode;
}

export const A4PrintLayout = React.forwardRef<HTMLDivElement, A4PrintLayoutProps>(({ title, children }, ref) => {
    return (
        <div ref={ref} className="hidden print:block a4-print-wrapper bg-white">
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 5mm;
                    }

                    body > * {
                        display: none !important;
                    }

                    body > *:has(.a4-print-wrapper),
                    .a4-print-wrapper {
                        display: block !important;
                    }

                    html, body {
                        width: 210mm !important;
                        min-height: 297mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }

                    .a4-print-root {
                        width: 100% !important;
                        padding: 5mm !important;
                        box-sizing: border-box !important;
                        color: black !important;
                    }

                    /* Utility classes for form layout */
                    .form-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    .form-row {
                        margin-bottom: 10px;
                    }
                    .form-label {
                        font-weight: bold;
                        font-size: 13px;
                        margin-bottom: 3px;
                        display: block;
                    }
                    .form-input {
                        border-bottom: 1px dotted black;
                        min-height: 20px;
                        width: 100%;
                    }
                    .form-box {
                        border: 1px solid black;
                        height: 120px;
                        width: 100px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        color: #666;
                        text-align: center;
                    }
                }
            `}</style>
            
            <div className="a4-print-root" style={{ fontFamily: 'Arial, sans-serif' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '2px solid black', paddingBottom: '15px', marginBottom: '20px' }}>
                    <div style={{ width: '100px' }}>
                        <img 
                            src="/school-logo.png" 
                            alt="Logo" 
                            style={{ width: '80px', height: '80px', objectFit: 'contain' }} 
                        />
                    </div>
                    
                    <div style={{ textAlign: 'center', flex: 1, paddingTop: '5px' }}>
                        <div style={{ fontWeight: 900, fontSize: '26px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            S.C.M. CHILDREN ACADEMY
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '5px' }}>Aff. No: 2132374 | Code: 81858</div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>HALDAUR, BIJNOR</div>
                    </div>

                    <div style={{ width: '100px' }}>
                        {/* Empty right placeholder for balance */}
                    </div>
                </div>

                {/* Form Title */}
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '20px', textDecoration: 'underline', textTransform: 'uppercase', display: 'inline-block' }}>
                        {title}
                    </div>
                </div>

                {/* Content */}
                <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                    {children}
                </div>

                {/* Standard Footer */}
                <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', padding: '0 20px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid black', width: '200px', paddingTop: '5px' }}>
                            Applicant Signature
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid black', width: '200px', paddingTop: '5px' }}>
                            Principal / Admin Signature
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
A4PrintLayout.displayName = 'A4PrintLayout';

import React from 'react';
import { A4PrintLayout } from '../print/A4PrintLayout';

interface Props {
    ref?: React.Ref<HTMLDivElement>;
}

export const StaffRegistrationPrint = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
    return (
        <A4PrintLayout title="Staff Registration Form" ref={ref}>
            <div style={{ position: 'relative' }}>
                {/* Photo box */}
                <div style={{ position: 'absolute', top: 0, right: 0 }} className="form-box">
                    Passport Size Photo
                </div>

                {/* Form fields */}
                <div style={{ width: 'calc(100% - 120px)' }}>
                    <div className="form-row">
                        <span className="form-label">Position Applied For:</span>
                        <div className="form-input" style={{ width: '250px' }}></div>
                    </div>
                    
                    <div className="form-row">
                        <span className="form-label">Date of Application (DD/MM/YYYY):</span>
                        <div className="form-input" style={{ width: '250px' }}></div>
                    </div>
                </div>

                <div style={{ clear: 'both' }}></div>

                <div style={{ marginTop: '30px' }}>
                    <div className="form-row">
                        <span className="form-label">1. Full Name (in Block Letters):</span>
                        <div className="form-input"></div>
                    </div>

                    <div className="form-grid">
                        <div className="form-row">
                            <span className="form-label">2. Date of Birth:</span>
                            <div className="form-input"></div>
                        </div>
                        <div className="form-row">
                            <span className="form-label">3. Gender:</span>
                            <div className="form-input"></div>
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="form-row">
                            <span className="form-label">4. Marital Status:</span>
                            <div className="form-input"></div>
                        </div>
                        <div className="form-row">
                            <span className="form-label">5. Aadhaar / Pan Number:</span>
                            <div className="form-input"></div>
                        </div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">6. Father's / Husband's Name:</span>
                        <div className="form-input"></div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">7. Present Residential Address:</span>
                        <div className="form-input"></div>
                        <div className="form-input" style={{ marginTop: '10px' }}></div>
                    </div>

                    <div className="form-grid">
                        <div className="form-row">
                            <span className="form-label">8. Phone / Mobile No:</span>
                            <div className="form-input"></div>
                        </div>
                        <div className="form-row">
                            <span className="form-label">9. Email Address:</span>
                            <div className="form-input"></div>
                        </div>
                    </div>

                    <div className="form-row" style={{ marginTop: '15px' }}>
                        <span className="form-label">10. Educational Qualifications:</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginTop: '10px', fontWeight: 'bold' }}>
                            <div>Degree / Exam</div>
                            <div>University / Board</div>
                            <div>Year</div>
                            <div>% / Grade</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                            <div className="form-input"></div><div className="form-input"></div><div className="form-input"></div><div className="form-input"></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                            <div className="form-input"></div><div className="form-input"></div><div className="form-input"></div><div className="form-input"></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                            <div className="form-input"></div><div className="form-input"></div><div className="form-input"></div><div className="form-input"></div>
                        </div>
                    </div>

                    <div className="form-row" style={{ marginTop: '20px' }}>
                        <span className="form-label">11. Work Experience:</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginTop: '10px', fontWeight: 'bold' }}>
                            <div>Organization</div>
                            <div>Designation</div>
                            <div>From</div>
                            <div>To</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                            <div className="form-input"></div><div className="form-input"></div><div className="form-input"></div><div className="form-input"></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                            <div className="form-input"></div><div className="form-input"></div><div className="form-input"></div><div className="form-input"></div>
                        </div>
                    </div>

                </div>
            </div>
        </A4PrintLayout>
    );
});
StaffRegistrationPrint.displayName = 'StaffRegistrationPrint';

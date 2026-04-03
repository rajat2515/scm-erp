import React from 'react';
import { A4PrintLayout } from '../print/A4PrintLayout';

interface Props {
    ref?: React.Ref<HTMLDivElement>;
}

export const StudentRegistrationPrint = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
    return (
        <A4PrintLayout title="Student Registration Form" ref={ref}>
            <div style={{ position: 'relative' }}>
                {/* Photo box */}
                <div style={{ position: 'absolute', top: 0, right: 0 }} className="form-box">
                    Passport Size Photo
                </div>

                {/* Form fields */}
                <div style={{ width: 'calc(100% - 120px)' }}>
                    <div className="form-row">
                        <span className="form-label">Admission Number:</span>
                        <div className="form-input" style={{ width: '200px' }}></div>
                    </div>
                    
                    <div className="form-row">
                        <span className="form-label">Admission Date (DD/MM/YYYY):</span>
                        <div className="form-input" style={{ width: '200px' }}></div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">Admission required for Class:</span>
                        <div className="form-input" style={{ width: '200px' }}></div>
                    </div>
                </div>

                <div style={{ clear: 'both' }}></div>

                <div style={{ marginTop: '30px' }}>
                    <div className="form-row">
                        <span className="form-label">1. Full Name of the Student (in Block Letters):</span>
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
                            <span className="form-label">4. Nationality:</span>
                            <div className="form-input"></div>
                        </div>
                        <div className="form-row">
                            <span className="form-label">5. Religion / Caste:</span>
                            <div className="form-input"></div>
                        </div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">6. Father's Name (in Block Letters):</span>
                        <div className="form-input"></div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">7. Mother's Name (in Block Letters):</span>
                        <div className="form-input"></div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">8. Guardian's Name (if any):</span>
                        <div className="form-input"></div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">9. Occupation of Parents / Guardian:</span>
                        <div className="form-input"></div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">10. Present Residential Address:</span>
                        <div className="form-input"></div>
                        <div className="form-input" style={{ marginTop: '10px' }}></div>
                    </div>

                    <div className="form-grid">
                        <div className="form-row">
                            <span className="form-label">11. Phone / Mobile No:</span>
                            <div className="form-input"></div>
                        </div>
                        <div className="form-row">
                            <span className="form-label">12. Email Address (Optional):</span>
                            <div className="form-input"></div>
                        </div>
                    </div>

                    <div className="form-row">
                        <span className="form-label">13. Name of Previous School Attended (if any):</span>
                        <div className="form-input"></div>
                    </div>

                    <div className="form-grid">
                        <div className="form-row">
                            <span className="form-label">14. Class previously studied:</span>
                            <div className="form-input"></div>
                        </div>
                        <div className="form-row">
                            <span className="form-label">15. Transfer Certificate No. & Date:</span>
                            <div className="form-input"></div>
                        </div>
                    </div>

                </div>
            </div>
        </A4PrintLayout>
    );
});
StudentRegistrationPrint.displayName = 'StudentRegistrationPrint';

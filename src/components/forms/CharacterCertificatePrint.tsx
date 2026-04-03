import React from 'react';
import { A4PrintLayout } from '../print/A4PrintLayout';

interface Props {
    ref?: React.Ref<HTMLDivElement>;
}

export const CharacterCertificatePrint = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
    return (
        <A4PrintLayout title="Character & Verification Certificate" ref={ref}>
            <div style={{ position: 'relative', marginTop: '20px', lineHeight: '2.5', fontSize: '16px' }}>

                <div style={{ textAlign: 'right', marginBottom: '30px' }}>
                    <strong>Date: </strong> <span style={{ display: 'inline-block', width: '150px', borderBottom: '1px dotted black' }}></span>
                </div>

                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20px', marginBottom: '30px', textDecoration: 'underline' }}>
                    TO WHOM IT MAY CONCERN
                </div>

                <div style={{ textIndent: '50px', textAlign: 'justify' }}>
                    This is to certify that <strong>Master / Kumari</strong> <span style={{ display: 'inline-block', width: '300px', borderBottom: '1px dotted black' }}></span>, 
                    Son / Daughter of <strong>Mr.</strong> <span style={{ display: 'inline-block', width: '300px', borderBottom: '1px dotted black' }}></span> 
                    and <strong>Mrs.</strong> <span style={{ display: 'inline-block', width: '300px', borderBottom: '1px dotted black' }}></span>, 
                    resident of <span style={{ display: 'inline-block', width: '400px', borderBottom: '1px dotted black' }}></span> 
                    is / was a bona fide student of this institution.
                </div>

                <div style={{ textIndent: '50px', textAlign: 'justify', marginTop: '20px' }}>
                    He / She is studying / has studied in Class <span style={{ display: 'inline-block', width: '150px', borderBottom: '1px dotted black' }}></span> 
                    during the academic year <span style={{ display: 'inline-block', width: '150px', borderBottom: '1px dotted black' }}></span>. 
                    His / Her admission number is <span style={{ display: 'inline-block', width: '150px', borderBottom: '1px dotted black' }}></span> and 
                    date of birth as per our school records is <span style={{ display: 'inline-block', width: '150px', borderBottom: '1px dotted black' }}></span>.
                </div>

                <div style={{ textIndent: '50px', textAlign: 'justify', marginTop: '20px' }}>
                    To the best of my knowledge and belief, he / she bears a <strong>GOOD / EXCELLENT</strong> moral character and 
                    has not been involved in any indisciplinary activities during his / her stay in the school. 
                </div>

                <div style={{ textIndent: '50px', textAlign: 'justify', marginTop: '20px' }}>
                    We wish him / her all success in his / her future endeavors.
                </div>

                <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ marginTop: '50px' }}>
                            <strong>(Class Teacher)</strong>
                        </div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '100px', height: '100px', border: '1px dashed #ccc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            <span style={{ fontSize: '12px', color: '#999' }}>School Seal</span>
                        </div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ marginTop: '50px' }}>
                            <strong>(Principal)</strong>
                        </div>
                    </div>
                </div>

            </div>
        </A4PrintLayout>
    );
});
CharacterCertificatePrint.displayName = 'CharacterCertificatePrint';

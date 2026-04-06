import React from 'react';

export interface TCData {
    schoolNo: string;
    bookNo: string;
    srNo: string;
    udiseNo: string;
    affiliationNo: string;
    renewedTo: string;
    statusOfSchool: string;
    regNoOfCandidate: string;
    
    pupilName: string;
    penNumber: string;
    motherName: string;
    fatherName: string;
    nationality: string;
    category: string;
    dobFig: string;
    dobWords: string;
    isFailed: string;
    subjects: string;
    lastClass: string;
    lastExamResult: string;
    qualifiedPromotion: string;
    paidDues: string;
    nccDetail: string;
    dateStruckOff: string;
    reasonForLeaving: string;
    totalMeetings: string;
    meetingsAttended: string;
    generalConduct: string;
    remarks: string;
    issueDate: string;
}

interface Props {
    data: TCData;
}

export const TransferCertificatePrint = React.forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
    return (
        <div ref={ref} className="hidden print:block bg-white p-0 m-0" style={{ width: '210mm', minHeight: '297mm', color: 'black', fontFamily: "'Times New Roman', Times, serif" }}>
            <div className="p-6">
                {/* Header Section */}
                <div className="flex items-center justify-between gap-4 border-b-2 border-black pb-2 mb-2">
                    <img src="/school-logo.png" alt="Logo" className="w-24 h-24 object-contain" />
                    <div className="flex-1 text-center">
                        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1e3a8a' }}>SCM CHILDREN ACADEMY</h1>
                        <p className="text-[10px] font-semibold">Ward No 9, Town - Haldaur, District - Bijnor, U.P. Pin - 246726, Mob: 01342297277, 9319787083</p>
                        <p className="text-xs font-semibold">Affiliated to Central Board of Secondary Education New Delhi</p>
                        <div className="flex justify-center gap-4 text-[10px]">
                            <span>Web: scmchildrenacademy.in</span>
                            <span>Email: scmchildrenacademy@gmail.com</span>
                        </div>
                    </div>
                    <img src="/cbse-logo.png" alt="CBSE Logo" className="w-20 h-20 object-contain" />
                </div>

                {/* Title */}
                <div className="text-center mb-4">
                    <div className="inline-block bg-slate-800 text-white px-8 py-0.5 rounded shadow-sm text-base font-bold tracking-widest uppercase">
                        TRANSFER CERTIFICATE
                    </div>
                </div>

                {/* Sub-header grid */}
                <div className="grid grid-cols-3 gap-y-1.5 gap-x-8 text-[12px] mb-4 px-2 font-semibold">
                    <div className="flex justify-between border-b border-black">
                        <span>School No.</span>
                        <span>{data.schoolNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-black">
                        <span>Book No.</span>
                        <span>{data.bookNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-black">
                        <span>S.R. No.</span>
                        <span>{data.srNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-black">
                        <span>Udise No.</span>
                        <span>{data.udiseNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-black">
                        <span>Affiliation No.</span>
                        <span>{data.affiliationNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-black">
                        <span>Renewed to</span>
                        <span>{data.renewedTo}</span>
                    </div>
                    <div className="col-span-3 flex justify-between border-b border-black py-0.5">
                        <span>Status of School :</span>
                        <span className="flex-1 text-center px-4">{data.statusOfSchool}</span>
                    </div>
                    <div className="col-span-3 flex justify-between border-b border-black py-0.5">
                        <span>Registration No. of the Candidate (in case class IX to XII) :</span>
                        <span className="flex-1 text-center px-4">{data.regNoOfCandidate || '—'}</span>
                    </div>
                </div>

                {/* 22 Items */}
                <div className="space-y-0.5 text-[12px]">
                    {[
                        { label: "Name of the Pupil", value: data.pupilName, upper: true },
                        { label: "PEN NUMBER", value: data.penNumber },
                        { label: "Mother's Name", value: data.motherName, upper: true },
                        { label: "Father's Name", value: data.fatherName, upper: true },
                        { label: "Nationality", value: data.nationality, upper: true },
                        { label: "Whether the pupil belongs to SC/ST/OBC Category", value: data.category, upper: true },
                        { label: "Date of birth according to admission Register : (In Fig.)", value: data.dobFig },
                        { label: "( In Words)", value: data.dobWords, upper: true },
                        { label: "Whether the student is failed", value: data.isFailed, upper: true },
                        { label: "Subject offered", value: data.subjects, upper: true },
                        { label: "Class in which the pupil last studied", value: data.lastClass, upper: true },
                        { label: "School / Board Annual Examination last taken with result", value: data.lastExamResult, upper: true },
                        { label: "Whether qualified for promotion to the next higher classes", value: data.qualifiedPromotion, upper: true },
                        { label: "Whether the pupil has paid all dues to the Vidyalaya", value: data.paidDues, upper: true },
                        { label: "Whether the pupil is NCC Cadet / Boy Scout / Girl Guide (Given Detail)", value: data.nccDetail, upper: true },
                        { label: "Date on which Pupils' Name was struck off the rolls of the Vidyalaya", value: data.dateStruckOff },
                        { label: "Reason for leaving the Vidyalaya", value: data.reasonForLeaving, upper: true },
                        { label: "No. of meetings up to date", value: data.totalMeetings },
                        { label: "No. of school days the pupil attended", value: data.meetingsAttended },
                        { label: "General conduct", value: data.generalConduct, upper: true },
                        { label: "Any other Remark", value: data.remarks, upper: true },
                        { label: "Date of issue of certificate", value: data.issueDate },
                    ].map((item, idx) => (
                        <div key={idx} className="flex border-b border-gray-100 py-0.5">
                            <div className="w-8 text-right pr-3 font-bold">{idx + 1}</div>
                            <div className="flex-1 font-semibold">{item.label} :</div>
                            <div className={`w-[280px] text-center font-bold ${item.upper ? 'uppercase' : ''}`}>
                                {item.value || (item.label.includes('Date') ? '' : '—')}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Signatures */}
                <div className="mt-24 flex justify-between items-end px-4">
                    <div className="text-center">
                        <p className="font-bold text-xs">Prepared By</p>
                        <p className="text-[9px] text-gray-500">(Name & Designation)</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-xs">Checked By</p>
                        <p className="text-[9px] text-gray-500">(Name & Designation)</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-xs">Principal Sign</p>
                        <p className="text-[9px] text-gray-500">(Sign of Principal With Official Seal)</p>
                    </div>
                </div>

                {/* Note */}
                <div className="mt-4 text-[9px] italic border-t border-black pt-1">
                    Note : - If this T.C. is issued by the officiating / Incharge Principal, In variably countersigned by the Manager V.M.C.
                </div>
            </div>
            
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
});

TransferCertificatePrint.displayName = 'TransferCertificatePrint';

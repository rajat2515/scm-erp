// ─── User / Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'teacher' | 'student';

export interface AuthUser {
    id: string;
    email: string | null;
    displayName: string | null;
    role: UserRole;
}

// ─── Student (SR Register schema) ───────────────────────────────────────────

export interface Student {
    sr_no: number;                          // S.R. No — primary key
    roll_no?: string;                       // Roll No
    name: string;
    class?: string;                         // Class (e.g. 'Class 5', 'ONE')
    dob?: string;                           // Date of Birth (ISO date)
    admission_date?: string;                // Date of Admission (ISO date)
    gender: 'male' | 'female' | 'other';
    mother_name?: string;
    father_name?: string;
    father_income?: number | null;
    address?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    aadhar_card?: string;
    pen_no?: string;
    caste?: string;
    religion?: string;
    blood_group?: string;
    rte?: string;                          // Right to Education — 'YES', 'NO', 'RTE', or NULL
    occupation?: string;
    nationality?: string;
    house?: string;
    status: 'active' | 'inactive' | 'transferred';
    created_at?: string;
}


// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffProfile {
    id: string; // UUID
    name: string;
    fathers_spouse_name?: string;
    dob?: string;
    qualification?: string;
    designation: string; // e.g. 'Principal', 'T.G.T.', 'P.R.T.'
    appointment_date?: string;
    teaching_subject?: string;
    trained_status?: 'Trained' | 'Untrained';
    basic_pay: number;
    grade_pay: number;
    status: 'active' | 'inactive';
    created_at?: string;
    updated_at?: string;
}

export interface StaffAttendance {
    id: string; // UUID
    staff_id: string; // UUID of StaffProfile
    date: string; // YYYY-MM-DD
    status: 'Present' | 'Absent' | 'Half-day' | 'Leave';
    created_at?: string;
}

// ─── Fees ─────────────────────────────────────────────────────────────────────

export type FeeStatus = 'paid' | 'partial' | 'pending';

export interface FeeRecord {
    id: string;
    student_id: string;
    student_name: string;
    grade: string;
    section: string;
    total_amount: number;
    paid_amount: number;
    due_date: string;
    status: FeeStatus;
    academic_year: string;
    created_at?: string;
}

export interface Payment {
    id: string;
    fee_id: string;
    amount: number;
    date: string;
    method: 'cash' | 'online' | 'cheque';
    reference?: string;
    recorded_by: string;
}

// ─── Marks / Report Cards ─────────────────────────────────────────────────────

export interface SubjectMarks {
    subject: string;
    max_marks: number;
    obtained_marks: number;
    grade?: string;
}

export interface GradeRecord {
    id: string;
    student_id: string;
    student_name: string;
    grade: string;
    section: string;
    roll_number: string;
    term: string;
    academic_year: string;
    subjects: SubjectMarks[];
    total_marks: number;
    obtained_marks: number;
    percentage: number;
    overall_grade: string;
    remarks?: string;
    generated_by: string;
    generated_at: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface NavItem {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    path: string;
    roles: UserRole[];
}

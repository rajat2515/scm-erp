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
    status: 'active' | 'inactive' | 'transferred' | 'alumni';
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
    phone?: string;
    address?: string;
    aadhar_no?: string;
    emergency_contact?: string;
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

export interface WorkingDay {
    date: string; // YYYY-MM-DD
    is_working: boolean;
    notes?: string;
    created_at?: string;
    updated_at?: string;
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

// ─── Academic Sessions ────────────────────────────────────────────────────────

export interface AcademicSession {
    id: string; // UUID
    name: string; // e.g., '2026-2027'
    start_date: string; // YYYY-MM-DD
    end_date: string; // YYYY-MM-DD
    is_active: boolean; // Is it the ongoing global session?
    created_at?: string;
}

// ─── Timetable ────────────────────────────────────────────────────────────────

export interface TimetableSlot {
    id: number;
    class: string;            // e.g. 'ONE A', 'NINE'
    section: string;          // e.g. 'A', 'B' or '' for single-section
    day_of_week: number;      // 1=Mon, 2=Tue ... 6=Sat
    period_number: number;    // 1-8
    subject: string;
    teacher_id: number | null;
    room?: string;
    created_at?: string;
    updated_at?: string;
    // Joined fields (from teacher_registrations)
    teacher_name?: string;
}

export interface PeriodTiming {
    id: number;
    period_number: number;
    label: string;            // e.g. '1st Period', 'Recess'
    start_time: string;       // HH:MM
    end_time: string;         // HH:MM
    type: 'class' | 'recess' | 'assembly';
    created_at?: string;
}

export interface SubstituteAssignment {
    id: number;
    date: string;             // YYYY-MM-DD
    original_teacher_id: number;
    substitute_teacher_id: number;
    timetable_slot_id: number;
    reason?: string;
    created_at?: string;
    // Joined fields
    original_teacher_name?: string;
    substitute_teacher_name?: string;
    slot_class?: string;
    slot_subject?: string;
    slot_period?: number;
}

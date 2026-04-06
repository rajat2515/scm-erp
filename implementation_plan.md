# Teacher-Side Interface Implementation Plan

## Overview
Build the teacher-facing portal of the ERP system. The teacher role already exists in auth (`allowedRoles: ['teacher']`) and a placeholder `TeacherDashboard.tsx` exists at `src/pages/teacher/`. The router already has a basic `/teacher` route.

---

## Phase 1: Teacher Dashboard

**Goal:** Replace the placeholder with a real dashboard.

1. Create `src/pages/teacher/components/DashboardStats.tsx` — cards showing:
   - Assigned classes count
   - Today's attendance status (marked/pending)
   - Pending mark entry
   - Total assigned students

2. Create `src/pages/teacher/components/ClassScheduleWidget.tsx` — today's class timetable.

3. Update `src/pages/teacher/TeacherDashboard.tsx` to compose the above widgets.

4. Fetch data from Supabase tables (teacher profile → teacher_class_mapping → attendance/marks).

---

## Phase 2: Class Roster & Student Directory

**Goal:** Let teachers view their assigned classes and student rosters.

1. Create `src/pages/teacher/MyClasses.tsx` — list of classes assigned to the logged-in teacher.

2. Create `src/pages/teacher/ClassDetail.tsx` — when clicking a class, show student roster, schedule, and quick links to attendance/marks.

3. Add routes in `AppRouter.tsx`:
   - `/teacher/classes` → `MyClasses`
   - `/teacher/classes/:classId` → `ClassDetail`

---

## Phase 3: Student Attendance

**Goal:** Daily attendance marking for the teacher's assigned classes.

1. Create `src/pages/teacher/AttendanceMarking.tsx` — table/list of students with present/absent/late toggles for a selected date and class.

2. Wire up to Supabase attendance table, scoped to the teacher's assigned classes only.

3. Add route: `/teacher/attendance` → `AttendanceMarking`

---

## Phase 4: Marks Entry

**Goal:** Enter exam/test scores for students.

1. Create `src/pages/teacher/MarksEntry.tsx` — select class → select exam/test → grid of students with score inputs.

2. Create `src/pages/teacher/components/ExamSelector.tsx` — dropdown/modal to pick exam type and date.

3. Validate scores against max marks, auto-calculate grades.

4. Add route: `/teacher/marks` → replace current `ReportCards` with `MarksEntry` (keep `ReportCards` for admin/reporting view).

---

## Phase 5: Report Cards (Teacher View)

**Goal:** Generate and publish report cards for assigned students.

1. Create `src/pages/teacher/ReportCardBuilder.tsx` — compile marks, compute grades/GPA, add remarks per student.

2. Add approval workflow (draft → review → publish).

3. Add route: `/teacher/report-cards` → `ReportCardBuilder`

---

## Phase 6: Teacher Navigation & Layout

**Goal:** Unified sidebar navigation for the teacher portal.

1. Create `src/components/layout/TeacherLayout.tsx` — sidebar with links to all teacher pages, top bar with user profile.

2. Wrap all teacher routes in `TeacherLayout` (or nest `<Outlet>` pattern).

3. Sidebar items: Dashboard, My Classes, Attendance, Marks, Report Cards, Profile.

---

## Phase 7: Teacher Profile & Settings

**Goal:** View and edit own profile.

1. Create `src/pages/teacher/Profile.tsx` — display name, email, subjects, assigned classes.

2. Allow editing basic info and changing password.

3. Add route: `/teacher/profile` → `Profile`

---

## Database Requirements (verify/add tables)

| Table | Purpose |
|-------|---------|
| `teachers` | Teacher profiles (id, user_id, name, email, phone, qualification) |
| `teacher_class_mapping` | Link teachers to classes (teacher_id, class_id, subject_id) |
| `attendance` | Daily attendance records (class_id, student_id, date, status, marked_by) |
| `marks` | Exam scores (class_id, student_id, exam_type, subject, score, max_score, entered_by) |
| `exams` | Exam definitions (name, type, date_range, max_marks) |
| `report_cards` | Compiled report (student_id, term, grades, remarks, status) |

---

## File Structure (final)

```
src/pages/teacher/
├── TeacherDashboard.tsx
├── MyClasses.tsx
├── ClassDetail.tsx
├── AttendanceMarking.tsx
├── MarksEntry.tsx
├── ReportCardBuilder.tsx
├── Profile.tsx
└── components/
    ├── DashboardStats.tsx
    ├── ClassScheduleWidget.tsx
    └── ExamSelector.tsx
```

---

## Order of Execution

1. TeacherLayout (Phase 6) — foundation first so other pages have navigation
2. TeacherDashboard (Phase 1)
3. MyClasses + ClassDetail (Phase 2)
4. AttendanceMarking (Phase 3)
5. MarksEntry (Phase 4)
6. ReportCardBuilder (Phase 5)
7. Profile (Phase 7)

---

## Notes

- All data queries must be scoped to the logged-in teacher's `user_id` (RLS policies on Supabase)
- Follow existing patterns from admin pages for consistency (component structure, form patterns, etc.)
- Reuse existing UI components where possible (tables, dialogs, toasts from shadcn/ui)
- Each page should be lazy-loaded in `AppRouter.tsx`

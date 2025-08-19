// type/index.ts

/** User role types */
export type UserRole = 'patient' | 'doctor' | 'staff';

/** Appointment status types */
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "missed";

/** User data structure */
export interface User {
  readonly id: string;       // ID จากฐานข้อมูล ไม่ให้แก้ไข
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;       // 'YYYY-MM-DD' (ถ้าจะใช้ Date ให้เปลี่ยนเป็น Date)
  medicalRights: string;
  role: UserRole;
  photoURL?: string;
}

/** Appointment data structure */
export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  treatmentType: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  status: "scheduled" | "completed" | "cancelled" | "missed";
  createdAt: string;
  cancelReason?: string;
};

/** Treatment type information */
export type Treatment = {
  docId?: string;     // Firestore document id (auto)
  id: string;         // slug key ที่จะส่งไปกับ appointment (ตายตัว)
  label: string;      // ชื่อบริการที่แสดง
  active: boolean;    // เปิด/ปิดให้จอง
  durationMin?: number;
  price?: number;
  order?: number;     // สำหรับจัดเรียง
};

/** Time slot availability */
export interface TimeSlot {
  time: string;              // 'HH:mm'
  available: boolean;
}

/** Clinic settings configuration */
// type/index.ts
export interface ClinicSettings {
  workingHours: { start: string; end: string };
  breakTime: { start: string; end: string }; // 👈 กลับมาเป็น object เดี่ยว
  holidays: string[];
  slotDuration: number;
}

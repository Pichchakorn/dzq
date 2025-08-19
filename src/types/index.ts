// src/types/index.ts

/** User role types */
export type UserRole = "patient" | "doctor" | "staff";

/** Appointment status types */
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "missed";

/** User data structure */
export interface User {
  readonly id: string;      // ID จากฐานข้อมูล ไม่ให้แก้ไข
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;      // 'YYYY-MM-DD'
  medicalRights: string;
  role: UserRole;
  photoURL?: string;
}

/** Appointment data structure */
export interface Appointment {
  id: string;
  patientId: string;        // อ้างถึง User.id
  patientName: string;
  date: string;             // 'YYYY-MM-DD'
  time: string;             // 'HH:mm'
  treatmentType: string;    // ชื่อบริการที่แสดงใน UI
  status: AppointmentStatus;
  createdAt: string;        // ISO string
  cancelReason?: string;    // เหตุผลการยกเลิก (ถ้ามี)
  notes?: string;
}

/** Treatment type information */
export interface Treatment {
  docId?: string;           // Firestore document id (auto)
  id: string;               // slug key ตายตัว
  label: string;            // ชื่อบริการที่แสดง
  active: boolean;          // เปิด/ปิดให้จอง
  durationMin?: number;
  price?: number;
  order?: number;           // สำหรับจัดเรียง
}

/** Time slot availability */
export interface TimeSlot {
  time: string;             // 'HH:mm'
  available: boolean;
}

/** Clinic settings configuration */
export interface ClinicSettings {
  workingHours: { start: string; end: string };
  breakTime: { start: string; end: string };
  holidays: string[];
  slotDuration: number;
}

/** เวลาที่ถูกล็อคโดยแอดมิน (ให้สอดคล้องกับ AppointmentContext) */
export type SlotLock = {
  date: string;             // "YYYY-MM-DD"
  time: string;             // "HH:mm"
  reason?: string;          // เหตุผล (optional)

  // ด้านล่างเป็นข้อมูลเสริม ทำเป็น optional ไว้เผื่ออนาคต
  id?: string;              // doc id (ถ้าต้องการใช้งาน)
  createdBy?: string;       // admin uid
  createdAt?: string;       // ISO string
};

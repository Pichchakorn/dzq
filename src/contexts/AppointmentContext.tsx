// src/contexts/AppointmentContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";

/* -------------------------- Types -------------------------- */

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  treatmentType: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string; // ISO string (client log); also createdAtServer on server
};

export type ClinicSettings = {
  workingHours: { start: string; end: string }; // "HH:mm"
  breakTime: { start: string; end: string };     // "HH:mm"
  slotDuration: number;                          // minutes
  holidays: string[];                            // ["YYYY-MM-DD", ...]
};

type TreatmentType = { id: string; name: string; duration: number; price: number };

type Ctx = {
  appointments: Appointment[];
  treatmentTypes: TreatmentType[];
  clinicSettings: ClinicSettings;

  createAppointment: (
    a: Omit<Appointment, "id" | "createdAt" | "status"> & { status?: "scheduled" }
  ) => Promise<string>;

  updateAppointment: (id: string, patch: Partial<Appointment>) => Promise<void>;
  clearQueue: (ymd: string, to: "completed" | "cancelled") => Promise<number>;
  getAvailableSlots: (ymd: string) => string[];

  pushNotification: (to: string, title: string, body: string) => Promise<void>;

  updateClinicSettings: (s: Partial<ClinicSettings>) => Promise<void>;
  setTreatmentTypes: (list: TreatmentType[]) => Promise<void>;
};

const AppointmentsCtx = createContext<Ctx>({} as any);
export const useAppointments = () => useContext(AppointmentsCtx);

/* ----------------------- Defaults ----------------------- */

const DEFAULT_SETTINGS: ClinicSettings = {
  workingHours: { start: "09:00", end: "17:00" },
  breakTime: { start: "12:00", end: "13:00" },
  slotDuration: 30,
  holidays: [],
};

/* -------------------- Provider -------------------- */

export function AppointmentProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS);
  const [treatmentTypes, setTT] = useState<TreatmentType[]>([]);

  // Stream นัดหมาย (ทั้งหมดถ้าเป็นแอดมิน, ไม่งั้นเฉพาะของ user.id)
  useEffect(() => {
    if (!user) return;

    const col = collection(db, "appointments");
    const q = isAdmin
      ? query(col, orderBy("date"), orderBy("time"))
      : query(col, where("patientId", "==", user.id), orderBy("date"), orderBy("time"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Appointment[];
      setAppointments(list);
    });

    return unsub;
  }, [user?.id, isAdmin]);

  // โหลด clinic settings และ treatment types (อ่านได้สาธารณะตามกฎ Firestore ที่แนะนำ)
  useEffect(() => {
    (async () => {
      const s = await getDoc(doc(db, "clinicSettings", "singleton"));
      if (s.exists()) {
        setClinicSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<ClinicSettings>) });
      }

      const t = await getDocs(collection(db, "treatmentTypes"));
      setTT(t.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TreatmentType[]);
    })();
  }, []);

  /* -------------------- Actions -------------------- */

  const createAppointment: Ctx["createAppointment"] = async (a) => {
    const payload: Omit<Appointment, "id"> = {
      patientId: a.patientId,
      patientName: a.patientName,
      treatmentType: a.treatmentType,
      date: a.date, // "YYYY-MM-DD"
      time: a.time, // "HH:mm"
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    const ref = await addDoc(collection(db, "appointments"), {
      ...payload,
      createdAtServer: serverTimestamp(),
    });

    // แจ้งเตือนผู้ป่วย
    await addDoc(collection(db, "notifications"), {
      to: a.patientId,
      title: "จองนัดสำเร็จ",
      body: `${a.treatmentType} วันที่ ${a.date} เวลา ${a.time}`,
      read: false,
      createdAt: serverTimestamp(),
    });

    return ref.id;
  };

  const updateAppointment: Ctx["updateAppointment"] = async (id, patch) => {
    await updateDoc(doc(db, "appointments", id), patch as any);

    // ถ้ามีการเปลี่ยนสถานะ → ส่งการแจ้งเตือน
    if (patch.status) {
      const ap = appointments.find((x) => x.id === id);
      if (ap) {
        await addDoc(collection(db, "notifications"), {
          to: ap.patientId,
          title: "อัปเดตสถานะนัดหมาย",
          body: `สถานะ: ${patch.status}`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    }
  };

  const clearQueue: Ctx["clearQueue"] = async (ymd, to) => {
    const q = query(
      collection(db, "appointments"),
      where("date", "==", ymd),
      where("status", "==", "scheduled")
    );
    const snap = await getDocs(q);
    const jobs = snap.docs.map((d) => updateDoc(d.ref, { status: to }));
    await Promise.all(jobs);
    return snap.size;
  };

  const pushNotification: Ctx["pushNotification"] = async (to, title, body) => {
    await addDoc(collection(db, "notifications"), {
      to,
      title,
      body,
      read: false,
      createdAt: serverTimestamp(),
    });
  };

  const updateClinicSettings: Ctx["updateClinicSettings"] = async (s) => {
    await setDoc(doc(db, "clinicSettings", "singleton"), s, { merge: true });
    setClinicSettings((prev) => ({ ...prev, ...s }));
  };

  // เขียนประเภทการรักษาแบบ upsert (batch)
  const setTreatmentTypes: Ctx["setTreatmentTypes"] = async (list) => {
    const batch = writeBatch(db);
    const col = collection(db, "treatmentTypes");

    list.forEach((t) => {
      const id = t.id || crypto.randomUUID();
      batch.set(
        doc(col, id),
        { name: t.name, duration: t.duration, price: t.price },
        { merge: true }
      );
    });

    await batch.commit();
    setTT(list.map((t) => ({ ...t, id: t.id || "" })));
  };

  /* -------------------- Helpers -------------------- */

  const getAvailableSlots: Ctx["getAvailableSlots"] = (ymd) => {
    // ปิดบริการในวันหยุด
    if (clinicSettings.holidays.includes(ymd)) return [];

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const from = toMin(clinicSettings.workingHours.start);
    const to = toMin(clinicSettings.workingHours.end);
    const brS = toMin(clinicSettings.breakTime.start);
    const brE = toMin(clinicSettings.breakTime.end);
    const step = clinicSettings.slotDuration;

    const slots: string[] = [];
    for (let m = from; m + step <= to; m += step) {
      // ตัดช่วงพัก
      if (m >= brS && m < brE) continue;
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }

    // ตัดเวลาที่ถูกจองแล้ว
    const booked = new Set(
      appointments
        .filter((a) => a.date === ymd && a.status === "scheduled")
        .map((a) => a.time)
    );

    return slots.filter((t) => !booked.has(t));
  };

  /* -------------------- Memo value -------------------- */

  const value = useMemo(
    () => ({
      appointments,
      treatmentTypes,
      clinicSettings,
      createAppointment,
      updateAppointment,
      clearQueue,
      getAvailableSlots,
      pushNotification,
      updateClinicSettings,
      setTreatmentTypes,
    }),
    [appointments, treatmentTypes, clinicSettings]
  );

  return <AppointmentsCtx.Provider value={value}>{children}</AppointmentsCtx.Provider>;
}

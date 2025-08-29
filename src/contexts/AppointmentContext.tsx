// src/contexts/AppointmentContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy,
  query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useAuth } from "./AuthContext";
import type { Appointment } from "../types";

/* ---------------- Types ---------------- */
export type Holiday = { date: string; name?: string };

export type ClinicInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

export type ClinicSettings = {
  workingHours: { start: string; end: string };
  breakTime: { start: string; end: string };
  slotDuration: number;
  holidays: Holiday[];
  clinicInfo?: ClinicInfo;
};

export type TreatmentType = { id: string; name: string; duration: number; price: number };

export type LockedSlot = { date: string; time: string; reason?: string };

// ดัชนีเวลาที่ถูกจอง (ไม่มี PII นอกจาก patientId)
export type BookedSlot = { date: string; time: string; patientId: string; createdAt?: any };

// แปลง holidays จาก Firestore ให้เป็น Holiday[]
const normalizeHolidays = (raw: any): Holiday[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) =>
      typeof x === "string"
        ? ({ date: x } as Holiday)
        : x && typeof x.date === "string"
        ? ({ date: x.date, name: typeof x.name === "string" ? x.name : undefined } as Holiday)
        : null
    )
    .filter(Boolean) as Holiday[];
};

type Ctx = {
  appointments: Appointment[];
  treatmentTypes: TreatmentType[];
  clinicSettings: ClinicSettings;
  lockedSlots: LockedSlot[];
  bookedSlots: BookedSlot[];

  createAppointment: (
    a: Omit<Appointment, "id" | "createdAt" | "status" | "patientId"> & { status?: "scheduled" }
  ) => Promise<string>;

  updateAppointment: (id: string, patch: Partial<Appointment>) => Promise<void>;
  cancelAppointment: (id: string, reason?: string) => Promise<void>;
  clearQueue: (ymd: string, to: "completed" | "cancelled", reason?: string) => Promise<number>;
  getAvailableSlots: (ymd: string) => string[];

  pushNotification: (to: string, title: string, body: string) => Promise<void>;
  updateClinicSettings: (s: Partial<ClinicSettings>) => Promise<void>;
  setTreatmentTypes: (list: TreatmentType[]) => Promise<void>;

  lockSlot: (date: string, time: string, reason?: string) => Promise<void>;
  unlockSlot: (date: string, time: string) => Promise<void>;
};

const AppointmentsCtx = createContext<Ctx>({} as any);
export const useAppointments = () => useContext(AppointmentsCtx);

const DEFAULT_SETTINGS: ClinicSettings = {
  workingHours: { start: "09:00", end: "17:00" },
  breakTime: { start: "12:00", end: "13:00" },
  slotDuration: 30,
  holidays: [],
};

/* ---------------- Provider ---------------- */
export function AppointmentProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const auth = getAuth();

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS);
  const [treatmentTypes, setTT] = useState<TreatmentType[]>([]);
  const [lockedSlots, setLockedSlots] = useState<LockedSlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);

  // ติดตามการเปลี่ยนแปลงสถานะล็อกอิน เพื่อให้ uid เสถียร
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, [auth]);

  /* Stream appointments (ของตัวเอง ยกเว้นแอดมินเห็นทั้งหมด) */
  useEffect(() => {
    const colRef = collection(db, "appointments");
    if (!isAdmin && !uid) return; // ยังไม่รู้ uid ก็ยังไม่ subscribe

    const qy = isAdmin
      ? query(colRef, orderBy("date"), orderBy("time"))
      : query(colRef, where("patientId", "==", uid!), orderBy("date"), orderBy("time"));

    const unsub = onSnapshot(qy, (snap) => {
      const list: Appointment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setAppointments(list);
    });
    return unsub;
  }, [uid, isAdmin]);

  /* Load clinic settings + treatments */
  useEffect(() => {
    (async () => {
      const s = await getDoc(doc(db, "clinicSettings", "singleton"));
      if (s.exists()) {
        const data = s.data() as Partial<ClinicSettings> & { holidays?: any };
        setClinicSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          holidays: normalizeHolidays(data.holidays),
        });
      }
      const t = await getDocs(collection(db, "treatmentTypes"));
      setTT(
        t.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as any),
            } as TreatmentType)
        )
      );
    })();
  }, []);

  /* Stream locked slots */
  useEffect(() => {
    const colRef = collection(db, "lockedSlots");
    return onSnapshot(colRef, (snap) => {
      setLockedSlots(snap.docs.map((d) => d.data() as LockedSlot));
    });
  }, []);

  /* Stream booked slots (กันชนเวลาที่จองแล้ว) */
  useEffect(() => {
    const colRef = collection(db, "bookedSlots");
    return onSnapshot(colRef, (snap) => {
      setBookedSlots(snap.docs.map((d) => d.data() as BookedSlot));
    });
  }, []);

  /* Actions */
  const createAppointment: Ctx["createAppointment"] = async (a) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) throw new Error("ยังไม่ได้ล็อกอิน");

    const payload = {
      patientId: currentUid, // ✅ ใช้ UID จาก Firebase
      patientName: a.patientName,
      treatmentType: a.treatmentType,
      date: a.date,
      time: a.time,
      status: "scheduled" as const,
      createdAt: new Date().toISOString(),
    };

    const slotKey = `${payload.date}_${payload.time}`;
    const lockedRef = doc(db, "lockedSlots", slotKey);
    const bookedRef = doc(db, "bookedSlots", slotKey);
    const apptRef = doc(collection(db, "appointments"));

    await runTransaction(db, async (tx) => {
      // ห้ามชนล็อกของแอดมิน
      const lockedSnap = await tx.get(lockedRef);
      if (lockedSnap.exists()) throw new Error("ช่วงเวลานี้ถูกล็อคแล้ว");

      // ห้ามชนการจองก่อนหน้า
      const bookedSnap = await tx.get(bookedRef);
      if (bookedSnap.exists()) throw new Error("ช่วงเวลานี้ถูกจองแล้ว");

      // กันชน slot (id = date_time ตรงกับกติกา rules)
      tx.set(bookedRef, {
        date: payload.date,
        time: payload.time,
        patientId: currentUid,
        createdAt: serverTimestamp(),
      } as BookedSlot);

      // สร้างใบนัดจริง
      tx.set(apptRef, { ...payload, createdAtServer: serverTimestamp() });
    });

    return "ok";
  };

  const updateAppointment: Ctx["updateAppointment"] = async (id, patch) => {
    if (patch.status === "cancelled") {
      // คืน slot เมื่อยกเลิก
      const apptRef = doc(db, "appointments", id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(apptRef);
        if (!snap.exists()) return;
        const prev = snap.data() as Appointment;
        const slotKey = `${prev.date}_${prev.time}`;
        tx.update(apptRef, patch as any);
        tx.delete(doc(db, "bookedSlots", slotKey));
      });
      return;
    }
    await updateDoc(doc(db, "appointments", id), patch as any);
  };

  // helper ยกเลิกคิว (สำหรับ UI เรียกใช้ง่าย ๆ)
  const cancelAppointment: Ctx["cancelAppointment"] = async (id, reason) => {
    await updateAppointment(id, {
      status: "cancelled",
      cancelReason: reason || "ยกเลิกโดยผู้ใช้",
    });
  };

  const clearQueue: Ctx["clearQueue"] = async (ymd, to, reason) => {
    const qy = query(
      collection(db, "appointments"),
      where("date", "==", ymd),
      where("status", "==", "scheduled")
    );
    const snap = await getDocs(qy);

    if (to === "cancelled") {
      await Promise.all(
        snap.docs.map(async (d) => {
          const a = d.data() as Appointment;
          const slotKey = `${a.date}_${a.time}`;
          await Promise.all([
            updateDoc(d.ref, { status: "cancelled", cancelReason: reason || "ยกเลิกโดยคลินิก" }),
            deleteDoc(doc(db, "bookedSlots", slotKey)),
          ]);
        })
      );
    } else {
      await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { status: "completed" })));
    }
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
    // normalize holidays ก่อน merge
    const merged: ClinicSettings = {
      ...clinicSettings,
      ...s,
      holidays: normalizeHolidays((s as any)?.holidays ?? clinicSettings.holidays),
    };
    await setDoc(doc(db, "clinicSettings", "singleton"), merged, { merge: true });
    setClinicSettings(merged);
  };

  const setTreatmentTypes: Ctx["setTreatmentTypes"] = async (list) => {
    const batch = writeBatch(db);
    const col = collection(db, "treatmentTypes");
    list.forEach((t) => {
      const id = t.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`);
      batch.set(doc(col, id), { name: t.name, duration: t.duration, price: t.price }, { merge: true });
    });
    await batch.commit();
    setTT(list.map((t) => ({ ...t, id: t.id || "" })));
  };

  /* Lock/Unlock slot (แอดมิน) */
  const lockSlot: Ctx["lockSlot"] = async (date, time, reason) => {
    await setDoc(doc(db, "lockedSlots", `${date}_${time}`), { date, time, reason });
  };
  const unlockSlot: Ctx["unlockSlot"] = async (date, time) => {
    await deleteDoc(doc(db, "lockedSlots", `${date}_${time}`));
  };

  /* Helpers */
  const getAvailableSlots: Ctx["getAvailableSlots"] = (ymd) => {
    // ปิดทั้งวันถ้าเป็นวันหยุด
    const holidaySet = new Set((clinicSettings.holidays ?? []).map((h) => h.date));
    if (holidaySet.has(ymd)) return [];

    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const from = toMin(clinicSettings.workingHours.start);
    const to   = toMin(clinicSettings.workingHours.end);
    const brS  = toMin(clinicSettings.breakTime.start);
    const brE  = toMin(clinicSettings.breakTime.end);
    const step = clinicSettings.slotDuration;

    const all: string[] = [];
    for (let m = from; m + step <= to; m += step) {
      if (m >= brS && m < brE) continue;
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      all.push(`${hh}:${mm}`);
    }

    // ❗ ตัดเวลาที่ถูกจองไปแล้ว/ล็อกออกทันที
    const takenByBooked = new Set(bookedSlots.filter((b) => b.date === ymd).map((b) => b.time));
    const takenByAppt   = new Set(appointments.filter((a) => a.date === ymd && a.status === "scheduled").map((a) => a.time));
    const locked        = new Set(lockedSlots.filter((s) => s.date === ymd).map((s) => s.time));

    return all.filter((t) => !takenByBooked.has(t) && !takenByAppt.has(t) && !locked.has(t));
  };

  const value: Ctx = useMemo(
    () => ({
      appointments,
      treatmentTypes,
      clinicSettings,
      lockedSlots,
      bookedSlots,
      createAppointment,
      updateAppointment,
      cancelAppointment,
      clearQueue,
      getAvailableSlots,
      pushNotification,
      updateClinicSettings,
      setTreatmentTypes,
      lockSlot,
      unlockSlot,
    }),
    [appointments, treatmentTypes, clinicSettings, lockedSlots, bookedSlots]
  );

  return <AppointmentsCtx.Provider value={value}>{children}</AppointmentsCtx.Provider>;
}

// src/contexts/AppointmentContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import type { Appointment } from "../types";

/* ---------------- Types ---------------- */
export type ClinicSettings = {
  workingHours: { start: string; end: string };
  breakTime: { start: string; end: string };
  slotDuration: number;
  holidays: string[];
};

export type TreatmentType = { id: string; name: string; duration: number; price: number };

export type LockedSlot = {
  date: string;
  time: string;
  reason?: string;
};

type Ctx = {
  appointments: Appointment[];
  treatmentTypes: TreatmentType[];
  clinicSettings: ClinicSettings;
  lockedSlots: LockedSlot[];

  createAppointment: (
    a: Omit<Appointment, "id" | "createdAt" | "status"> & { status?: "scheduled" }
  ) => Promise<string>;

  updateAppointment: (id: string, patch: Partial<Appointment>) => Promise<void>;
  clearQueue: (ymd: string, to: "completed" | "cancelled", reason?: string) => Promise<number>;
  getAvailableSlots: (ymd: string) => string[];

  pushNotification: (to: string, title: string, body: string) => Promise<void>;
  updateClinicSettings: (s: Partial<ClinicSettings>) => Promise<void>;
  setTreatmentTypes: (list: TreatmentType[]) => Promise<void>;

  // สำหรับแอดมิน
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
  const { user, isAdmin } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS);
  const [treatmentTypes, setTT] = useState<TreatmentType[]>([]);
  const [lockedSlots, setLockedSlots] = useState<LockedSlot[]>([]);

  /* Stream appointments */
  useEffect(() => {
    if (!user) return;
    const col = collection(db, "appointments");
    const q = isAdmin
      ? query(col, orderBy("date"), orderBy("time"))
      : query(col, where("patientId", "==", user.id), orderBy("date"), orderBy("time"));

    return onSnapshot(q, (snap) => {
      const list: Appointment[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setAppointments(list);
    });
  }, [user?.id, isAdmin]);

  /* Load clinic settings + treatments */
  useEffect(() => {
    (async () => {
      const s = await getDoc(doc(db, "clinicSettings", "singleton"));
      if (s.exists()) {
        setClinicSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<ClinicSettings>) });
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
    const col = collection(db, "lockedSlots");
    return onSnapshot(col, (snap) => {
      const list: LockedSlot[] = snap.docs.map((d) => d.data() as LockedSlot);
      setLockedSlots(list);
    });
  }, []);

  /* Actions */
  const createAppointment: Ctx["createAppointment"] = async (a) => {
    const payload = {
      patientId: a.patientId,
      patientName: a.patientName,
      treatmentType: a.treatmentType,
      date: a.date,
      time: a.time,
      status: "scheduled" as const,
      createdAt: new Date().toISOString(),
    };

    await runTransaction(db, async (tx) => {
      // กันจองซ้ำ
      const col = collection(db, "appointments");
      const q = query(
        col,
        where("date", "==", payload.date),
        where("time", "==", payload.time),
        where("status", "==", "scheduled")
      );
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error("ช่วงเวลานี้ถูกจองแล้ว");

      // กันเวลาที่ล็อคแล้ว
      const lockedRef = doc(db, "lockedSlots", `${payload.date}_${payload.time}`);
      const lockedSnap = await tx.get(lockedRef);
      if (lockedSnap.exists()) throw new Error("ช่วงเวลานี้ถูกล็อคแล้ว");

      const ref = doc(col);
      tx.set(ref, { ...payload, createdAtServer: serverTimestamp() });
    });

    return "ok";
  };

  const updateAppointment: Ctx["updateAppointment"] = async (id, patch) => {
    await updateDoc(doc(db, "appointments", id), patch as any);
  };

  const clearQueue: Ctx["clearQueue"] = async (ymd, to, reason) => {
    const q = query(
      collection(db, "appointments"),
      where("date", "==", ymd),
      where("status", "==", "scheduled")
    );
    const snap = await getDocs(q);
    const jobs = snap.docs.map((d) =>
      updateDoc(
        d.ref,
        to === "cancelled"
          ? { status: "cancelled", cancelReason: reason || "ยกเลิกโดยคลินิก" }
          : { status: "completed" }
      )
    );
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

  /* Lock/Unlock slot */
  const lockSlot: Ctx["lockSlot"] = async (date, time, reason) => {
    await setDoc(doc(db, "lockedSlots", `${date}_${time}`), { date, time, reason });
  };

  const unlockSlot: Ctx["unlockSlot"] = async (date, time) => {
    await deleteDoc(doc(db, "lockedSlots", `${date}_${time}`));
  };

  /* Helpers */
  const getAvailableSlots: Ctx["getAvailableSlots"] = (ymd) => {
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
      if (m >= brS && m < brE) continue;
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }

    const booked = new Set(
      appointments.filter((a) => a.date === ymd && a.status === "scheduled").map((a) => a.time)
    );
    const locked = new Set(lockedSlots.filter((s) => s.date === ymd).map((s) => s.time));

    return slots.filter((t) => !booked.has(t) && !locked.has(t));
  };

  /* Context value */
  const value: Ctx = useMemo(
    () => ({
      appointments,
      treatmentTypes,
      clinicSettings,
      lockedSlots,
      createAppointment,
      updateAppointment,
      clearQueue,
      getAvailableSlots,
      pushNotification,
      updateClinicSettings,
      setTreatmentTypes,
      lockSlot,
      unlockSlot,
    }),
    [appointments, treatmentTypes, clinicSettings, lockedSlots]
  );

  return <AppointmentsCtx.Provider value={value}>{children}</AppointmentsCtx.Provider>;
}

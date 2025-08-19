// src/components/BookingPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Treatment } from "../types";

const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function getSlotsForDate(date: Date): string[] {
  const base = [
    "09:00","09:30","10:00","10:30","11:00",
    "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
  ];
  const now = new Date();
  if (date.toDateString() !== now.toDateString()) return base;
  return base.filter((t) => {
    const [h, m] = t.split(":").map(Number);
    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);
    return dt > now;
  });
}

interface BookingPageProps { onBack?: () => void; }

export default function BookingPage({ onBack }: BookingPageProps) {
  const { user } = useAuth();
  const { createAppointment } = useAppointments();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [treatmentId, setTreatmentId] = useState<string>("");
  const [time, setTime] = useState<string>("");

  // 👇 ใช้ชนิด Treatment ตามไฟล์ types
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingTreat, setLoadingTreat] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // อ่านจาก collection "treatmentTypes" (rules เปิดอ่านได้)
  useEffect(() => {
    const ref = collection(db, "treatmentTypes");
    const q = query(ref, orderBy("name", "asc")); // ใน DB ใช้ name/duration/price

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Treatment[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            docId: d.id,
            id: (x.id ?? d.id) as string,
            label: (x.label ?? x.name ?? "") as string,
            active: (x.active ?? true) as boolean,

            // ⬇️ แปลง null เป็น undefined ให้เข้ากับ type Treatment
            durationMin: (x.duration ?? x.durationMin) ?? undefined,
            price: (typeof x.price === "number" ? x.price : undefined),
            order: (typeof x.order === "number" ? x.order : undefined),
          };
        });
        setTreatments(arr);

        setLoadingTreat(false);
        setLoadError(null);
      },
      (err) => {
        console.error("treatmentTypes onSnapshot ERROR:", err);
        setLoadError(err?.message || "ไม่สามารถโหลดรายการการรักษา");
        setLoadingTreat(false);
      }
    );
    return unsub;
  }, []);

  const activeTreatments = useMemo(
    () => treatments.filter((t) => t.active !== false),
    [treatments]
  );

  const slots = useMemo(
    () => (selectedDate ? getSlotsForDate(selectedDate) : []),
    [selectedDate]
  );

  const labelFrom = (id: string) =>
    activeTreatments.find((t) => t.id === id)?.label ?? "";

  const canSubmit = Boolean(selectedDate && treatmentId && time);
  const submit = async () => {
    if (!user || !canSubmit || !selectedDate) return;

    const y = fmtYMD(selectedDate);
    if (lockedTimes.has(time) || bookedTimes.has(time) || isPastTime(time)) {
      alert("ช่วงเวลานี้ไม่สามารถจองได้ (ถูกล็อค/ถูกจองแล้ว/เลยเวลา)");
      return;
    }

 try {
     await createAppointment({
       patientId: user.id,
       patientName: user.name || user.email || "ผู้ป่วย",
       treatmentType: labelFrom(treatmentId),
       date: y,
       time,
       status: "scheduled",
     } as any);
   } catch (err: any) {
     // ถ้า rules กันไว้จะมาทางนี้
     alert(err?.message || "จองไม่สำเร็จ");
     return;
   }

    onBack?.();
  };

  const { appointments, clinicSettings, lockedSlots } = useAppointments();
  function buildAllSlots(s: { start: string; end: string }, stepMin: number, breakTime: {start:string; end:string}) {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const from = toMin(s.start);
  const to = toMin(s.end);
  const brS = toMin(breakTime.start);
  const brE = toMin(breakTime.end);

  const out: string[] = [];
  for (let m = from; m + stepMin <= to; m += stepMin) {
    if (m >= brS && m < brE) continue;                 // ข้ามช่วงพัก
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}

const ymd = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,"0")}-${String(selectedDate.getDate()).padStart(2,"0")}` : "";

const allSlots = useMemo(() => {
  if (!selectedDate) return [];
  return buildAllSlots(clinicSettings.workingHours, clinicSettings.slotDuration, clinicSettings.breakTime);
}, [selectedDate, clinicSettings]);

// เวลาที่ถูกจองแล้ว (นับเฉพาะสถานะที่ยังถือว่าจองคิวอยู่)
const bookedTimes = useMemo(() => {
  if (!ymd) return new Set<string>();
  return new Set(
    appointments
      .filter(a => a.date === ymd && (a.status === "scheduled")) // ถ้าคุณมี "missed" ด้วย ให้ไม่ต้องนับ
      .map(a => a.time)
  );
}, [appointments, ymd]);

  // ถ้าต้องการตัดเวลาที่ผ่านมาใน "วันนี้"
  const now = new Date();
  const isToday = selectedDate && selectedDate.toDateString() === now.toDateString();
  const isPastTime = (t: string) => {
    if (!isToday) return false;
    const [h,m] = t.split(":").map(Number);
    const dt = new Date(selectedDate!);
    dt.setHours(h, m, 0, 0);
    return dt <= now;
  };

  // เพิ่มใต้ bookedTimes
  const lockedTimes = useMemo(() => {
    if (!ymd) return new Set<string>();
    return new Set(
      lockedSlots
        .filter(ls => ls.date === ymd)
        .map(ls => ls.time)
    );
  }, [lockedSlots, ymd]);



  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2" />
            เลือกวันที่
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(d) => { setSelectedDate(d ?? undefined); setTime(""); }}
            fromDate={new Date()}
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>ประเภทการรักษา</CardTitle></CardHeader>
          <CardContent>
            <Label className="mb-2 block">เลือกบริการที่ต้องการ</Label>

            {loadingTreat ? (
              <p className="text-sm text-gray-500">กำลังโหลดรายการ...</p>
            ) : loadError ? (
              <p className="text-sm text-red-600">{loadError}</p>
            ) : activeTreatments.length === 0 ? (
              <p className="text-sm text-gray-500">ยังไม่มีประเภทการรักษาที่เปิดใช้งาน</p>
            ) : (
              <Select value={treatmentId} onValueChange={setTreatmentId} disabled={!selectedDate}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedDate ? "เลือกประเภทการรักษา" : "กรุณาเลือกวันที่ก่อน"} />
                </SelectTrigger>
                <SelectContent>
                  {activeTreatments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                      {typeof t.durationMin === "number" ? ` · ${t.durationMin} นาที` : ""}
                      {typeof t.price === "number" ? ` · ${t.price.toLocaleString()} บาท` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              เลือกเวลา
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-gray-500">กรุณาเลือกวันที่ก่อน</p>
            ) : allSlots.length === 0 ? (
              <p className="text-sm text-gray-500">ไม่มีช่วงเวลาให้เลือก</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {allSlots.map((s) => {
                  const locked = bookedTimes.has(s) || lockedTimes.has(s) || isPastTime(s);
                  return (
                    <Button
                      key={s}
                      variant={s === time ? "default" : "outline"}
                      onClick={() => !locked && setTime(s)}
                      disabled={locked}
                      className={locked ? "opacity-50 pointer-events-none" : ""}
                    >
                      {s} น.
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onBack?.()}>ย้อนกลับ</Button>
          <Button onClick={submit} disabled={!canSubmit}>ยืนยันการจอง</Button>
        </div>
      </div>
    </div>
  );
}

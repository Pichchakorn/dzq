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

    await createAppointment({
      patientId: user.id,                                 // context ของคุณให้มาเป็น id
      patientName: user.name || user.email || "ผู้ป่วย",
      treatmentType: labelFrom(treatmentId),              // เก็บชื่อบริการลง appointment
      date: fmtYMD(selectedDate),
      time,
      status: "scheduled",
    } as any);

    onBack?.();
  };

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
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500">วันนี้คิวเต็มแล้ว</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slots.map((s) => (
                  <Button
                    key={s}
                    variant={s === time ? "default" : "outline"}
                    onClick={() => setTime(s)}
                  >
                    {s} น.
                  </Button>
                ))}
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

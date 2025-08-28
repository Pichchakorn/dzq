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
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

interface BookingPageProps {
  onBack?: () => void;
}

export default function BookingPage({ onBack }: BookingPageProps) {
  const { user } = useAuth();
  const { clinicSettings, getAvailableSlots, createAppointment } = useAppointments();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [treatmentId, setTreatmentId] = useState<string>("");
  const [time, setTime] = useState<string>("");

  /* ---------- โหลดรายการการรักษา ---------- */
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingTreat, setLoadingTreat] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const ref = collection(db, "treatmentTypes");
    const q = query(ref, orderBy("name", "asc"));
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
            durationMin: (x.duration ?? x.durationMin) ?? undefined,
            price: typeof x.price === "number" ? x.price : undefined,
            order: typeof x.order === "number" ? x.order : undefined,
          } as Treatment;
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

  const labelFrom = (id: string) =>
    activeTreatments.find((t) => t.id === id)?.label ?? "";

  /* ---------- วัน/เวลา ---------- */
  const ymd = useMemo(() => (selectedDate ? fmtYMD(selectedDate) : ""), [selectedDate]);

  // รองรับ holidays ทั้งแบบ string[] และ {date,name}[]
  const holidays = useMemo(
    () =>
      (clinicSettings.holidays as any[] | undefined)
        ?.map((x) => (typeof x === "string" ? { date: x } : x))
        ?.filter((h) => h && typeof h.date === "string") ?? [],
    [clinicSettings.holidays]
  );

  // ปิดวันหยุดบนปฏิทิน
  const disabledDays = useMemo(
    () => holidays.map((h) => new Date(`${h.date}T00:00:00`)),
    [holidays]
  );

  const ymdOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const isHoliday = (d?: Date) => !!(d && holidays.some((h) => h.date === ymdOf(d)));

  // ช่องเวลา “ว่างจริง”
  const baseSlots = useMemo(() => {
    if (!ymd || isHoliday(selectedDate)) return [];
    return getAvailableSlots(ymd);
  }, [ymd, selectedDate, getAvailableSlots, holidays]);

  // กันเวลาที่ผ่านมาแล้วของ “วันนี้”
  const slots = useMemo(() => {
    if (!selectedDate) return [];
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    if (!isToday) return baseSlots;

    return baseSlots.filter((t) => {
      const [h, m] = t.split(":").map(Number);
      const dt = new Date(selectedDate);
      dt.setHours(h, m, 0, 0);
      return dt > now;
    });
  }, [baseSlots, selectedDate]);

  const canSubmit = Boolean(selectedDate && treatmentId && time && !isHoliday(selectedDate));

  /* ---------- ยืนยันการจอง ---------- */
  const submit = async () => {
    if (!user || !canSubmit || !selectedDate) return;

    if (!slots.includes(time)) {
      alert("ช่วงเวลานี้ไม่สามารถจองได้แล้ว");
      return;
    }

    try {
      await createAppointment({
        patientId: user.id,
        patientName: user.name || user.email || "ผู้ป่วย",
        treatmentType: labelFrom(treatmentId),
        date: ymd,
        time,
        status: "scheduled",
      } as any);
      onBack?.();
    } catch (err: any) {
      alert(err?.message || "จองไม่สำเร็จ");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
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
            onSelect={(d) => {
              setSelectedDate(d ?? undefined);
              setTime("");
            }}
            fromDate={new Date()}
            disabled={disabledDays}
          />
        </CardContent>
      </Card>

      {/* Right panel */}
      <div className="space-y-6">
        {/* Treatment */}
        <Card>
          <CardHeader>
            <CardTitle>ประเภทการรักษา</CardTitle>
          </CardHeader>
        <CardContent>
          <Label className="mb-2 block">เลือกบริการที่ต้องการ</Label>
          {loadingTreat ? (
            <p className="text-sm text-gray-500">กำลังโหลดรายการ...</p>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : activeTreatments.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีประเภทการรักษาที่เปิดใช้งาน</p>
          ) : (
            <Select
              value={treatmentId}
              onValueChange={setTreatmentId}
              disabled={!selectedDate || isHoliday(selectedDate)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedDate
                      ? "กรุณาเลือกวันที่ก่อน"
                      : isHoliday(selectedDate)
                      ? "วันนี้เป็นวันหยุด"
                      : "เลือกประเภทการรักษา"
                  }
                />
              </SelectTrigger>
              <SelectContent className="bg-white text-black">
              {activeTreatments.map((t) => (
                <SelectItem
                  key={t.id}
                  value={t.id}
                  className="bg-white text-black hover:bg-gray-100"
                >
                  {t.label}
                  {typeof (t as any).durationMin === "number" ? ` · ${(t as any).durationMin} นาที` : ""}
                  {typeof t.price === "number" ? ` · ${t.price.toLocaleString()} บาท` : ""}
                </SelectItem>
              ))}
            </SelectContent>
            </Select>
          )}
        </CardContent>
        </Card>

        {/* Time slots */}
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
            ) : isHoliday(selectedDate) ? (
              <p className="text-sm text-red-600">วันนี้เป็นวันหยุดของคลินิก ไม่สามารถจองคิวได้</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500">ไม่มีช่วงเวลาให้เลือก</p>
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

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onBack?.()}>
            ย้อนกลับ
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            ยืนยันการจอง
          </Button>
        </div>
      </div>
    </div>
  );
}

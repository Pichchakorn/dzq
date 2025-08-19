// src/components/PatientHistory.tsx
import React, { useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import type { Appointment } from "../types";

// ใช้ type สถานะจากที่เดียวกับโมเดล
type Status = Appointment["status"];

/** เปรียบเทียบวันที่/เวลาแบบไม่งง timezone */
function isPast(ymd: string, hm: string) {
  const nowYMD = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const nowHM = new Date().toTimeString().slice(0, 5);  // "HH:mm"
  return ymd < nowYMD || (ymd === nowYMD && hm < nowHM);
}

const statusLabel = (s: Status) =>
  s === "completed" ? "เสร็จสิ้น"
    : s === "missed" ? "ขาดนัด"
    : s === "cancelled" ? "ยกเลิก"
    : "นัดหมาย";

const statusVariant = (s: Status) =>
  s === "completed" ? "success"
    : s === "missed" ? "destructive"
    : s === "cancelled" ? "dark"
    : "secondary";

export default function PatientHistory() {
  const { user } = useAuth();
  const { appointments, updateAppointment } = useAppointments();

  // หลีกเลี่ยงการเรียก Hooks แบบมีเงื่อนไข
  const uid = user?.id ?? null;

  // นัดของผู้ใช้คนนี้ทั้งหมด (ถ้าไม่มี uid ให้คืน [] แทน)
  const myApps = useMemo(
    () => (uid ? appointments.filter((a) => a.patientId === uid) : []),
    [appointments, uid]
  );

  // อัปเดตเป็น "missed" ถ้าเลยเวลาแล้วยังเป็น scheduled
  useEffect(() => {
    if (!uid || myApps.length === 0) return;
    const pastScheduled = myApps.filter(
      (a) => a.status === "scheduled" && isPast(a.date, a.time)
    );
    if (pastScheduled.length === 0) return;

    pastScheduled.forEach((a) => {
      updateAppointment(a.id, { status: "missed" }).catch(() => {});
    });
  }, [uid, myApps, updateAppointment]);

  // ประวัติ = แสดงเฉพาะ completed + missed
  const rows = useMemo(
    () =>
      myApps
        .filter((a) => a.status === "completed" || a.status === "missed")
        .sort((a, b) => (`${b.date} ${b.time}` > `${a.date} ${a.time}` ? 1 : -1)),
    [myApps]
  );

  // เรนเดอร์แบบมีเงื่อนไข — ไม่เรียก Hooks ใหม่
  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติการรักษา</CardTitle>
        <CardDescription>หน้านี้จะแสดงเฉพาะรายการที่เสร็จสิ้นหรือขาดนัด</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">ยังไม่มีประวัติการรักษา</p>
        ) : (
          <div className="divide-y">
            {rows.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{a.treatmentType}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(`${a.date}T00:00:00`).toLocaleDateString("th-TH")} · {a.time} น.
                  </p>
                </div>
                <Badge variant={statusVariant(a.status)}>{statusLabel(a.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

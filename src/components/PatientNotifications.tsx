// src/components/PatientNotifications.tsx
import React, { useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import type { Appointment } from "../types";

type Status = Appointment["status"];
type ApptWithReason = Appointment & { cancelReason?: string }; // เผื่อมีเหตุผลการยกเลิก

function isPast(ymd: string, hm: string) {
  const nowYMD = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const nowHM = new Date().toTimeString().slice(0, 5);  // "HH:mm"
  return ymd < nowYMD || (ymd === nowYMD && hm < nowHM);
}

export default function PatientNotifications() {
  const { user } = useAuth();
  const { appointments, updateAppointment } = useAppointments();

  const uid = user?.id ?? null;

  // นัดของผู้ใช้ (ถ้าไม่มี uid ให้เป็น [])
  const myApps = useMemo(
    () => (uid ? (appointments as ApptWithReason[]).filter(a => a.patientId === uid) : []),
    [appointments, uid]
  );

  // อัปเดตนัดที่เลยเวลาแต่ยังเป็น scheduled -> missed (ถ้าอยากคงเดิม)
  useEffect(() => {
    if (!uid || myApps.length === 0) return;
    const pastScheduled = myApps.filter(a => a.status === "scheduled" && isPast(a.date, a.time));
    pastScheduled.forEach(a => {
      updateAppointment(a.id, { status: "missed" }).catch(() => {});
    });
  }, [uid, myApps, updateAppointment]);

  // ✅ นัดหมายที่กำลังจะถึง (scheduled & ยังไม่ผ่าน)
  const upcoming = useMemo(
    () =>
      myApps
        .filter(a => a.status === "scheduled" && !isPast(a.date, a.time))
        .sort((a, b) => (`${a.date} ${a.time}` > `${b.date} ${b.time}` ? 1 : -1)),
    [myApps]
  );

  // ✅ ยกเลิกล่าสุด (cancelled) — เอา 10 รายการหลังสุดพอ
  const cancelled = useMemo(
    () =>
      myApps
        .filter(a => a.status === "cancelled")
        .sort((a, b) => (`${b.date} ${b.time}` > `${a.date} ${a.time}` ? 1 : -1))
        .slice(0, 10),
    [myApps]
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      <Card>
        <CardHeader>
          <CardTitle>การแจ้งเตือน</CardTitle>
          <CardDescription>นัดหมายที่กำลังจะถึง</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-center text-gray-500 py-8">ไม่มีนัดหมายที่กำลังจะถึง</p>
          ) : (
            <div className="divide-y">
              {upcoming.map(a => (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{a.treatmentType}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(`${a.date}T00:00:00`).toLocaleDateString("th-TH")} · {a.time} น.
                    </p>
                  </div>
                  <Badge variant="secondary">นัดหมาย</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently cancelled (show reason if exists) */}
      <Card>
        <CardHeader>
          <CardTitle>ยกเลิกล่าสุด</CardTitle>
          <CardDescription>
            รายการที่ถูกยกเลิกโดยคลินิก จะแสดงพร้อมเหตุผล (ถ้ามี)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cancelled.length === 0 ? (
            <p className="text-center text-gray-500 py-8">ยังไม่มีรายการยกเลิก</p>
          ) : (
            <div className="divide-y">
              {cancelled.map(a => (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{a.treatmentType}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(`${a.date}T00:00:00`).toLocaleDateString("th-TH")} · {a.time} น.
                    </p>
                    {(a as ApptWithReason).cancelReason && (
                      <p className="text-sm text-red-600 mt-1">
                        เหตุผล: {(a as ApptWithReason).cancelReason}
                      </p>
                    )}
                  </div>
                  <Badge variant="dark">ยกเลิก</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

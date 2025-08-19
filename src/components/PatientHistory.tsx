// src/components/PatientHistory.tsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";

const key = (d: string, t: string) => `${d} ${t}`;
const desc = (a: string, b: string) => (a > b ? -1 : a < b ? 1 : 0);

export default function PatientHistory() {
  const { user } = useAuth();
  const { appointments } = useAppointments();

  if (!user) return null;

  // ดึงเฉพาะของผู้ใช้คนนี้ (กันเหนียว แม้ context จะคัดมาให้แล้ว)
  const mine = appointments.filter((a) => a.patientId === user.id);
  const sorted = [...mine].sort((a, b) => desc(key(a.date, a.time), key(b.date, b.time)));

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>ประวัติการรักษา</CardTitle>
          <CardDescription>หน้านี้จะแสดงประวัติการรักษาทั้งหมด</CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-gray-500">ยังไม่มีประวัติการรักษา</p>
          ) : (
            <div className="divide-y">
              {sorted.map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.treatmentType || "ไม่ระบุบริการ"}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(`${a.date}T00:00:00`).toLocaleDateString("th-TH")} · {a.time} น.
                    </div>
                  </div>
                  <Badge
                    variant={
                      a.status === "completed"
                        ? "default"
                        : a.status === "scheduled"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {a.status === "completed"
                      ? "เสร็จสิ้น"
                      : a.status === "scheduled"
                      ? "นัดหมาย"
                      : "ยกเลิก"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

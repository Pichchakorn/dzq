// src/components/PatientDashboard.tsx
import React, { useMemo } from "react";
import {
  Calendar,
  Clock,
  User as UserIcon,
  Bell,
  History,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import type { Appointment } from "../types";
import { toast } from "sonner";


interface PatientDashboardProps {
  onNavigate: (page: string) => void;
}

type Status = Appointment["status"];

// --- helpers ------------------------------------------------
const key = (d: string, t: string) => `${d} ${t}`;
const cmpAsc = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cmpDesc = (a: string, b: string) => (a > b ? -1 : a < b ? 1 : 0);

function isPast(dateYMD: string, timeHM: string) {
  const nowYMD = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const nowHM = new Date().toTimeString().slice(0, 5);  // "HH:mm"
  return dateYMD < nowYMD || (dateYMD === nowYMD && timeHM < nowHM);
}

const statusLabel = (s: Status) =>
  s === "completed" ? "เสร็จสิ้น" :
  s === "missed"    ? "ขาดนัด"   :
  s === "cancelled" ? "ยกเลิก"   : "นัดหมาย";

const statusVariant = (s: Status) =>
  s === "completed" ? "success" :
  s === "missed"    ? "destructive" :
  s === "cancelled" ? "dark" : "secondary";


// ------------------------------------------------------------

export function PatientDashboard({ onNavigate }: PatientDashboardProps) {
  const { user } = useAuth();
  const { appointments, cancelAppointment } = useAppointments(); // ✅ ดึง cancelAppointment มาใช้
  const pid = user?.id ?? "";

  // นัดของผู้ใช้คนนี้
  const userAppointments = useMemo(
    () => appointments.filter(a => a.patientId === pid),
    [appointments, pid]
  );

  // นัดล่วงหน้า (ยัง scheduled และไม่ผ่านเวลา)
  const upcomingAppointments = useMemo(
    () =>
      userAppointments
        .filter(a => a.status === "scheduled" && !isPast(a.date, a.time))
        .sort((a, b) => cmpAsc(key(a.date, a.time), key(b.date, b.time))),
    [userAppointments]
  );

  // นัดล่าสุด (เฉพาะที่สถานะเสร็จสิ้นเท่านั้น)
  const recentAppointments = useMemo(
    () =>
      [...userAppointments]
        .filter(a => a.status === "completed")
        .sort((a, b) => cmpDesc(key(a.date, a.time), key(b.date, b.time)))
        .slice(0, 3),
    [userAppointments]
  );

  // ยกเลิกนัด
  const onCancel = async (id: string, date: string, time: string) => {
    const ok = window.confirm(`ต้องการยกเลิกคิววันที่ ${date} เวลา ${time} ใช่ไหม?`);
    if (!ok) return;

    try {
      await cancelAppointment(id, "ไม่สะดวกมาตามนัด");
      toast.success("ยกเลิกคิวเรียบร้อย");
    } catch (e: any) {
      toast.error(e?.message || "ยกเลิกไม่สำเร็จ");
    }
  };

// ...existing code...

  return (
    <div className="space-y-6">
      {/* Welcome + Avatar (display only) */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-2">สวัสดี, {user?.name ?? "ผู้ใช้งาน"}</h1>
          <p className="text-blue-100">ยินดีต้อนรับสู่ระบบจองคิวทันตกรรม DZQ</p>
        </div>
        <div className="w-14 h-14 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-7 h-7 text-white" />
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ...Quick Action Cards... */}
      </div>

      {/* Next Appointment + Recent Appointments side by side */}
      <div className="w-full min-w-0 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* นัดหมายต่อไป */}
              <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            นัดหมายต่อไป
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appointment) => {
                const apptDt = new Date(`${appointment.date}T${appointment.time}:00`);
                const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
                const canCancel = appointment.status === "scheduled" && apptDt > twoHoursFromNow;

                return (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between py-3 border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">{appointment.treatmentType}</p>
                      <p className="text-sm text-gray-600 flex items-center mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(`${appointment.date}T00:00:00`).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {appointment.time} น.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(appointment.status)}>
                        {statusLabel(appointment.status)}
                      </Badge>
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onCancel(appointment.id!, appointment.date, appointment.time)}
                        >
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 py-8">ไม่มีนัดหมายล่วงหน้า</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* นัดหมายล่าสุด */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>นัดหมายล่าสุด</CardTitle>
            <CardDescription>ประวัติการเข้ารับการรักษา</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {recentAppointments.length > 0 ? (
                recentAppointments.map((appointment) => {
                  const isCancelled = appointment.status === "cancelled";
                  return (
                    <div key={appointment.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{appointment.treatmentType}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(`${appointment.date}T00:00:00`).toLocaleDateString("th-TH")} - {appointment.time} น.
                        </p>
                        {isCancelled && appointment.cancelReason && (
                          <p className="text-xs text-gray-500 mt-1">
                            เหตุผล: {appointment.cancelReason}
                          </p>
                        )}
                      </div>
                      <Badge variant={statusVariant(appointment.status)}>
                        {statusLabel(appointment.status)}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-gray-500 py-8">ยังไม่มีประวัติการรักษา</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
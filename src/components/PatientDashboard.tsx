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
  const { appointments } = useAppointments();

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
  const nextAppointment = upcomingAppointments[0];

  // นัดล่าสุด (ทุกสถานะ) เอา 3 รายการล่าสุด
  const recentAppointments = useMemo(
    () =>
      [...userAppointments]
        .sort((a, b) => cmpDesc(key(a.date, a.time), key(b.date, b.time)))
        .slice(0, 3),
    [userAppointments]
  );

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
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("booking")}>
          <CardContent className="flex items-center p-6">
            <Plus className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h3>จองคิวใหม่</h3>
              <p className="text-sm text-gray-600">นัดหมายการรักษา</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("history")}>
          <CardContent className="flex items-center p-6">
            <History className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <h3>ประวัติการรักษา</h3>
              <p className="text-sm text-gray-600">ดูประวัติการมาใช้บริการ</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("notifications")}>
          <CardContent className="flex items-center p-6">
            <Bell className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <h3>การแจ้งเตือน</h3>
              <p className="text-sm text-gray-600">ดูข้อความแจ้งเตือน</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("profile")}>
          <CardContent className="flex items-center p-6">
            <ImageIcon className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <h3>ข้อมูลส่วนตัว</h3>
              <p className="text-sm text-gray-600">จัดการข้อมูลส่วนตัว</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Appointment */}
      {nextAppointment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              นัดหมายต่อไป
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{nextAppointment.treatmentType}</p>
                <p className="text-sm text-gray-600 flex items-center mt-1">
                  <Calendar className="h-4 w-4 mr-1" />
                  {new Date(`${nextAppointment.date}T00:00:00`).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-sm text-gray-600 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {nextAppointment.time} น.
                </p>
              </div>
              <Badge variant={statusVariant(nextAppointment.status)}>
                {statusLabel(nextAppointment.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>นัดหมายล่าสุด</CardTitle>
          <CardDescription>ประวัติการเข้ารับการรักษา</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAppointments.map((appointment) => {
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
          })}


          {userAppointments.length === 0 && (
            <p className="text-center text-gray-500 py-8">ยังไม่มีประวัติการรักษา</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

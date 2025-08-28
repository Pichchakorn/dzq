// src/components/DoctorDashboard.tsx
import React, { useState, useMemo } from "react";
import { Calendar, Clock, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import type { Appointment } from "../types";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

type Status = Appointment["status"];

// สร้าง time slots ตามคลินิก
function buildAllSlots(
  s: { start: string; end: string },
  stepMin: number,
  breakTime: { start: string; end: string }
) {
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
    if (m >= brS && m < brE) continue;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}

export function DoctorDashboard() {
  const {
    clinicSettings,
    lockedSlots,
    lockSlot,
    unlockSlot,
    appointments,
    updateAppointment,
    clearQueue,
  } = useAppointments();
  const { user, isAdmin, isLoading } = useAuth();

  const [lockDate, setLockDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // ------- HOOKS ต้องอยู่ก่อน return เสมอ --------

  // slots สำหรับการล็อค
  const allSlotsForLock = useMemo(
    () => buildAllSlots(clinicSettings.workingHours, clinicSettings.slotDuration, clinicSettings.breakTime),
    [clinicSettings]
  );

  // ชุดเวลาที่ถูกล็อคของวัน lockDate
  const lockedSet = useMemo(
    () => new Set(lockedSlots.filter((l) => l.date === lockDate).map((l) => l.time)),
    [lockedSlots, lockDate]
  );

  const statusLabel = (s: Status) =>
    s === "completed" ? "เสร็จสิ้น" : s === "missed" ? "ขาดนัด" : s === "cancelled" ? "ยกเลิก" : "นัดหมาย";

  const statusVariant = (s: Status) =>
    s === "completed" ? "default" : s === "missed" ? "destructive" : s === "cancelled" ? "destructive" : "secondary";

  // ตารางข้อมูล
  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((app) => app.date === selectedDate && app.status === "scheduled")
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, selectedDate]
  );

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const allScheduledAppointments = useMemo(
    () =>
      appointments
        .filter((app) => app.status === "scheduled" && app.date >= todayStr)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [appointments, todayStr]
  );

  // actions
  const handleCompleteAppointment = async (id: string) => {
    await updateAppointment(id, { status: "completed" });
  };
  const handleCancelAppointment = async (id: string) => {
    const reason = window.prompt("เหตุผลในการยกเลิกนัดนี้คืออะไร?", "");
    await updateAppointment(id, { status: "cancelled", cancelReason: (reason || "").trim() || "ยกเลิกโดยคลินิก" });
  };
  const handleClearToday = async (to: "completed" | "cancelled") => {
    await clearQueue(selectedDate, to);
  };

  // -----------------------------------------------

  return (
    <div className="space-y-6">
      {/* Loading → ไม่ render อะไรเพิ่ม (แต่ยังคง order ของ hooks เพราะเราเรียกทั้งหมดแล้ว) */}
      {isLoading ? null : !isAdmin ? (
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>ไม่มีสิทธิ์เข้าถึง</CardTitle>
              <CardDescription>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <>
          {/* Welcome */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-lg">
            <h1 className="text-2xl mb-2">สวัสดี, {user?.name}</h1>
            <p className="text-green-100">Dashboard สำหรับจัดการคิวผู้ป่วย</p>
          </div>

          {/* 🔒 จัดการล็อคเวลา */}
          <Card>
            <CardHeader>
              <CardTitle>จัดการล็อคช่วงเวลา</CardTitle>
              <CardDescription>แอดมินสามารถล็อค/ปลดล็อคเวลาของวันได้</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-sm block mb-1">วันที่</label>
                  <Input type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-sm block mb-1">เหตุผล (ถ้ามี)</label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="เช่น หมอประชุม / ปิดทำการช่วงบ่าย"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {allSlotsForLock.map((t) => {
                  const isLocked = lockedSet.has(t);
                  return (
                    <Button
                      key={t}
                      variant={isLocked ? "secondary" : "outline"}
                      onClick={async () => (isLocked ? unlockSlot(lockDate, t) : lockSlot(lockDate, t, reason))}
                    >
                      {t} {isLocked ? "· ล็อคอยู่" : ""}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tables */}
          <Tabs defaultValue="today" className="w-full">
            <TabsList>
              <TabsTrigger value="today">คิววันนี้</TabsTrigger>
              <TabsTrigger value="upcoming">คิวที่กำลังจะมาถึง</TabsTrigger>
              <TabsTrigger value="history">ประวัติการรักษา</TabsTrigger>
            </TabsList>

            {/* Today */}
            <TabsContent value="today" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>คิวผู้ป่วยวันนี้</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-1 border rounded"
                      />
                      <Button variant="outline" onClick={() => handleClearToday("completed")}>
                        เคลียร์คิววันนี้ (เสร็จสิ้น)
                      </Button>
                      <Button variant="destructive" onClick={() => handleClearToday("cancelled")}>
                        เคลียร์คิววันนี้ (ยกเลิก)
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    รายการนัดหมายในวันที่ {new Date(selectedDate).toLocaleDateString("th-TH")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {todayAppointments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>เวลา</TableHead>
                          <TableHead>ชื่อผู้ป่วย</TableHead>
                          <TableHead>การรักษา</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead>จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todayAppointments.map((appointment: Appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>{appointment.time}</TableCell>
                            <TableCell>{appointment.patientName}</TableCell>
                            <TableCell>{appointment.treatmentType}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(appointment.status)}>
                                {statusLabel(appointment.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button size="sm" onClick={() => handleCompleteAppointment(appointment.id)}>
                                  เสร็จสิ้น
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelAppointment(appointment.id)}
                                >
                                  ยกเลิก
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-gray-500 py-8">ไม่มีคิวในวันนี้</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Upcoming */}
            <TabsContent value="upcoming">
              <Card>
                <CardHeader>
                  <CardTitle>คิวที่กำลังจะมาถึง</CardTitle>
                  <CardDescription>รายการนัดหมายในอนาคต</CardDescription>
                </CardHeader>
                <CardContent>
                  <div style={{ maxHeight: 400, overflowY: "auto" }}>
                    {allScheduledAppointments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>วันที่</TableHead>
                          <TableHead>เวลา</TableHead>
                          <TableHead>ชื่อผู้ป่วย</TableHead>
                          <TableHead>การรักษา</TableHead>
                          <TableHead>จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allScheduledAppointments.map((appointment: Appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>{new Date(appointment.date).toLocaleDateString("th-TH")}</TableCell>
                            <TableCell>{appointment.time}</TableCell>
                            <TableCell>{appointment.patientName}</TableCell>
                            <TableCell>{appointment.treatmentType}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => handleCancelAppointment(appointment.id)}>
                                ยกเลิก
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-gray-500 py-8">ไม่มีคิวที่กำลังจะมาถึง</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

            {/* History */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>ประวัติการรักษา</CardTitle>
                  <CardDescription>รายการการรักษาที่เสร็จสิ้นแล้ว</CardDescription>
                </CardHeader>
                <CardContent>
                  {appointments.filter((a) => a.status === "completed").length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>วันที่</TableHead>
                          <TableHead>เวลา</TableHead>
                          <TableHead>ชื่อผู้ป่วย</TableHead>
                          <TableHead>การรักษา</TableHead>
                          <TableHead>สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments
                          .filter((a) => a.status === "completed")
                          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                          .map((appointment: Appointment) => (
                            <TableRow key={appointment.id}>
                              <TableCell>{new Date(appointment.date).toLocaleDateString("th-TH")}</TableCell>
                              <TableCell>{appointment.time}</TableCell>
                              <TableCell>{appointment.patientName}</TableCell>
                              <TableCell>{appointment.treatmentType}</TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(appointment.status)}>
                                  {statusLabel(appointment.status)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-gray-500 py-8">ยังไม่มีประวัติการรักษา</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

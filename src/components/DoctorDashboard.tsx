// src/components/DoctorDashboard.tsx
import React, { useState } from "react";
import { Calendar, Clock, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import type { Appointment } from "../types";


type Status = Appointment["status"];


export function DoctorDashboard() {
  const { user, isAdmin, isLoading } = useAuth();
  const { appointments, updateAppointment, clearQueue } = useAppointments();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>ไม่มีสิทธิ์เข้าถึง</CardTitle>
            <CardDescription>
              หน้านี้สำหรับผู้ดูแลระบบเท่านั้น หากคุณเป็นผู้ดูแล โปรดเข้าสู่ระบบด้วยอีเมลแอดมิน
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // === helpers สำหรับ UI ===
  const statusLabel = (s: Status) =>
    s === "completed" ? "เสร็จสิ้น" :
    s === "missed"    ? "ขาดนัด"   :
    s === "cancelled" ? "ยกเลิก"   : "นัดหมาย";

  const statusVariant = (s: Status) =>
    s === "completed" ? "default" :
    s === "missed"    ? "destructive" :
    s === "cancelled" ? "destructive" : "secondary";

  // === datasets ===
  const todayAppointments = appointments
    .filter((app) => app.date === selectedDate && app.status === "scheduled")
    .sort((a, b) => a.time.localeCompare(b.time));

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const allScheduledAppointments = appointments
    .filter((app) => app.status === "scheduled" && app.date >= todayStr)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // === actions ===
  const handleCompleteAppointment = async (id: string) => {
    await updateAppointment(id, { status: "completed" });
  };
  const handleCancelAppointment = async (id: string) => {
    const reason = window.prompt("เหตุผลในการยกเลิกนัดนี้คืออะไร?", "");
    await updateAppointment(id, {
      status: "cancelled",
      cancelReason: reason?.trim() || "ยกเลิกโดยคลินิก"
    });
  };


  const handleClearToday = async (to: "completed" | "cancelled") => {
    if (!clearQueue) return;
    await clearQueue(selectedDate, to);
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-lg">
        <h1 className="text-2xl mb-2">สวัสดี, {user?.name}</h1>
        <p className="text-green-100">Dashboard สำหรับจัดการคิวผู้ป่วย</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h3>คิววันนี้</h3>
              <p className="text-2xl font-bold">{todayAppointments.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Clock className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <h3>คิวที่กำลังรอ</h3>
              <p className="text-2xl font-bold">{allScheduledAppointments.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <h3>ผู้ป่วยทั้งหมด</h3>
              <p className="text-2xl font-bold">
                {new Set(appointments.map((a) => a.patientId)).size}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                    {todayAppointments.map((appointment) => (
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
                            <Button size="sm" variant="outline" onClick={() => handleCancelAppointment(appointment.id)}>
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
                    {allScheduledAppointments.map((appointment) => (
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
                      .map((appointment) => (
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
    </div>
  );
}

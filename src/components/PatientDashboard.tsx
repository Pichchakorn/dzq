// PatientDashboard.tsx
import React, { useRef, useState } from "react";
import {
  Calendar,
  Clock,
  User as UserIcon,
  Bell,
  History,
  Plus,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";

interface PatientDashboardProps {
  onNavigate: (page: string) => void;
}

export function PatientDashboard({ onNavigate }: PatientDashboardProps) {
  const { user, updateUserProfile } = useAuth();
  const { appointments } = useAppointments();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const pid = user?.id ?? "";

  // helper สำหรับเปรียบเทียบแบบไม่พึ่ง timezone
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const key = (d: string, t: string) => `${d} ${t}`;
  const cmpAsc = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const cmpDesc = (a: string, b: string) => (a > b ? -1 : a < b ? 1 : 0);

  const userAppointments = appointments.filter((app) => app.patientId === pid);

  // คิวล่วงหน้า (ตั้งแต่วันนี้และเวลายังไม่ผ่าน) เรียงจากใกล้สุดไปไกลสุด
    const upcomingAppointments = userAppointments
    .filter((app) => app.status === "scheduled" && app.date >= todayStr)
    .sort((a, b) => (`${a.date} ${a.time}` > `${b.date} ${b.time}` ? 1 : -1));

  const nextAppointment = upcomingAppointments[0];

  // นัดหมายล่าสุด (ทุกสถานะ) เรียงจากใหม่สุดไปเก่าสุด แล้วหยิบ 3 อันดับแรก
  const recentAppointments = [...userAppointments]
    .sort((a, b) => cmpDesc(key(a.date, a.time), key(b.date, b.time)))
    .slice(0, 3);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pid) return;
    try {
      setUploading(true);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const storageRef = ref(storage, `avatars/${pid}.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateUserProfile({ photoURL: url });
      toast.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
    } catch (err) {
      console.error(err);
      toast.error("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statusLabel = (s: "scheduled" | "completed" | "cancelled") =>
  s === "completed" ? "เสร็จสิ้น" : s === "cancelled" ? "ยกเลิก" : "นัดหมาย";

  const statusVariant = (s: "scheduled" | "completed" | "cancelled") =>
  s === "completed" ? "default" : s === "cancelled" ? "destructive" : "secondary";


  return (
    <div className="space-y-6">
      {/* Welcome Section + Avatar */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-2">สวัสดี, {user?.name ?? "ผู้ใช้งาน"}</h1>
          <p className="text-blue-100">ยินดีต้อนรับสู่ระบบจองคิวทันตกรรม DZQ</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-7 h-7 text-white" />
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onPickFile}
            disabled={uploading}
            className="bg-white text-blue-700 hover:bg-white/90"
          >
            {uploading ? "กำลังอัปโหลด..." : (<><Upload className="w-4 h-4 mr-1" />เปลี่ยนรูป</>)}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileSelected}
          />
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
              const statusLabel = (s: string) =>
                s === "completed" ? "เสร็จสิ้น" : s === "cancelled" ? "ยกเลิก" : "นัดหมาย";

              const statusVariant = (s: string) =>
                s === "completed" ? "default" : s === "cancelled" ? "destructive" : "secondary";

              return (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between py-3 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">{appointment.treatmentType}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(`${appointment.date}T00:00:00`).toLocaleDateString("th-TH")} -{" "}
                      {appointment.time} น.
                    </p>
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

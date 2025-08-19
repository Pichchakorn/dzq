import React, { useMemo, useState } from "react";
import {
  Clock, Calendar, DollarSign, Building, Save, Plus, Trash2, Edit,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useAppointments } from "../contexts/AppointmentContext";
import { toast } from "sonner";

/* ---------- Types ---------- */
type WorkingHours = { start: string; end: string };
type BreakTime = { start: string; end: string };
type Treatment = { id: string; name: string; duration: number; price: number };
type NewTreatment = Omit<Treatment, "id">;
type ClinicInfo = { name: string; address: string; phone: string; email: string };

type ClinicSettings = {
  workingHours: WorkingHours;
  breakTime: BreakTime;
  slotDuration: number;
  holidays: string[];
  clinicInfo?: ClinicInfo;
};

/* ---------- Safe defaults (กัน undefined) ---------- */
const DEFAULT_SETTINGS: ClinicSettings = {
  workingHours: { start: "09:00", end: "17:00" },
  breakTime: { start: "12:00", end: "13:00" },
  slotDuration: 30,
  holidays: [],
  clinicInfo: {
    name: "คลินิกทันตกรรม DZQ",
    address: "123 ถนนสุขใจ เขตใจดี กรุงเทพฯ 10120",
    phone: "02-123-4567",
    email: "info@dzq-clinic.com",
  },
};

export function SettingsPage() {
  // จาก context (ถ้าไม่มี ให้ fallback เป็นค่า default)
  const {
    treatmentTypes,
    clinicSettings,
    // ฟังก์ชันต่อไปนี้ “อาจ” ยังไม่มีในโปรเจกต์คุณ ไม่เป็นไร เราจะเช็คก่อนเรียก
    updateClinicSettings,
    setTreatmentTypes,
  } = useAppointments() as any;

  const initialSettings: ClinicSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...(clinicSettings ?? {}) }),
    [clinicSettings]
  );

  /* ---------- States ---------- */
  // Working hours
  const [workingHours, setWorkingHours] = useState<WorkingHours>(initialSettings.workingHours);
  const [breakTime, setBreakTime] = useState<BreakTime>(initialSettings.breakTime);
  const [slotDuration, setSlotDuration] = useState<number>(initialSettings.slotDuration);

  // Holidays
  const [holidays, setHolidays] = useState<string[]>(initialSettings.holidays);
  const [newHoliday, setNewHoliday] = useState<string>("");
  const [holidayName, setHolidayName] = useState<string>(""); // ตอนนี้ใช้ตรวจความครบถ้วนเฉย ๆ

  // Treatments
  const [treatments, setTreatments] = useState<Treatment[]>(
    (treatmentTypes as Treatment[]) ?? []
  );
  const [newTreatment, setNewTreatment] = useState<NewTreatment>({
    name: "",
    duration: 30,
    price: 0,
  });
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);

  // Clinic info
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>(
    initialSettings.clinicInfo ?? DEFAULT_SETTINGS.clinicInfo!
  );

  /* ---------- Handlers: Working hours ---------- */
  const handleSaveWorkingHours = async () => {
    const next: ClinicSettings = {
      workingHours,
      breakTime,
      slotDuration,
      holidays,
      clinicInfo,
    };
    try {
      if (typeof updateClinicSettings === "function") {
        await updateClinicSettings(next);
      }
      toast.success("บันทึกเวลาทำการเรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  /* ---------- Handlers: Holidays ---------- */
  const handleAddHoliday = () => {
    if (!newHoliday || !holidayName) {
      toast.error("กรุณากรอกวันที่และชื่อวันหยุด");
      return;
    }
    if (holidays.includes(newHoliday)) {
      toast.error("มีวันหยุดนี้อยู่แล้ว");
      return;
    }
    setHolidays((prev) => [...prev, newHoliday]);
    setNewHoliday("");
    setHolidayName("");
    toast.success("เพิ่มวันหยุดเรียบร้อย");
  };

  const handleRemoveHoliday = (holidayDate: string) => {
    setHolidays((prev) => prev.filter((h) => h !== holidayDate));
    toast.success("ลบวันหยุดเรียบร้อย");
  };

  /* ---------- Handlers: Treatments ---------- */
  const handleAddTreatment = async () => {
    if (!newTreatment.name || newTreatment.price < 0) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    const treatment: Treatment = {
      id: crypto?.randomUUID?.() ?? Date.now().toString(),
      ...newTreatment,
    };
    const next = [...treatments, treatment];
    setTreatments(next);
    setNewTreatment({ name: "", duration: 30, price: 0 });

    // บันทึกกลับ context ถ้ามี
    if (typeof setTreatmentTypes === "function") {
      try {
        await setTreatmentTypes(next);
      } catch (e) {
        console.error(e);
      }
    }
    toast.success("เพิ่มประเภทการรักษาเรียบร้อย");
  };

  const handleUpdateTreatment = async () => {
    if (!editingTreatment) return;
    const next = treatments.map((t) => (t.id === editingTreatment.id ? editingTreatment : t));
    setTreatments(next);
    setEditingTreatment(null);

    if (typeof setTreatmentTypes === "function") {
      try {
        await setTreatmentTypes(next);
      } catch (e) {
        console.error(e);
      }
    }
    toast.success("อัปเดตประเภทการรักษาเรียบร้อย");
  };

  const handleDeleteTreatment = async (id: string) => {
    const next = treatments.filter((t) => t.id !== id);
    setTreatments(next);

    if (typeof setTreatmentTypes === "function") {
      try {
        await setTreatmentTypes(next);
      } catch (e) {
        console.error(e);
      }
    }
    toast.success("ลบประเภทการรักษาเรียบร้อย");
  };

  /* ---------- Handlers: Clinic info ---------- */
  const handleSaveClinicInfo = async () => {
    const next: ClinicSettings = {
      workingHours,
      breakTime,
      slotDuration,
      holidays,
      clinicInfo,
    };
    try {
      if (typeof updateClinicSettings === "function") {
        await updateClinicSettings(next);
      }
      toast.success("บันทึกข้อมูลคลินิกเรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl">ตั้งค่าระบบ</h1>
        <p className="text-gray-600">จัดการการตั้งค่าคลินิกและระบบจองคิว</p>
      </div>

      <Tabs defaultValue="working-hours" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="working-hours">เวลาทำการ</TabsTrigger>
          <TabsTrigger value="holidays">วันหยุด</TabsTrigger>
          <TabsTrigger value="treatments">การรักษา</TabsTrigger>
          <TabsTrigger value="clinic-info">ข้อมูลคลินิก</TabsTrigger>
        </TabsList>

        {/* Working Hours */}
        <TabsContent value="working-hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                เวลาทำการ
              </CardTitle>
              <CardDescription>ตั้งค่าเวลาเปิด-ปิด และเวลาพัก</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3>เวลาทำการปกติ</h3>
                  <div className="space-y-2">
                    <Label htmlFor="start-time">เวลาเปิด</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={workingHours.start}
                      onChange={(e) => setWorkingHours((p) => ({ ...p, start: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">เวลาปิด</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={workingHours.end}
                      onChange={(e) => setWorkingHours((p) => ({ ...p, end: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3>เวลาพักกลางวัน</h3>
                  <div className="space-y-2">
                    <Label htmlFor="break-start">เริ่มพัก</Label>
                    <Input
                      id="break-start"
                      type="time"
                      value={breakTime.start}
                      onChange={(e) => setBreakTime((p) => ({ ...p, start: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="break-end">สิ้นสุดการพัก</Label>
                    <Input
                      id="break-end"
                      type="time"
                      value={breakTime.end}
                      onChange={(e) => setBreakTime((p) => ({ ...p, end: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slot-duration">ระยะเวลาต่อคิว (นาที)</Label>
                <Input
                  id="slot-duration"
                  type="number"
                  min={15}
                  max={120}
                  step={15}
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                  className="w-32"
                />
              </div>

              <Button onClick={handleSaveWorkingHours} className="flex items-center">
                <Save className="h-4 w-4 mr-2" />
                บันทึกการตั้งค่า
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holidays */}
        <TabsContent value="holidays" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                จัดการวันหยุด
              </CardTitle>
              <CardDescription>เพิ่ม/ลบ วันหยุดของคลินิก</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="holiday-date">วันที่</Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    value={newHoliday}
                    onChange={(e) => setNewHoliday(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="holiday-name">ชื่อวันหยุด</Label>
                  <Input
                    id="holiday-name"
                    placeholder="เช่น วันปีใหม่"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddHoliday}>
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่ม
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3>รายการวันหยุด</h3>
                {holidays.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.map((holiday) => (
                        <TableRow key={holiday}>
                          <TableCell>
                            {new Date(holiday).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveHoliday(holiday)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-gray-500">ยังไม่มีวันหยุดที่กำหนด</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treatment Types */}
        <TabsContent value="treatments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                ประเภทการรักษา
              </CardTitle>
              <CardDescription>จัดการประเภทการรักษาและราคา</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>ชื่อการรักษา</Label>
                  <Input
                    placeholder="เช่น ขูดหินปูน"
                    value={newTreatment.name}
                    onChange={(e) => setNewTreatment((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>ระยะเวลา (นาที)</Label>
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    value={newTreatment.duration}
                    onChange={(e) => setNewTreatment((p) => ({ ...p, duration: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>ราคา (บาท)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newTreatment.price}
                    onChange={(e) => setNewTreatment((p) => ({ ...p, price: Number(e.target.value) }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddTreatment} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่ม
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อการรักษา</TableHead>
                    <TableHead>ระยะเวลา</TableHead>
                    <TableHead>ราคา</TableHead>
                    <TableHead>จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.map((treatment) => (
                    <TableRow key={treatment.id}>
                      <TableCell>{treatment.name}</TableCell>
                      <TableCell>{treatment.duration} นาที</TableCell>
                      <TableCell>฿{treatment.price}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingTreatment(treatment)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>แก้ไขการรักษา</DialogTitle>
                                <DialogDescription>แก้ไขข้อมูลการรักษา</DialogDescription>
                              </DialogHeader>
                              {editingTreatment && (
                                <div className="space-y-4">
                                  <div>
                                    <Label>ชื่อการรักษา</Label>
                                    <Input
                                      value={editingTreatment.name}
                                      onChange={(e) =>
                                        setEditingTreatment((prev) =>
                                          prev ? { ...prev, name: e.target.value } : prev
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>ระยะเวลา (นาที)</Label>
                                    <Input
                                      type="number"
                                      value={editingTreatment.duration}
                                      onChange={(e) =>
                                        setEditingTreatment((prev) =>
                                          prev ? { ...prev, duration: Number(e.target.value) } : prev
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>ราคา (บาท)</Label>
                                    <Input
                                      type="number"
                                      value={editingTreatment.price}
                                      onChange={(e) =>
                                        setEditingTreatment((prev) =>
                                          prev ? { ...prev, price: Number(e.target.value) } : prev
                                        )
                                      }
                                    />
                                  </div>
                                  <Button onClick={handleUpdateTreatment} className="w-full">
                                    บันทึกการแก้ไข
                                  </Button>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteTreatment(treatment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clinic Info */}
        <TabsContent value="clinic-info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                ข้อมูลคลินิก
              </CardTitle>
              <CardDescription>จัดการข้อมูลทั่วไปของคลินิก</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">ชื่อคลินิก</Label>
                <Input
                  id="clinic-name"
                  value={clinicInfo.name}
                  onChange={(e) => setClinicInfo((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-address">ที่อยู่</Label>
                <Input
                  id="clinic-address"
                  value={clinicInfo.address}
                  onChange={(e) => setClinicInfo((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic-phone">เบอร์โทรศัพท์</Label>
                  <Input
                    id="clinic-phone"
                    value={clinicInfo.phone}
                    onChange={(e) => setClinicInfo((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinic-email">อีเมล</Label>
                  <Input
                    id="clinic-email"
                    type="email"
                    value={clinicInfo.email}
                    onChange={(e) => setClinicInfo((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={handleSaveClinicInfo} className="flex items-center">
                <Save className="h-4 w-4 mr-2" />
                บันทึกข้อมูลคลินิก
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// src/components/SettingsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
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
type BreakTime    = { start: string; end: string };

/** ✅ ทำให้ duration/price ไม่บังคับด้วยการทำให้เป็น optional */
type TreatmentRow = { id: string; name: string; duration?: number | null; price?: number | null };
type NewTreatment = Omit<TreatmentRow, "id">;

type ClinicInfo   = { name: string; address: string; phone: string; email: string };
type Holiday = { date: string; name: string };

type ClinicSettings = {
  workingHours: WorkingHours;
  breakTime: BreakTime;
  slotDuration: number;
  holidays: Holiday[];
  clinicInfo?: ClinicInfo;
};

/* ---------- Safe defaults ---------- */
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
  const {
    treatmentTypes,
    clinicSettings,
    updateClinicSettings,
    setTreatmentTypes,
  } = useAppointments() as any;

  const initialSettings: ClinicSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...(clinicSettings ?? {}) }),
    [clinicSettings]
  );

  /* ---------- Local states ---------- */
  // Working hours
  const [workingHours, setWorkingHours] = useState<WorkingHours>(initialSettings.workingHours);
  const [breakTime, setBreakTime]       = useState<BreakTime>(initialSettings.breakTime);
  const [slotDuration, setSlotDuration] = useState<number>(initialSettings.slotDuration);

  // Holidays
  const [holidays, setHolidays]         = useState<Holiday[]>(initialSettings.holidays);
  const [newHoliday, setNewHoliday]     = useState<string>("");
  const [newHolidayName, setNewHolidayName] = useState<string>("");

  // Treatments (ทำให้ duration/price optional)
  const [treatments, setTreatments] = useState<TreatmentRow[]>(
    ((treatmentTypes as any[]) ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      duration: typeof t.duration === "number" ? t.duration : null,
      price: typeof t.price === "number" ? t.price : null,
    }))
  );

  // สำหรับช่องกรอก (รองรับค่าว่าง)
  const [newTreatment, setNewTreatment] = useState<NewTreatment>({ name: "", duration: null, price: null });

  // แก้ไขรายการ
  const [editingTreatment, setEditingTreatment] = useState<TreatmentRow | null>(null);

  // Clinic info
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>(
    initialSettings.clinicInfo ?? DEFAULT_SETTINGS.clinicInfo!
  );

  // Edit holiday dialog
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [editingHolidayName, setEditingHolidayName] = useState<string>("");

  /* ---------- Sync จาก Context -> Local state ---------- */
  useEffect(() => {
    if (!clinicSettings) return;
    setWorkingHours(clinicSettings.workingHours ?? DEFAULT_SETTINGS.workingHours);
    setBreakTime(clinicSettings.breakTime ?? DEFAULT_SETTINGS.breakTime);
    setSlotDuration(clinicSettings.slotDuration ?? DEFAULT_SETTINGS.slotDuration);
    setHolidays(clinicSettings.holidays ?? []);
    setClinicInfo(clinicSettings.clinicInfo ?? DEFAULT_SETTINGS.clinicInfo!);
  }, [clinicSettings]);

  useEffect(() => {
    setTreatments(((treatmentTypes as any[]) ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      duration: typeof t.duration === "number" ? t.duration : null,
      price: typeof t.price === "number" ? t.price : null,
    })));
  }, [treatmentTypes]);

  /* ---------- Save working hours ---------- */
  const handleSaveWorkingHours = async () => {
    const next: Partial<ClinicSettings> = {
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

  /* ---------- Holidays ---------- */
  const handleAddHoliday = async () => {
    if (!newHoliday) {
      toast.error("กรุณาเลือกวันที่");
      return;
    }
    if (holidays.some((h) => h.date === newHoliday)) {
      toast.error("มีวันหยุดนี้อยู่แล้ว");
      return;
    }

    const entry: Holiday = { date: newHoliday, name: newHolidayName || "วันหยุด" };
    const next = [...holidays, entry].sort((a, b) => a.date.localeCompare(b.date));

    try {
      await updateClinicSettings({ holidays: next });
      setHolidays(next);
      setNewHoliday("");
      setNewHolidayName("");
      toast.success("เพิ่มวันหยุดเรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  const handleRemoveHoliday = async (date: string) => {
    const next = holidays.filter((h) => h.date !== date);
    try {
      await updateClinicSettings({ holidays: next });
      setHolidays(next);
      toast.success("ลบวันหยุดเรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  const handleRenameHoliday = async () => {
    if (!editingHoliday) return;
    const next = holidays.map((h) =>
      h.date === editingHoliday.date ? { ...h, name: editingHolidayName.trim() || "วันหยุด" } : h
    );
    try {
      await updateClinicSettings({ holidays: next });
      setHolidays(next);
      setEditingHoliday(null);
      toast.success("อัปเดตชื่อวันหยุดเรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  /* ---------- Treatments ---------- */
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  const handleAddTreatment = async () => {
    if (!newTreatment.name.trim()) {
      toast.error("กรุณากรอกชื่อการรักษา");
      return;
    }

    const treatment: TreatmentRow = {
      id: crypto?.randomUUID?.() ?? Date.now().toString(),
      name: newTreatment.name.trim(),
      duration: newTreatment.duration ?? null,
      price: newTreatment.price ?? null,
    };

    const next = [...treatments, treatment];
    setTreatments(next);
    setNewTreatment({ name: "", duration: null, price: null });

    if (typeof setTreatmentTypes === "function") {
      try {
        // Firestore จะไม่เขียนฟิลด์ที่เป็น undefined (ดีต่อเคสยังไม่กำหนด)
        await setTreatmentTypes(next as any);
      } catch (e) {
        console.error(e);
      }
    }
    toast.success("เพิ่มประเภทการรักษาเรียบร้อย");
  };

  const handleUpdateTreatment = async () => {
    if (!editingTreatment) return;

    const next = treatments.map((t) =>
      t.id === editingTreatment.id
        ? {
            ...t,
            name: editingTreatment.name.trim() || t.name,
            duration: editingTreatment.duration ?? null,
            price: editingTreatment.price ?? null,
          }
        : t
    );

    setTreatments(next);
    setEditingTreatment(null);

    if (typeof setTreatmentTypes === "function") {
      try {
        await setTreatmentTypes(next as any);
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
        await setTreatmentTypes(next as any);
      } catch (e) {
        console.error(e);
      }
    }
    toast.success("ลบประเภทการรักษาเรียบร้อย");
  };

  /* ---------- Save clinic info ---------- */
  const handleSaveClinicInfo = async () => {
    const next: Partial<ClinicSettings> = {
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
              <CardDescription>เพิ่ม / ลบ / แก้ไข วันหยุดของคลินิก</CardDescription>
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
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
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
                        <TableHead>ชื่อวันหยุด</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.map((h) => (
                        <TableRow key={h.date}>
                          <TableCell>
                            {new Date(h.date + "T00:00:00").toLocaleDateString("th-TH", {
                              year: "numeric", month: "long", day: "numeric",
                            })}
                          </TableCell>
                          <TableCell>{h.name}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Dialog
                                onOpenChange={(open) => {
                                  if (open) {
                                    setEditingHoliday(h);
                                    setEditingHolidayName(h.name);
                                  } else {
                                    setEditingHoliday(null);
                                  }
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>แก้ไขชื่อวันหยุด</DialogTitle>
                                    <DialogDescription>
                                      ระบุชื่อวันหยุดสำหรับวันที่{" "}
                                      {new Date(h.date + "T00:00:00").toLocaleDateString("th-TH")}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-2">
                                    <Label>ชื่อวันหยุด</Label>
                                    <Input
                                      value={editingHolidayName}
                                      onChange={(e) => setEditingHolidayName(e.target.value)}
                                    />
                                    <Button onClick={handleRenameHoliday} className="w-full">บันทึก</Button>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <Button size="sm" variant="destructive" onClick={() => handleRemoveHoliday(h.date)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                    min={0}
                    step={5}
                    value={newTreatment.duration ?? ""}
                    onChange={(e) =>
                      setNewTreatment((p) => ({
                        ...p,
                        duration: e.target.value.trim() === "" ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="ระบุภายหลังได้"
                  />
                </div>
                <div>
                  <Label>ราคา (บาท)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newTreatment.price ?? ""}
                    onChange={(e) =>
                      setNewTreatment((p) => ({
                        ...p,
                        price: e.target.value.trim() === "" ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="ระบุภายหลังได้"
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
                      <TableCell>
                        {typeof treatment.duration === "number" ? `${treatment.duration} นาที` : "-"}
                      </TableCell>
                      <TableCell>
                        {typeof treatment.price === "number" ? `฿${treatment.price}` : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Dialog onOpenChange={(open) => !open && setEditingTreatment(null)}>
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
                                      value={editingTreatment.duration ?? ""}
                                      onChange={(e) =>
                                        setEditingTreatment((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                duration:
                                                  e.target.value.trim() === "" ? null : Number(e.target.value),
                                              }
                                            : prev
                                        )
                                      }
                                      placeholder="ปล่อยว่างได้"
                                    />
                                  </div>
                                  <div>
                                    <Label>ราคา (บาท)</Label>
                                    <Input
                                      type="number"
                                      value={editingTreatment.price ?? ""}
                                      onChange={(e) =>
                                        setEditingTreatment((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                price:
                                                  e.target.value.trim() === "" ? null : Number(e.target.value),
                                              }
                                            : prev
                                        )
                                      }
                                      placeholder="ปล่อยว่างได้"
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

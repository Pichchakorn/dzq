import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { db } from "../lib/firebase";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc
} from "firebase/firestore";

type Treatment = {
  docId?: string;
  id: string;              // slug/key เช่น "checkup"
  label: string;           // ชื่อที่แสดง เช่น "ขูดหินปูน"
  active: boolean;         // เปิดใช้งานให้จอง
  durationMin?: number | null;
  price?: number | null;
  order?: number | null;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function AdminTreatmentsPage() {
  const [items, setItems] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);

  // ฟอร์มเพิ่มใหม่
  const [label, setLabel] = useState("");
  const [id, setId] = useState("");
  const [active, setActive] = useState(true);
  const [durationMin, setDurationMin] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");
  const [order, setOrder] = useState<number | "">("");

  // โหลด realtime จาก collection "treatments"
  useEffect(() => {
    const ref = collection(db, "treatments");
    const q = query(ref, orderBy("order", "asc"));
    const unsub = onSnapshot(q,
      (snap) => {
        const arr: Treatment[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            docId: d.id,
            id: x.id,
            label: x.label,
            active: x.active ?? true,
            durationMin: x.durationMin ?? null,
            price: x.price ?? null,
            order: x.order ?? null,
          };
        });
        setItems(arr);
        setLoading(false);
      },
      (err) => {
        console.error("LOAD treatments ERROR:", err);
        setLoading(false);
        alert(err?.message || "โหลดข้อมูลไม่สำเร็จ");
      }
    );
    return unsub;
  }, []);

  // auto-generate id จาก label ถ้า id ยังว่าง
  useEffect(() => {
    if (label && !id) setId(slugify(label));
  }, [label]);

  const canAdd = useMemo(() => label.trim() && id.trim(), [label, id]);

  const resetForm = () => {
    setLabel("");
    setId("");
    setActive(true);
    setDurationMin("");
    setPrice("");
    setOrder("");
  };

  const addTreatment = async () => {
    if (!canAdd) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    // กัน id ซ้ำในฝั่ง client
    if (items.some((t) => t.id === id.trim())) {
      alert("รหัสบริการ (id) นี้มีอยู่แล้ว");
      return;
    }
    try {
      const payload: any = {
        id: id.trim(),
        label: label.trim(),
        active,
        durationMin: durationMin === "" ? null : Number(durationMin),
        price: price === "" ? null : Number(price),
        order: order === "" ? Date.now() : Number(order), // เรียงได้ทันที
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "treatments"), payload);
      console.log("added treatment id:", docRef.id, payload);
      resetForm();
    } catch (e: any) {
      console.error("ADD TREATMENT ERROR:", e);
      alert(e?.message || "เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const updateRow = async (row: Treatment, patch: Partial<Treatment>) => {
    // อัปเดต local ก่อน ให้ UX ลื่น
    setItems((prev) => prev.map((it) => (it.docId === row.docId ? { ...it, ...patch } : it)));
    try {
      await setDoc(
        doc(db, "treatments", row.docId!),
        {
          ...patch,
          durationMin: patch.durationMin === undefined
            ? row.durationMin ?? null
            : (patch.durationMin === null ? null : Number(patch.durationMin)),
          price: patch.price === undefined
            ? row.price ?? null
            : (patch.price === null ? null : Number(patch.price)),
          order: patch.order === undefined
            ? (row.order ?? null)
            : (patch.order === null ? null : Number(patch.order)),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e: any) {
      console.error("UPDATE TREATMENT ERROR:", e);
      alert(e?.message || "อัปเดตไม่สำเร็จ");
    }
  };

  const toggleActive = async (row: Treatment) => {
    await updateRow(row, { active: !row.active });
  };

  const removeRow = async (row: Treatment) => {
    if (!row.docId) return;
    if (!confirm(`ลบ "${row.label}" ?`)) return;
    try {
      await deleteDoc(doc(db, "treatments", row.docId));
    } catch (e: any) {
      console.error("DELETE TREATMENT ERROR:", e);
      alert(e?.message || "ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-6">
      {/* ฟอร์มเพิ่ม */}
      <Card>
        <CardHeader><CardTitle>ประเภทการรักษา</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <Label>ชื่อการรักษา</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น ขูดหินปูน" />
          </div>
          <div>
            <Label>รหัสบริการ (id)</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="เช่น checkup" />
          </div>
          <div>
            <Label>ระยะเวลา (นาที)</Label>
            <Input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="เช่น 30"
              min={0}
            />
          </div>
          <div>
            <Label>ราคา (บาท)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="เช่น 1200"
              min={0}
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>เปิดใช้งาน</Label>
            </div>
            <Button onClick={addTreatment} disabled={!canAdd}>+ เพิ่ม</Button>
          </div>
        </CardContent>
      </Card>

      {/* ตารางรายการ */}
      <Card>
        <CardHeader><CardTitle>รายการประเภทการรักษา</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">เปิด</th>
                    <th className="py-2 pr-3 w-24">ลำดับ</th>
                    <th className="py-2 pr-3 w-48">รหัส (id)</th>
                    <th className="py-2 pr-3">ชื่อบริการ</th>
                    <th className="py-2 pr-3 w-28">นาที</th>
                    <th className="py-2 pr-3 w-32">ราคา</th>
                    <th className="py-2 pr-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.docId} className="border-b">
                      <td className="py-2 pr-3">
                        <Switch checked={!!row.active} onCheckedChange={() => toggleActive(row)} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          value={row.order ?? ""}
                          onChange={(e) => updateRow(row, { order: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input value={row.id} onChange={(e) => updateRow(row, { id: e.target.value })} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input value={row.label} onChange={(e) => updateRow(row, { label: e.target.value })} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          value={row.durationMin ?? ""}
                          onChange={(e) => updateRow(row, { durationMin: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          value={row.price ?? ""}
                          onChange={(e) => updateRow(row, { price: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="destructive" size="sm" onClick={() => removeRow(row)}>ลบ</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

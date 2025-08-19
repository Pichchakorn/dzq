// src/components/ProfilePage.tsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { User as UserIcon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, updateUserProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    try {
      setLoading(true);
      await updateUserProfile({ name }); // ✅ อัปเดตได้เฉพาะ name
      toast.success("บันทึกโปรไฟล์สำเร็จ");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar (แสดงผลอย่างเดียว) */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>ชื่อที่แสดง</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>อีเมล</Label>
            <Input value={user?.email ?? ""} readOnly />
          </div>

          <Button onClick={save} disabled={loading}>
            {loading ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

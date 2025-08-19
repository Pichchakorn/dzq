// src/components/ProfilePage.tsx
import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Upload, User as UserIcon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, updateUserProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pid = user?.id ?? (user as any)?.uid ?? ""; // กันทั้ง id/uid

  const pick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pid) return;
    try {
      setLoading(true);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      // เปลี่ยนชื่อไฟล์ทุกครั้ง กันแคช
      const storageRef = ref(storage, `avatars/${pid}/${Date.now()}.${ext}`);
      await uploadBytes(storageRef, file);
      let url = await getDownloadURL(storageRef);
      // cache buster เผื่อ CDN/เบราว์เซอร์แคช
      url = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
      await updateUserProfile({ photoURL: url });
      toast.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
    } catch (err) {
      console.error(err);
      toast.error("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    try {
      setLoading(true);
      await updateUserProfile({ name });
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
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={pick} disabled={loading}>
                <Upload className="w-4 h-4 mr-1" />
                เปลี่ยนรูป
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
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

          <Button onClick={save} disabled={loading}>บันทึก</Button>
        </CardContent>
      </Card>
    </div>
  );
}

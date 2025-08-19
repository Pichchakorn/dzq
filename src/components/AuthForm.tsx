// src/components/AuthForm.tsx
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";
import "../styles/globals.css";

export function AuthForm() {
  const { login, register, isLoading } = useAuth();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    medicalRights: "",
    password: "",
    confirmPassword: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;

    if (!email || !password) return toast.error("กรุณากรอกอีเมลและรหัสผ่าน");

    try {
      // login ใน AuthContext คาดว่าเป็น (email, password) และอาจคืน void
      await login(email, password);
      toast.success("เข้าสู่ระบบสำเร็จ");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "อีเมล/รหัสผ่านไม่ถูกต้อง หรือยังไม่สมัครสมาชิก");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = registerForm.name.trim();
    const email = registerForm.email.trim().toLowerCase();
    const phone = registerForm.phone.trim();
    const dateOfBirth = registerForm.dateOfBirth;
    const medicalRights = registerForm.medicalRights.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!name || !email || !phone || !dateOfBirth || !medicalRights || !password) {
      return toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
    }
    if (!/^\d{9,10}$/.test(phone)) return toast.error("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง");
    if (password.length < 6) return toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (password !== confirmPassword) return toast.error("รหัสผ่านไม่ตรงกัน");

    try {
      // จาก error ในภาพ: register คาดว่าเป็น (email, password, name)
      await register(email, password, name);
      // NOTE: ถ้าต้องการบันทึก phone/dateOfBirth/medicalRights ให้ทำต่อใน AuthContext หลังสมัครสำเร็จ
      toast.success("สมัครสมาชิกสำเร็จ");
      setRegisterForm({
        name: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        medicalRights: "",
        password: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "สมัครสมาชิกไม่สำเร็จ");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">DZQ</h1>
          <p className="text-gray-600">ระบบจองคิวทันตกรรม</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">เข้าสู่ระบบ</TabsTrigger>
            <TabsTrigger value="register">สมัครสมาชิก</TabsTrigger>
          </TabsList>

          {/* Login */}
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>เข้าสู่ระบบ</CardTitle>
                <CardDescription>กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">รหัสผ่าน</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    เข้าสู่ระบบ
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Register */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>สมัครสมาชิก</CardTitle>
                <CardDescription>กรอกข้อมูลของคุณเพื่อสมัครสมาชิกใหม่</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                    <Input
                      id="name"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, name: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">อีเมล</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                    <Input
                      id="phone"
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="ตัวอย่าง: 0812345678"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, phone: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dob">วันเกิด</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={registerForm.dateOfBirth}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medical-rights">สิทธิ์การรักษา</Label>
                    <Input
                      id="medical-rights"
                      placeholder="เช่น ประกันสังคม / ข้าราชการ / จ่ายเอง"
                      value={registerForm.medicalRights}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, medicalRights: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">รหัสผ่าน</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">ยืนยันรหัสผ่าน</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    สมัครสมาชิก
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

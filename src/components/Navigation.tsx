import React from "react";
import { Button } from "./ui/button";
import {
  Home,
  Calendar,
  History,
  Bell,
  User as UserIcon,
  LogOut,
  Stethoscope,
  Settings,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAppointments } from "../contexts/AppointmentContext"; 

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  /** ไม่จำเป็นต้องส่งมาก็ได้ ถ้าไม่ส่งจะอ่านจาก context */
  isAdmin?: boolean;
}

type IconType = React.ComponentType<{ className?: string }>;
interface MenuItem {
  id: string;
  label: string;
  icon: IconType;
}

export function Navigation({
  currentPage,
  onNavigate,
  isAdmin,
}: NavigationProps) {
  const { user, logout, isAdmin: ctxIsAdmin } = useAuth();
  const { clinicSettings } = useAppointments(); // เพิ่มบรรทัดนี้
  const info = clinicSettings?.clinicInfo;      // เพิ่มบรรทัดนี้
  const admin = typeof isAdmin === "boolean" ? isAdmin : ctxIsAdmin;

  const patientMenuItems: MenuItem[] = [
    { id: "dashboard", label: "หน้าหลัก", icon: Home },
    { id: "booking", label: "จองคิว", icon: Calendar },
    { id: "history", label: "ประวัติ", icon: History },
    { id: "notifications", label: "แจ้งเตือน", icon: Bell },
    { id: "profile", label: "ข้อมูลส่วนตัว", icon: UserIcon },
  ];

  // สำหรับ admin ให้ id ตรงกับ App.tsx
  const adminMenuItems: MenuItem[] = [
    { id: "doctor_dashboard", label: "จัดการคิว", icon: Home },
    { id: "settings", label: "ตั้งค่า", icon: Settings },
  ];

  const menuItems: MenuItem[] = admin ? adminMenuItems : patientMenuItems;

  const handleNavigate = (id: string) => {
    if (id !== currentPage) onNavigate(id);
  };

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">DZQ</h1>
            <p className="text-sm text-gray-600">Dentizo Queue</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-5 h-5 text-gray-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || "ไม่ระบุชื่อ"}
            </p>
            <p className="text-xs text-gray-500">
              {admin ? "ผู้ดูแล/แพทย์" : "ผู้ป่วย"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              variant={isActive ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => handleNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          ออกจากระบบ
        </Button>
      </div>
       {/* Clinic Contact */}
      {info && (
        <div className="p-4 border-t border-gray-200 text-xs text-gray-600">
          <div className="font-bold mb-1">ติดต่อคลินิก</div>
          <div>ชื่อ: {info.name}</div>
          <div>โทร: {info.phone}</div>
          <div>อีเมล: {info.email}</div>
          <div>ที่อยู่: {info.address}</div>
        </div>
      )}
    </aside>
  );
}

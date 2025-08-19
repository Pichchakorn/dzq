// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FbUser,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

type Role = "admin" | "patient";

export type AppUser = {
  id: string;
  email: string;
  name?: string;
  photoURL?: string;
  role: Role;
};

type RegisterObj = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  medicalRights?: string;
};

type Ctx = {
  user: AppUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: {
    (email: string, password: string, name: string): Promise<boolean>;
    (payload: RegisterObj): Promise<boolean>;
  };
  logout: () => Promise<void>;
  updateUserProfile: (patch: Partial<AppUser>) => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

/** ---- Admin whitelist (comma separated) from .env ----
 *  VITE_ADMIN_EMAILS=admin@your.com,owner@domain.com
 */
// อ่านได้ทั้งสอง prefix
/// <reference types="vite/client" />
// --- whitelist จาก .env (รองรับทั้ง Vite และ CRA) ---
// --- ไวท์ลิสต์อีเมลแอดมินจาก .env ---
const ADMIN_EMAILS_RAW =
  (import.meta as any).env?.VITE_ADMIN_EMAILS ||
  (process.env as any).REACT_APP_ADMIN_EMAIL || "";   // รองรับ CRA

const ADMIN_EMAILS = ADMIN_EMAILS_RAW
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

// โหลด user ทุกครั้งที่ auth เปลี่ยน และกำหนด role
async function loadUser(fb: FbUser): Promise<AppUser> {
  const uid = fb.uid;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  const email = (fb.email || "").trim().toLowerCase();
  const inWhitelist = ADMIN_EMAILS.includes(email);

  if (!snap.exists()) {
    const base: AppUser = {
      id: uid,
      email,
      name: fb.displayName || "",
      photoURL: fb.photoURL || "",
      role: inWhitelist ? "admin" : "patient",
    };
    await setDoc(ref, base, { merge: true });
    return base;
  }

  const data = snap.data() as Partial<AppUser>;
  return {
    id: uid,
    email,
    name: data.name ?? fb.displayName ?? "",
    photoURL: data.photoURL ?? fb.photoURL ?? "",
    role: inWhitelist ? "admin" : (data.role as Role) || "patient",
  };
}



export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (fb) => {
      try {
        if (!fb) {
          setUser(null);
          return;
        }
        const u = await loadUser(fb);
        setUser(u);
      } finally {
        setIsLoading(false);
      }
    });
    return () => off();
  }, []);

  const login: Ctx["login"] = async (email, password) => {
    setIsLoading(true);
    try {
      const { user: fb } = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      const u = await loadUser(fb);
      setUser(u);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // overloads
  async function registerImpl(email: string, password: string, name: string): Promise<boolean>;
  async function registerImpl(payload: RegisterObj): Promise<boolean>;
  async function registerImpl(a: string | RegisterObj, b?: string, c?: string): Promise<boolean> {
    const form: RegisterObj =
      typeof a === "string"
        ? { email: a.trim().toLowerCase(), password: b || "", name: c || "" }
        : { ...a, email: a.email.trim().toLowerCase() };

    setIsLoading(true);
    try {
      const { user: fb } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      if (form.name) await updateProfile(fb, { displayName: form.name });

      // ตั้ง role ตั้งแต่แรก (whitelist มีสิทธิ์สูงสุด)
      const role: Role = ADMIN_EMAILS.includes(form.email) ? "admin" : "patient";
      await setDoc(doc(db, "users", fb.uid), {
        id: fb.uid,
        email: form.email,
        name: form.name ?? "",
        photoURL: fb.photoURL ?? "",
        role,
        phone: form.phone ?? "",
        dateOfBirth: form.dateOfBirth ?? "",
        medicalRights: form.medicalRights ?? "",
      });

      const u = await loadUser(fb);
      setUser(u);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const updateUserProfile: Ctx["updateUserProfile"] = async (patch) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.id), patch as any);
    setUser({ ...user, ...patch });
  };

  const value: Ctx = {
    user,
    isAdmin: !!(user && user.role === "admin"),
    isLoading,
    login,
    register: registerImpl,
    logout,
    updateUserProfile,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

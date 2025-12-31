"use server";

import { createClient } from "./server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type AuthError = {
  message: string;
  status?: number;
};

export type AuthResult = {
  error?: AuthError;
  success?: boolean;
};

export async function signUp(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || !password) {
    return { error: { message: "Email and password are required" } };
  }

  if (password.length < 6) {
    return { error: { message: "Password must be at least 6 characters" } };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: { message: error.message, status: error.status } };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: { message: "Email and password are required" } };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: { message: error.message, status: error.status } };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

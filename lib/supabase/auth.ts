"use server";

import { createClient } from "./server";
import { revalidatePath } from "next/cache";
import { loginSchema, signupSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

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

  const formValues = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  // Server-side validation
  try {
    signupSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed"
        }
      };
    }
  }

  const { error } = await supabase.auth.signUp({
    email: formValues.email,
    password: formValues.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kakamalem.com'}/callback?type=signup`,
      data: {
        full_name: formValues.fullName,
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

  const formValues = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Server-side validation
  try {
    loginSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed"
        }
      };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: formValues.email,
    password: formValues.password,
  });

  if (error) {
    return { error: { message: error.message, status: error.status } };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signOut(): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: { message: error.message, status: error.status } };
  }

  revalidatePath("/", "layout");
  return { success: true };
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

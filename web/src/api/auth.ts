import { request } from "./client";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

interface UserResponse {
  user: User;
}

export async function fetchMe(): Promise<User> {
  return (await request<UserResponse>("/auth/me")).user;
}

export async function login(email: string, password: string): Promise<User> {
  return (await request<UserResponse>("/auth/login", { method: "POST", body: { email, password } })).user;
}

export async function register(email: string, password: string, displayName: string): Promise<User> {
  return (
    await request<UserResponse>("/auth/register", {
      method: "POST",
      body: { email, password, displayName },
    })
  ).user;
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

import { getUser } from "./storage";

export async function getSession() {
  return getUser();
}

export async function getProfile() {
  const session = await getSession();
  return session?.user || session || null;
}

export async function getAuthToken() {
  const session = await getSession();
  return session?.token || "";
}

export async function getRole() {
  const profile = await getProfile();
  return profile?.role || "user";
}

export const withAuth = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

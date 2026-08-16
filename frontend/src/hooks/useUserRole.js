import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";

export const useUserRole = () => {
  const { user } = useUser();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();
  
  const API_URL = import.meta.env.VITE_API_BASE_URL;
const fetchUserRole = useCallback(async () => {
  if (!user) { setLoading(false); return; }
  try {
    const token = await getToken(); // ✅ get Clerk JWT token
    const response = await fetch(`${API_URL}/user/role`, {
      headers: {
        Authorization: `Bearer ${token}` // ✅ send it
      },
      credentials: 'include'
    });
    const data = await response.json();
    setUserRole(data.role || "user");
  } catch (error) {
    console.error("Error fetching role:", error);
    setUserRole("user");
  } finally {
    setLoading(false);
  }
}, [user, getToken]);

  useEffect(() => {
    fetchUserRole();

    // ── Refetch every 30 seconds ──
    const interval = setInterval(fetchUserRole, 30000);

    // ── Refetch when user comes back to tab ──
    const handleFocus = () => fetchUserRole();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchUserRole]);

  return {
    userRole,
    loading,
    isHR: userRole === "hr" || userRole === "admin",
    isAdmin: userRole === "admin",
    refetch: fetchUserRole  // expose manual refetch if needed
  };
};
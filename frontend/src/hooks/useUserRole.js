import { useUser } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";

export const useUserRole = () => {
  const { user } = useUser();
  const [userRole, setUserRole] = useState("user");
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const response = await fetch("https://talent-talk.onrender.com/api/user/role", {
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
  }, [user]);

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
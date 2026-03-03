// hooks/useUserRole.js - UPDATED WITH CORRECT PORT
import { useUser } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

export const useUserRole = () => {
  const { user } = useUser();
  const [userRole, setUserRole] = useState("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          console.log("Fetching role for user:", user.id); // DEBUG
          const response = await fetch("https://talent-talk.onrender.com/api/user/role", {
            credentials: 'include' // Important for cookies/sessions
          });
          const data = await response.json();
          console.log("Role API response:", data); // DEBUG
          setUserRole(data.role || "user");
        } catch (error) {
          console.error("Error fetching role:", error); // DEBUG
          setUserRole("user");
        }
      }
      setLoading(false);
    };

    fetchUserRole();
  }, [user]);

  console.log("Hook returning:", { userRole, loading, isHR: userRole === "hr" || userRole === "admin" }); // DEBUG

  return {
    userRole,
    loading,
    isHR: userRole === "hr" || userRole === "admin",
    isAdmin: userRole === "admin"
  };
};

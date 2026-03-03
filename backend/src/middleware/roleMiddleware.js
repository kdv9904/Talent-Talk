// middleware/roleMiddleware.js
export const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // From your existing protectRoute middleware
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ 
          message: "Insufficient permissions",
          required: roles,
          current: user.role
        });
      }
      
      next();
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

// Shortcut middlewares
export const requireAdmin = requireRole(["admin"]);
export const requireHR = requireRole(["admin", "hr"]); // HR can do what admins can do
export const requireUser = requireRole(["user", "admin", "hr"]);

// Check if user can bypass tab switching restrictions
export const canBypassTabRestrictions = (user) => {
  return ["admin", "hr"].includes(user.role); // HR can bypass tab restrictions
};

// Check if user can manage other users (HR and Admin)
export const canManageUsers = (user) => {
  return ["admin", "hr"].includes(user.role);
};
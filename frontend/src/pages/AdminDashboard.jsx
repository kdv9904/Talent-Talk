import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useUserRole } from "../hooks/useUserRole";
import Navbar from "../components/Navbar";
import { Users, Shield, UserCheck, UserX, Loader2, Search } from "lucide-react";

function AdminDashboard() {
  const { user } = useUser();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUser, setUpdatingUser] = useState(null);

  // Use the correct API URL with port 4000
  const API_URL = "https://talent-talk.onrender.com";

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_URL}/api/admin/users`, {
          credentials: 'include' // Important for cookies/auth
        });
        
        console.log("Response status:", response.status); // Debug
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Fetched users:", data); // Debug log
        setUsers(data.users || []);
      } catch (error) {
        console.error("Error fetching users:", error);
        alert(`Failed to fetch users: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // Update user role
  const updateUserRole = async (userId, newRole) => {
    setUpdatingUser(userId);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });

      if (response.ok) {
        // Update local state
        setUsers(users.map(user => 
          user._id === userId ? { ...user, role: newRole } : user
        ));
      } else {
        const errorData = await response.json();
        alert(`Failed to update user role: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error updating user role:", error);
      alert("Error updating user role");
    } finally {
      setUpdatingUser(null);
    }
  };

  // ... rest of your component remains the same

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { color: "badge-error", icon: Shield },
      hr: { color: "badge-warning", icon: UserCheck },
      user: { color: "badge-info", icon: UserX }
    };
    
    const config = roleConfig[role] || roleConfig.user;
    const IconComponent = config.icon;
    
    return (
      <span className={`badge badge-lg ${config.color} gap-1`}>
        <IconComponent className="w-3 h-3" />
        {role.toUpperCase()}
      </span>
    );
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-base-300 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />
      
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-base-content mb-2">
            Admin Dashboard
          </h1>
          <p className="text-base-content/60">
            Manage user roles and permissions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{users.length}</h3>
                  <p className="text-base-content/60">Total Users</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div className="bg-warning/10 p-3 rounded-xl">
                  <UserCheck className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    {users.filter(u => u.role === 'hr').length}
                  </h3>
                  <p className="text-base-content/60">HR Users</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div className="bg-error/10 p-3 rounded-xl">
                  <Shield className="w-6 h-6 text-error" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    {users.filter(u => u.role === 'admin').length}
                  </h3>
                  <p className="text-base-content/60">Admins</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <div className="flex justify-between items-center mb-6">
              <h2 className="card-title">User Management</h2>
              
              {/* Search */}
              <div className="form-control">
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="input input-bordered"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="btn btn-square">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Current Role</th>
                    <th>Change Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-10 h-10 rounded-full">
                              <img
                                src={user.profileImage || "/default-avatar.png"}
                                alt={user.name}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="font-bold">{user.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>{getRoleBadge(user.role)}</td>
                      <td>
                        <div className="flex gap-2">
                          <select
                            className="select select-bordered select-sm"
                            value={user.role}
                            onChange={(e) => updateUserRole(user._id, e.target.value)}
                            disabled={updatingUser === user._id}
                          >
                            <option value="user">User</option>
                            <option value="hr">HR</option>
                            <option value="admin">Admin</option>
                          </select>
                          {updatingUser === user._id && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                        </div>
                      </td>
                      <td>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-base-content/60">
                  {users.length === 0 ? "No users found in database" : "No users match your search"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

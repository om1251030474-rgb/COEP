import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, UserPlus, UserX } from "lucide-react";

export default function AdminUsers() {
  const { user, isSuperAdmin, addUser, removeUser, setUserRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");

  useEffect(() => {
    if (!isSuperAdmin) return;
    const stored = JSON.parse(localStorage.getItem("droneguard_users") || "[]");
    setUsers(stored);
  }, [isSuperAdmin]);

  const refreshUsers = () => {
    const stored = JSON.parse(localStorage.getItem("droneguard_users") || "[]");
    setUsers(stored);
  };

  const handleAddUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast.error("Please enter name, email, and password.");
      return;
    }

    try {
      await addUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      toast.success("User added");
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("user");
      refreshUsers();
    } catch (err) {
      toast.error(err?.message || "Failed to add user");
    }
  };

  const handleRemove = async (email) => {
    try {
      await removeUser(email);
      toast.success("User removed");
      refreshUsers();
    } catch (err) {
      toast.error(err?.message || "Failed to remove user");
    }
  };

  const handleRoleChange = async (email, role) => {
    try {
      await setUserRole(email, role);
      toast.success("Role updated");
      refreshUsers();
    } catch (err) {
      toast.error(err?.message || "Failed to update role");
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black">Admin user management</h1>
            <p className="text-slate-400 mt-1">
              Only the main super-admin can add/remove admins.
            </p>
          </div>
          <div className="text-sm text-slate-400">
            Logged in as: <span className="font-semibold">{user?.email}</span>
          </div>
        </div>

        <div className="glass-panel p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Add new user</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Input
              placeholder="Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Role</span>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddUser} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add user
            </Button>
          </div>
        </div>

        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold mb-4">Existing users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wide">
                  <th className="py-2">Email</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} className="border-t border-white/10">
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{u.name}</td>
                    <td className="py-2">
                      {u.isSuperAdmin ? (
                        <span className="text-emerald-400 font-semibold">
                          Super Admin
                        </span>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(value) =>
                            handleRoleChange(u.email, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="py-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemove(u.email)}
                        disabled={u.isSuperAdmin}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

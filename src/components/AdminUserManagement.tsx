import React, { useState } from 'react';
import { 
  Users, Shield, Check, X, UserPlus, Key, Award, 
  CheckCircle2, AlertCircle, RefreshCw 
} from 'lucide-react';
import { User, UserRole } from '../types';
import { LocalClinicalStorage } from '../services/storage';

interface AdminUserManagementProps {
  currentUser: User | null;
  onRoleChanged: (userId: string, newRole: UserRole) => void;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  currentUser,
  onRoleChanged,
}) => {
  const [users, setUsers] = useState<User[]>(() => LocalClinicalStorage.getUsers());
  const [successNotice, setSuccessNotice] = useState<string>('');

  const handleRoleSelect = (targetUserId: string, targetRole: UserRole) => {
    // Only super_admin or admin can change roles
    if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin') {
      alert('Access Denied: Only Administrator or Super Admin can modify system roles.');
      return;
    }

    const updated = users.map(u => u.id === targetUserId ? { ...u, role: targetRole } : u);
    setUsers(updated);
    LocalClinicalStorage.setUsers(updated);
    onRoleChanged(targetUserId, targetRole);

    LocalClinicalStorage.logAuditAction(
      currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : { id: 'admin-1', name: 'Dr. Kabir Rao', role: 'super_admin' },
      'USER_ROLE_CHANGED',
      targetUserId,
      `Changed user role to ${targetRole} under SIH RBAC security governance.`
    );

    setSuccessNotice(`Role updated for user ${targetUserId} to ${targetRole}.`);
    setTimeout(() => setSuccessNotice(''), 3000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="admin-user-container">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">
            SECURITY GOVERNANCE
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
          Role-Based Access Control (RBAC)
        </h2>
        <p className="text-xs font-mono text-slate-400 mt-1">
          Segregation of duties across Super Admin, Hospital Admin, Physician, Receptionist, and Emergency Patient.
        </p>
      </div>

      {successNotice && (
        <div className="bg-green-950/30 border border-green-800/60 text-green-300 text-xs p-3.5 rounded-lg flex items-center space-x-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* RBAC Matrix */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white tracking-tight mb-3">
          Permission Authorization Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-[10px] font-mono text-slate-400 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">System Role</th>
                <th className="py-2.5 px-3">Emergency Hotline</th>
                <th className="py-2.5 px-3">Intake / Register</th>
                <th className="py-2.5 px-3">Convert Shell</th>
                <th className="py-2.5 px-3">Doctor Clinical Form</th>
                <th className="py-2.5 px-3">Audit Trails</th>
                <th className="py-2.5 px-3">Manage Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              <tr>
                <td className="py-2.5 px-3 font-sans font-semibold text-red-400">Super Admin</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Read/Export</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-sans font-semibold text-amber-400">Admin</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Read</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Restricted</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-sans font-semibold text-blue-400">Doctor</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Read Only</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Write/Approve</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Logged Only</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-sans font-semibold text-purple-400">Receptionist</td>
                <td className="py-2.5 px-3 text-green-400">✓ Full</td>
                <td className="py-2.5 px-3 text-green-400">✓ Write</td>
                <td className="py-2.5 px-3 text-green-400">✓ Convert</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Logged Only</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-sans font-semibold text-slate-400">Patient</td>
                <td className="py-2.5 px-3 text-green-400">✓ SOS Open</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
                <td className="py-2.5 px-3 text-slate-600">✗ Denied</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* User Directory */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white tracking-tight mb-3">
          Hospital Authorized Users Directory
        </h3>
        <div className="space-y-3">
          {users.map(u => (
            <div
              key={u.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-lg border border-slate-800"
            >
              <div>
                <div className="font-medium text-white text-xs flex items-center space-x-2">
                  <span>{u.name}</span>
                  {u.id === currentUser?.id && (
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/60">
                      You (Active)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {u.email} • ID: {u.id}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">Role:</span>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleSelect(u.id, e.target.value as UserRole)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white capitalize font-mono focus:border-slate-700 outline-none"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="patient">Patient</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

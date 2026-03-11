import React, { useState } from 'react';
import { User, Branch } from '../types';
import { X, Plus, Trash2, Save, AlertCircle } from 'lucide-react';

interface AdminSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  branches: Branch[];
  onSaveUsers: (users: User[]) => void;
  onSaveBranches: (branches: Branch[]) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  isOpen,
  onClose,
  users: initialUsers,
  branches: initialBranches,
  onSaveUsers,
  onSaveBranches,
}) => {
  const [activeTab, setActiveTab] = useState<'branches' | 'users'>('branches');
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [branches, setBranches] = useState<Branch[]>(initialBranches);

  React.useEffect(() => {
    if (isOpen) {
      setUsers(initialUsers);
      setBranches(initialBranches);
    }
  }, [isOpen, initialUsers, initialBranches]);

  if (!isOpen) return null;

  const handleAddBranch = () => {
    const newBranch: Branch = {
      id: Date.now().toString(),
      name: '',
      spreadsheetId: '',
    };
    setBranches([...branches, newBranch]);
  };

  const handleUpdateBranch = (id: string, field: keyof Branch, value: string) => {
    setBranches(branches.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleDeleteBranch = (id: string) => {
    setBranches(branches.filter(b => b.id !== id));
    // Remove branch from users
    setUsers(users.map(u => ({
      ...u,
      branchIds: u.branchIds.filter(bid => bid !== id)
    })));
  };

  const handleAddUser = () => {
    const newUser: User = {
      id: Date.now().toString(),
      username: '',
      password: '',
      role: 'user',
      branchIds: [],
    };
    setUsers([...users, newUser]);
  };

  const handleUpdateUser = (id: string, field: keyof User, value: any) => {
    setUsers(users.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  const handleToggleUserBranch = (userId: string, branchId: string) => {
    setUsers(users.map(u => {
      if (u.id === userId) {
        const hasBranch = u.branchIds.includes(branchId);
        const newBranchIds = hasBranch 
          ? u.branchIds.filter(id => id !== branchId)
          : [...u.branchIds, branchId];
        return { ...u, branchIds: newBranchIds };
      }
      return u;
    }));
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  const handleSave = () => {
    onSaveBranches(branches);
    onSaveUsers(users);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Pengaturan Admin</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-6">
          <button
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'branches' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('branches')}
          >
            Kelola Cabang
          </button>
          <button
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('users')}
          >
            Kelola Pengguna
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {activeTab === 'branches' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-600">Sangat disarankan 1 Spreadsheet per Cabang untuk performa terbaik.</p>
                <button 
                  onClick={handleAddBranch}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Tambah Cabang
                </button>
              </div>

              {branches.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
                  Belum ada cabang. Silakan tambah cabang baru.
                </div>
              ) : (
                <div className="space-y-4">
                  {branches.map((branch, index) => (
                    <div key={branch.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-start">
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Nama Cabang</label>
                          <input
                            type="text"
                            value={branch.name}
                            onChange={(e) => handleUpdateBranch(branch.id, 'name', e.target.value)}
                            placeholder="Contoh: Cabang Jakarta Pusat"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Spreadsheet ID</label>
                          <input
                            type="text"
                            value={branch.spreadsheetId}
                            onChange={(e) => handleUpdateBranch(branch.id, 'spreadsheetId', e.target.value)}
                            placeholder="Contoh: 1BxiMVs0XRYFgwnLEUK..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-6"
                        title="Hapus Cabang"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-600">Kelola akses pengguna dan cabang yang ditugaskan.</p>
                <button 
                  onClick={handleAddUser}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Tambah Pengguna
                </button>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
                  Belum ada pengguna.
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-start">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
                            <input
                              type="text"
                              value={user.username}
                              onChange={(e) => handleUpdateUser(user.id, 'username', e.target.value)}
                              disabled={user.id === '1'}
                              className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm ${user.id === '1' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
                            <input
                              type="text"
                              value={user.password}
                              onChange={(e) => handleUpdateUser(user.id, 'password', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateUser(user.id, 'role', e.target.value as 'admin' | 'user')}
                              disabled={user.id === '1'}
                              className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm ${user.id === '1' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-2">Akses Cabang</label>
                          {user.role === 'admin' ? (
                            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                              <p>Admin memiliki akses ke semua cabang secara otomatis.</p>
                            </div>
                          ) : branches.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Belum ada cabang yang dibuat.</p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                              {branches.map(branch => (
                                <label key={branch.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={user.branchIds.includes(branch.id)}
                                    onChange={() => handleToggleUserBranch(user.id, branch.id)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm text-slate-700">{branch.name || 'Cabang Tanpa Nama'}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className={`p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-6 ${user.id === '1' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Hapus Pengguna"
                        disabled={user.id === '1'} // Prevent deleting main admin
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            <Save className="w-4 h-4" /> Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};

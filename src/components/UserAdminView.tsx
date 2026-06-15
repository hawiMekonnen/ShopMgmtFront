import React, { useEffect, useState } from "react";
import { 
  Users, 
  ChevronDown, 
  ChevronRight, 
  KeyRound, 
  FileText, 
  Building, 
  UserCheck, 
  Printer, 
  Search, 
  Mail,
  Shield,
  Briefcase
} from "lucide-react";
import { api } from "../client";
import { AuthSession, MaterialRequest, ViewState } from "../types";

interface UserAdminViewProps {
  session: AuthSession;
  onNavigate: (view: ViewState) => void;
  executeApiCall: <T,>(call: () => Promise<T>) => Promise<T | null>;
}

interface UserListItem {
  userId: number;
  loginId: string;
  name: string;
  email: string;
  role: string;
  shopId?: number;
  managerId?: number;
  departmentId?: number;
  departmentName?: string;
}

interface DepartmentGroup {
  departmentId: number;
  name: string;
  category: string;
}

export default function UserAdminView({ session, onNavigate, executeApiCall }: UserAdminViewProps) {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Tree expansion state
  const [expandedDepts, setExpandedDepts] = useState<Record<number, boolean>>({});
  const [expandedManagers, setExpandedManagers] = useState<Record<number, boolean>>({});

  // Reset password state
  const [selectedResetUser, setSelectedResetUser] = useState<UserListItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // Selected Scope for Reports
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [selectedDept, setSelectedDept] = useState<DepartmentGroup | null>(null);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [allUsers, allDeptsGrouped] = await Promise.all([
      executeApiCall(() => api.getAllUsers()),
      executeApiCall(() => api.getDepartments())
    ]);
    
    if (allUsers) setUsers(allUsers);
    
    if (allDeptsGrouped) {
      // The API returns DepartmentGroupDto[] (grouped by Category)
      // We need to flatten it to a list of DepartmentDto objects
      const flatDepts = allDeptsGrouped.flatMap((group: any) => group.departments || []);
      setDepartments(flatDepts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch material requests order history when selecting a user or department
  useEffect(() => {
    const fetchReport = async () => {
      setLoadingReport(true);
      const deptId = selectedDept?.departmentId;
      const userId = selectedUser?.userId;
      const data = await executeApiCall(() => 
        api.getMaterialRequests(undefined, undefined, deptId, userId)
      );
      if (data) setRequests(data);
      setLoadingReport(false);
    };

    if (selectedUser || selectedDept) {
      fetchReport();
    }
  }, [selectedUser, selectedDept]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResetUser || !newPassword.trim()) return;

    const success = await executeApiCall(() => 
      api.resetUserPassword(selectedResetUser.userId, newPassword)
    );

    if (success !== null) {
      setResetSuccess(true);
      setNewPassword("");
      setTimeout(() => {
        setResetSuccess(false);
        setSelectedResetUser(null);
      }, 2000);
    }
  };

  const toggleDept = (deptId: number) => {
    setExpandedDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  const toggleManager = (mgrId: number) => {
    setExpandedManagers(prev => ({ ...prev, [mgrId]: !prev[mgrId] }));
  };

  const handlePrint = () => {
    window.print();
  };

  // Filters
  const filteredUsers = searchQuery.trim() === "" 
    ? users 
    : users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.loginId.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Users without any department assigned
  const unassignedUsers = users.filter(u => !u.departmentId);

  return (
    <div className="space-y-6">
      {/* Print-only Container: User Profile & Order History */}
      <div className="hidden print:block bg-white p-8 space-y-6 text-black">
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide">Airline Store Management System</h1>
          <p className="text-sm text-slate-600 mt-1">Official User Account Profile & Order Audit</p>
          <p className="text-xs text-slate-400 mt-0.5">Date Generated: {new Date().toLocaleString()}</p>
        </div>

        {selectedUser ? (
          <div className="space-y-6">
            <div className="border border-slate-300 rounded p-4 bg-slate-50 space-y-2 text-xs">
              <h3 className="text-sm font-bold uppercase border-b border-slate-200 pb-1">User Account Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-semibold text-slate-500">Full Name:</span> {selectedUser.name}</div>
                <div><span className="font-semibold text-slate-500">Employee ID:</span> {selectedUser.loginId}</div>
                <div><span className="font-semibold text-slate-500">Email Address:</span> {selectedUser.email}</div>
                <div><span className="font-semibold text-slate-500">System Role:</span> {selectedUser.role}</div>
                <div><span className="font-semibold text-slate-500">Department:</span> {selectedUser.departmentName || "None"}</div>
                <div><span className="font-semibold text-slate-500">User ID:</span> {selectedUser.userId}</div>
              </div>
            </div>

            <h3 className="text-sm font-bold border-b border-slate-300 pb-1 mt-6">Material Order History</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-400 font-bold bg-slate-100">
                  <th className="py-2 px-3">Req ID</th>
                  <th className="py-2 px-3">Material Name</th>
                  <th className="py-2 px-3">Part No</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Date Ordered</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">No requests found for this user.</td>
                  </tr>
                ) : (
                  requests.map(r => (
                    <tr key={`print-req-${r.requestId}`} className="border-b border-slate-200">
                      <td className="py-2 px-3 font-mono">#{r.requestId}</td>
                      <td className="py-2 px-3 font-medium">{r.materialName}</td>
                      <td className="py-2 px-3 font-mono">{r.partNumber}</td>
                      <td className="py-2 px-3 text-right">{r.quantity}</td>
                      <td className="py-2 px-3">{r.status}</td>
                      <td className="py-2 px-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : selectedDept ? (
          <div>
            <div className="border border-slate-300 rounded p-4 bg-slate-50 text-xs">
              <h3 className="text-sm font-bold uppercase border-b border-slate-200 pb-1">Department Scope</h3>
              <p className="mt-1"><span className="font-semibold text-slate-500">Department Name:</span> {selectedDept.name}</p>
              <p><span className="font-semibold text-slate-500">Category:</span> {selectedDept.category}</p>
            </div>

            <h3 className="text-sm font-bold border-b border-slate-300 pb-1 mt-6">Department Material Order History</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-400 font-bold bg-slate-100">
                  <th className="py-2 px-3">Req ID</th>
                  <th className="py-2 px-3">Requested By</th>
                  <th className="py-2 px-3">Material Name</th>
                  <th className="py-2 px-3">Part No</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Date Ordered</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">No requests found for this department.</td>
                  </tr>
                ) : (
                  requests.map(r => (
                    <tr key={`print-dept-req-${r.requestId}`} className="border-b border-slate-200">
                      <td className="py-2 px-3 font-mono">#{r.requestId}</td>
                      <td className="py-2 px-3">{r.requestedByName}</td>
                      <td className="py-2 px-3 font-medium">{r.materialName}</td>
                      <td className="py-2 px-3 font-mono">{r.partNumber}</td>
                      <td className="py-2 px-3 text-right">{r.quantity}</td>
                      <td className="py-2 px-3">{r.status}</td>
                      <td className="py-2 px-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">No user profile selected.</p>
        )}

        <div className="mt-12 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-4">
          <p>CONFIDENTIAL — INTERNAL AIRLINE STORES USE ONLY</p>
        </div>
      </div>

      {/* Screen Interface */}
      <div className="flex flex-col lg:flex-row gap-6 print:hidden">
        {/* Left Side: Hierarchy tree */}
        <div className="w-full lg:w-1/2 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">System Users Directory</h3>
            <p className="text-xs text-slate-500 mt-0.5">Explore by department, manager, and employee hierarchies.</p>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search user by name or Login ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#006039]"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading directory...</div>
            ) : searchQuery.trim() !== "" ? (
              // Flat search view
              <div className="space-y-1">
                {filteredUsers.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-4">No users match search.</div>
                ) : (
                  filteredUsers.map(u => (
                    <div key={`search-user-${u.userId}`} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg border border-slate-100">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.25 rounded">{u.loginId}</span>
                          <span>•</span>
                          <span className="font-medium text-emerald-800">{u.role}</span>
                          {u.departmentName && (
                            <>
                              <span>•</span>
                              <span>{u.departmentName}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedUser(u); setSelectedDept(null); }}
                          className="p-1.5 text-slate-600 hover:text-[#006039] hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          title="Generate Reports"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedResetUser(u)}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              // Hierarchy view
              <div className="space-y-3">
                {/* Department Groupings */}
                {departments.map(dept => {
                  const deptUsers = users.filter(u => u.departmentId === dept.departmentId);
                  const isDeptExpanded = expandedDepts[dept.departmentId];

                  // Managers in this department
                  const deptManagers = deptUsers.filter(u => u.role === "Manager");
                  // Employees with no manager or manager not in list
                  const directEmployees = deptUsers.filter(
                    u => u.role === "Employee" && (!u.managerId || !deptManagers.some(m => m.userId === u.managerId))
                  );
                  // Others (Procurement/Finance/Admins)
                  const otherDeptUsers = deptUsers.filter(u => u.role !== "Manager" && u.role !== "Employee");

                  return (
                    <div key={`dept-container-${dept.departmentId}`} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div 
                        onClick={() => toggleDept(dept.departmentId)}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-emerald-800" />
                          <span className="text-sm font-bold text-slate-700">{dept.name}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-semibold">
                            {deptUsers.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedDept(dept); setSelectedUser(null); }}
                            className="p-1 text-slate-600 hover:text-[#006039] hover:bg-emerald-50 rounded"
                            title="Department Orders Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {isDeptExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {isDeptExpanded && (
                        <div className="p-3 bg-white border-t border-slate-100 space-y-3 pl-6">
                          {/* Managers */}
                          {deptManagers.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Managers ({deptManagers.length})</p>
                              {deptManagers.map(mgr => {
                                const subordinates = deptUsers.filter(u => u.managerId === mgr.userId);
                                const isMgrExpanded = expandedManagers[mgr.userId];

                                return (
                                  <div key={`mgr-group-${mgr.userId}`} className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                                    <div 
                                      onClick={() => toggleManager(mgr.userId)}
                                      className="flex items-center justify-between p-2 hover:bg-slate-100/50 cursor-pointer"
                                    >
                                      <div className="min-w-0 flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <div className="truncate">
                                          <p className="text-xs font-semibold text-slate-800 truncate">{mgr.name}</p>
                                          <p className="text-[10px] text-slate-500 font-mono">{mgr.loginId}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                          onClick={() => { setSelectedUser(mgr); setSelectedDept(null); }}
                                          className="p-1 text-slate-500 hover:text-[#006039] hover:bg-emerald-50 rounded cursor-pointer"
                                          title="Reports"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setSelectedResetUser(mgr)}
                                          className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                          title="Reset Password"
                                        >
                                          <KeyRound className="w-3.5 h-3.5" />
                                        </button>
                                        <div onClick={() => toggleManager(mgr.userId)} className="cursor-pointer pl-1 text-slate-400">
                                          {isMgrExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Employees under Manager */}
                                    {isMgrExpanded && (
                                      <div className="pl-6 pr-2 py-1 bg-white border-t border-slate-100 divide-y divide-slate-50">
                                        {subordinates.length === 0 ? (
                                          <p className="text-[10px] text-slate-400 py-1.5 italic">No employees assigned.</p>
                                        ) : (
                                          subordinates.map(emp => (
                                            <div key={`emp-sub-${emp.userId}`} className="flex items-center justify-between py-2">
                                              <div className="min-w-0">
                                                <p className="text-xs font-medium text-slate-700 truncate">{emp.name}</p>
                                                <p className="text-[9px] text-slate-400 font-mono">{emp.loginId}</p>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  onClick={() => { setSelectedUser(emp); setSelectedDept(null); }}
                                                  className="p-1 text-slate-500 hover:text-[#006039] hover:bg-emerald-50 rounded cursor-pointer"
                                                  title="Reports"
                                                >
                                                  <FileText className="w-3 h-3" />
                                                </button>
                                                <button
                                                  onClick={() => setSelectedResetUser(emp)}
                                                  className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                                  title="Reset Password"
                                                >
                                                  <KeyRound className="w-3 h-3" />
                                                </button>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Direct Employees */}
                          {directEmployees.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direct Employees ({directEmployees.length})</p>
                              {directEmployees.map(emp => (
                                <div key={`direct-emp-${emp.userId}`} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/30 border border-slate-100">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 truncate">{emp.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{emp.loginId}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => { setSelectedUser(emp); setSelectedDept(null); }}
                                      className="p-1 text-slate-500 hover:text-[#006039] hover:bg-emerald-50 rounded cursor-pointer"
                                      title="Reports"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setSelectedResetUser(emp)}
                                      className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                      title="Reset Password"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Others (Procurement, Finance, Admin) */}
                          {otherDeptUsers.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Other Staff ({otherDeptUsers.length})</p>
                              {otherDeptUsers.map(oth => (
                                <div key={`other-staff-${oth.userId}`} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/20 border border-slate-100">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 truncate">{oth.name}</p>
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                      <span className="font-mono">{oth.loginId}</span>
                                      <span>•</span>
                                      <span className="font-semibold text-emerald-800 text-[9px] uppercase tracking-wider">{oth.role}</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => { setSelectedUser(oth); setSelectedDept(null); }}
                                      className="p-1 text-slate-500 hover:text-[#006039] hover:bg-emerald-50 rounded cursor-pointer"
                                      title="Reports"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setSelectedResetUser(oth)}
                                      className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                      title="Reset Password"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {deptUsers.length === 0 && (
                            <p className="text-xs text-slate-400 italic text-center py-2">No users in this department.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unassigned Users */}
                {unassignedUsers.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div 
                      onClick={() => toggleDept(9999)}
                      className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-bold text-slate-700">No Department Assigned</span>
                        <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-full font-semibold">
                          {unassignedUsers.length}
                        </span>
                      </div>
                      {expandedDepts[9999] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>

                    {expandedDepts[9999] && (
                      <div className="p-3 bg-white border-t border-slate-100 space-y-1.5 pl-6">
                        {unassignedUsers.map(u => (
                          <div key={`unassigned-${u.userId}`} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/20 border border-slate-100">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{u.name}</p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span className="font-mono">{u.loginId}</span>
                                <span>•</span>
                                <span className="font-semibold text-emerald-800 text-[9px] uppercase tracking-wider">{u.role}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setSelectedUser(u); setSelectedDept(null); }}
                                className="p-1 text-slate-500 hover:text-[#006039] hover:bg-emerald-50 rounded cursor-pointer"
                                title="Reports"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedResetUser(u)}
                                className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                title="Reset Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Report details & PDF actions */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          {/* Report Builder */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">User Profile & Order Log</h3>
                <p className="text-xs text-slate-500 mt-0.5">Generate and export user account statements and order histories.</p>
              </div>
              {(selectedUser || selectedDept) && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-[#006039] hover:bg-[#004d2e] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Export PDF
                </button>
              )}
            </div>

            {selectedUser || selectedDept ? (
              <div className="space-y-4">
                {/* Meta details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Account Information</span>
                  
                  {selectedUser ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <span><strong>Name:</strong> {selectedUser.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span><strong>ID:</strong> {selectedUser.loginId} ({selectedUser.role})</span>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span><strong>Email:</strong> {selectedUser.email}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Building className="w-4 h-4 text-slate-400" />
                        <span><strong>Department:</strong> {selectedUser.departmentName || "None"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600">
                      <p><strong>Department Name:</strong> {selectedDept?.name}</p>
                      <p><strong>Category Group:</strong> {selectedDept?.category}</p>
                    </div>
                  )}
                </div>

                {/* Report Preview */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order History Logs</p>
                  
                  {loadingReport ? (
                    <div className="py-8 text-center text-sm text-slate-400">Loading order database...</div>
                  ) : (
                    <div className="border border-slate-100 rounded-lg overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                            <th className="py-2.5 px-3">Req ID</th>
                            <th className="py-2.5 px-3">Material</th>
                            <th className="py-2.5 px-3 text-right">Qty</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {requests.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400">No requests found.</td>
                            </tr>
                          ) : (
                            requests.slice(0, 15).map(r => (
                              <tr key={`req-row-${r.requestId}`} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-mono text-slate-500">#{r.requestId}</td>
                                <td className="py-2 px-3">
                                  <span className="font-semibold text-slate-700 block">{r.materialName}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{r.partNumber}</span>
                                </td>
                                <td className="py-2 px-3 text-right font-medium">{r.quantity}</td>
                                <td className="py-2 px-3">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      {requests.length > 15 && (
                        <p className="text-[10px] text-slate-400 text-center py-2 bg-slate-50/50 border-t border-slate-100">
                          Showing first 15 records. The printed/PDF document will contain all {requests.length} records.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl space-y-2 text-slate-400">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm">No user selected.</p>
                <p className="text-[11px]">Click any user or department in the directory list to load order history & details.</p>
              </div>
            )}
          </div>

          {/* Reset password card */}
          {selectedResetUser && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-255">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800 text-md flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-500" /> Password Override Console
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Reset login credentials for {selectedResetUser.name}.</p>
                </div>
                <button
                  onClick={() => setSelectedResetUser(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {resetSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs flex items-center gap-2 font-medium">
                  <UserCheck className="w-4 h-4 text-emerald-600" /> Password updated successfully!
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">New Account Password</label>
                    <input
                      type="password"
                      required
                      placeholder="At least 4 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Confirm Password Reset
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

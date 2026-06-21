import React, { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, ClipboardList, Shield, Bell, X, Check, Ban, Building2, ChevronRight, History } from "lucide-react";
import { api } from "../client";
import { AuthSession, MaterialRequest } from "../types";
import { requestStatusLabel, normalizeRequestStatus } from "../requestStatus";
import {
  PremiumPageHeader,
  PremiumPanel,
  PremiumEmptyState,
  PremiumFormCard,
  premiumInput,
  premiumSelect,
  premiumBtnPrimary,
} from "./PremiumUI";

type ToastFn = (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;

interface Employee {
  userId: number;
  loginId?: string;
  name: string;
  email: string;
  managerId?: number;
  maxRequestsPerMonth?: number;
  maxQuantityPerMonth?: number;
  departmentId?: number;
  departmentName?: string;
}

export default function TeamManagementView({
  session,
  addToast,
  executeApiCall,
}: {
  session: AuthSession;
  addToast: ToastFn;
  executeApiCall: <T,>(call: () => Promise<T>, msg?: string) => Promise<T | null>;
}) {
  const isAdmin = session.role === "Admin";
  const isManager = session.role === "Manager";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [managers, setManagers] = useState<{ userId: number; loginId?: string; name: string; email: string }[]>([]);
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string>("");
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | "">(session.shopId ?? "");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [maxRequests, setMaxRequests] = useState("5");
  const [maxQuantity, setMaxQuantity] = useState("10");
  const [managerName, setManagerName] = useState("");
  const [managerLoginId, setManagerLoginId] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [myDeptId, setMyDeptId] = useState<number | "">("");
  const [myDeptName, setMyDeptName] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const sid = selectedShopId === "" ? undefined : Number(selectedShopId);
    const [activity, mgrs, reqList] = await Promise.all<any>([
      executeApiCall(() => api.getShopActivity(sid)),
      isAdmin ? executeApiCall(() => api.getManagers()) : Promise.resolve(null),
      executeApiCall(() => api.getMaterialRequests(sid)),
    ]);

    if (activity) {
      let list: Employee[] = activity.employees ?? activity.technicians ?? [];
      if (isManager && session.userId) {
        list = list.filter((e) => !e.managerId || e.managerId === session.userId);
      }
      setEmployees(list);
      if (reqList) setRequests(reqList);
      else setRequests(activity.requests ?? []);
    } else if (reqList) {
      setRequests(reqList);
    }
    if (mgrs) setManagers(mgrs as Employee[]);
    setLoading(false);
  }, [selectedShopId, executeApiCall, isAdmin, isManager, session.userId]);

  useEffect(() => {
    (async () => {
      const [s, depts, me] = await Promise.all([
        executeApiCall(() => api.getShops()),
        executeApiCall(() => api.getDepartments()),
        executeApiCall(() => api.getMe()),
      ]);
      if (s) {
        setShops(s);
        if (selectedShopId === "" && s.length > 0) {
          setSelectedShopId(session.shopId ?? s[0].id);
        }
      }
      if (depts) {
        setDepartments(depts);
      }
      if (me) {
        setMyDeptId(me.departmentId ?? "");
        setMyDeptName(me.departmentName ?? "None");
      }
    })();
  }, [executeApiCall, session.shopId, selectedShopId]);

  useEffect(() => {
    if (selectedShopId !== "") load();
  }, [selectedShopId, load]);

  const employeeRequests = (userId: number) =>
    requests.filter((r) => r.requestedByUserId === userId);

  const pendingFor = (userId: number) =>
    employeeRequests(userId).filter(
      (r) => normalizeRequestStatus(r.status) === "PendingManagerApproval"
    );

  const pendingCount = (userId: number) => pendingFor(userId).length;

  const totalPending = requests.filter(
    (r) => normalizeRequestStatus(r.status) === "PendingManagerApproval"
  ).length;

  const selectedEmployee = employees.find((e) => e.userId === selectedEmployeeId);
  const selectedHistory = selectedEmployeeId ? employeeRequests(selectedEmployeeId) : [];
  const selectedPending = selectedEmployeeId ? pendingFor(selectedEmployeeId) : [];

  const acceptRequest = async (requestId: number) => {
    const ok = await executeApiCall(
      () => api.managerApproveRequest(requestId),
      "Request accepted — sent to procurement"
    );
    if (ok) load();
  };

  const rejectRequest = async (requestId: number, notes?: string) => {
    const ok = await executeApiCall(
      () => api.managerRejectRequest(requestId, notes || "Rejected by manager"),
      "Request rejected"
    );
    if (ok) load();
  };

  const createEmployee = async () => {
    if (!name.trim() || password.length < 4) {
      addToast("warning", "Invalid form", "Name and password (4+ chars) are required.");
      return;
    }
    setCreating(true);
    const sid = selectedShopId === "" ? undefined : Number(selectedShopId);
    const payload = {
      name: name.trim(),
      loginId: loginId.trim() || undefined,
      password,
      maxRequestsPerMonth: parseInt(maxRequests, 10) || undefined,
      maxQuantityPerMonth: parseFloat(maxQuantity) || undefined,
    };
    const created = await executeApiCall(
      () =>
        sid !== undefined
          ? api.createEmployeeForShop(sid, payload)
          : api.createEmployee(payload),
      "Employee account created"
    );
    setCreating(false);
    if (created) {
      if (created.loginId) {
        addToast("success", "Employee ready", `Share ID ${created.loginId} and the password you set.`);
      }
      setName("");
      setLoginId("");
      setPassword("");
      load();
    }
  };

  const createManager = async () => {
    const sid = selectedShopId === "" ? undefined : Number(selectedShopId);
    if (!sid || !managerName.trim()) {
      addToast("warning", "Invalid manager form", "Pick a shop and enter the manager name.");
      return;
    }
    const ok = await executeApiCall(
      () =>
        api.createManager({
          name: managerName.trim(),
          loginId: managerLoginId.trim() || undefined,
          password: managerPassword || managerLoginId.trim(),
          shopId: sid,
        }),
      "Manager account created"
    );
    if (ok) {
      setManagerName("");
      setManagerLoginId("");
      setManagerPassword("");
      load();
    }
  };

  return (
    <div className="space-y-6 page-enter">
      <PremiumPageHeader
        icon={Users}
        title={isManager ? "Team & user management" : "Shop team & activity"}
        subtitle={
          isManager
            ? totalPending > 0
              ? `${totalPending} employee request${totalPending !== 1 ? "s" : ""} waiting for your approval`
              : "Manage employees, review requests, and set department assignments."
            : "Create accounts and monitor shop activity across your team."
        }
        onRefresh={load}
        loading={loading}
        badge={
          isManager && totalPending > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e2b007]/20 border border-[#e2b007]/40 text-[#e2b007] text-xs font-bold">
              <Bell className="w-3.5 h-3.5" /> {totalPending} pending
            </span>
          ) : undefined
        }
      />

      {isAdmin && shops.length > 0 && (
        <div className="flex items-center gap-3 premium-surface px-4 py-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">Shop</label>
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value ? Number(e.target.value) : "")}
            className={`${premiumSelect} flex-1 max-w-xs`}
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && (
        <PremiumFormCard title="New manager account" icon={Shield}>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Manager full name" value={managerName} onChange={(e) => setManagerName(e.target.value)} className={`${premiumInput} flex-1 min-w-[140px]`} />
            <input placeholder="Manager ID (optional)" value={managerLoginId} onChange={(e) => setManagerLoginId(e.target.value.toUpperCase())} className={`${premiumInput} w-44 font-mono uppercase`} />
            <input placeholder="Password" type="password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} className={`${premiumInput} w-40`} />
            <button type="button" onClick={createManager} className={premiumBtnPrimary}>Create manager</button>
          </div>
        </PremiumFormCard>
      )}

      {(isManager || isAdmin) && (
        <PremiumFormCard title="New employee account" icon={UserPlus}>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={`${premiumInput} flex-1 min-w-[140px]`} />
            <input placeholder="Employee ID (optional)" value={loginId} onChange={(e) => setLoginId(e.target.value.toUpperCase())} className={`${premiumInput} w-44 font-mono uppercase`} />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${premiumInput} w-40`} />
            <input placeholder="Max req/mo" type="number" min="1" value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)} className={`${premiumInput} w-28`} />
            <input placeholder="Max qty/mo" type="number" min="1" value={maxQuantity} onChange={(e) => setMaxQuantity(e.target.value)} className={`${premiumInput} w-28`} />
            <button type="button" disabled={creating} onClick={createEmployee} className={premiumBtnPrimary}>Create account</button>
          </div>
        </PremiumFormCard>
      )}

      {isManager && (
        <PremiumFormCard title="Your department setting" icon={Building2}>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Select the department you manage. Employees created under your account will automatically inherit this department.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="premium-stat-chip bg-[#006039]/5 text-[#006039] border-[#006039]/20">
              Current: <strong>{myDeptName || "None"}</strong>
            </span>
            <select
              value={myDeptId}
              onChange={async (e) => {
                const val = e.target.value ? Number(e.target.value) : "";
                if (val !== "") {
                  const ok = await executeApiCall(() => api.updateMyDepartment(val), "Department updated successfully");
                  if (ok !== null) {
                    setMyDeptId(val);
                    let foundName = "";
                    for (const group of departments) {
                      const found = group.departments?.find((d: any) => d.departmentId === val);
                      if (found) {
                        foundName = found.name;
                        break;
                      }
                    }
                    setMyDeptName(foundName || "Assigned");
                    load();
                  }
                }
              }}
              className={`${premiumSelect} max-w-[280px]`}
            >
              <option value="">Choose department...</option>
              {departments.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.departments.map((dept: any) => (
                    <option key={dept.departmentId} value={dept.departmentId}>
                      {dept.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </PremiumFormCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumPanel
          title={`Your employees (${employees.length})`}
          subtitle="Click a team member to review requests"
          icon={Users}
          noPadding
        >
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {employees.map((emp) => {
              const pending = pendingCount(emp.userId);
              const active = selectedEmployeeId === emp.userId;
              return (
                <button
                  key={emp.userId}
                  type="button"
                  onClick={() => setSelectedEmployeeId(emp.userId)}
                  className={`premium-list-item px-4 py-3.5 flex items-center justify-between gap-3 group ${active ? "premium-list-item-active" : "premium-list-item-idle"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${active ? "bg-[#006039] text-white shadow-md" : "bg-slate-100 text-slate-600 group-hover:bg-[#006039]/10 group-hover:text-[#006039]"}`}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="font-semibold text-slate-800 text-sm truncate">
                        {emp.name}{" "}
                        <span className="font-mono text-[#006039] text-xs">{emp.loginId}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        Limit: {emp.maxRequestsPerMonth ?? "—"} req/mo · {emp.maxQuantityPerMonth ?? "—"} qty/mo
                        {emp.departmentName && ` · ${emp.departmentName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pending > 0 && (
                      <span className="min-w-[1.35rem] h-6 px-2 flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold ring-2 ring-amber-200/50 animate-pulse">
                        {pending}
                      </span>
                    )}
                    <ChevronRight className={`w-4 h-4 transition-transform ${active ? "text-[#006039] translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"}`} />
                  </div>
                </button>
              );
            })}
            {employees.length === 0 && (
              <PremiumEmptyState
                icon={Users}
                title="No employees yet"
                description="Create an account above to add team members under your management."
              />
            )}
          </div>
        </PremiumPanel>

        <PremiumPanel noPadding className="min-h-[420px] flex flex-col">
          {!selectedEmployee ? (
            <PremiumEmptyState
              icon={ClipboardList}
              title="Select an employee"
              description="Click a team member to view their current request and full history."
            />
          ) : (
            <div className="p-5 space-y-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#006039] to-[#004d2e] text-white flex items-center justify-center font-bold shadow-md">
                    {selectedEmployee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{selectedEmployee.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {selectedEmployee.loginId} {selectedEmployee.departmentName ? `· ${selectedEmployee.departmentName}` : ""}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedEmployeeId(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedPending.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Pending your approval</p>
                    <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      {selectedPending.length}
                    </span>
                  </div>
                  {selectedPending.map((r) => (
                    <div key={r.requestId} className="rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                      {/* Card header */}
                      <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 px-4 py-2.5 flex items-center justify-between border-b border-amber-200/60">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#006039] font-mono">REQ-{r.requestId}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                            Awaiting approval
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</span>
                      </div>
                      {/* Card body */}
                      <div className="bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{r.partNumber} — {r.materialName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Qty <span className="font-bold text-slate-700">{r.quantity}</span>
                              {r.aircraftOrWorkOrder && <> · Purpose: <span className="text-slate-700">{r.aircraftOrWorkOrder}</span></>}
                            </p>
                          </div>
                        </div>

                        {rejectingRequestId === r.requestId ? (
                          <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3 space-y-2.5">
                            <p className="text-xs font-semibold text-rose-700">Provide a reason for rejection</p>
                            <input
                              placeholder="Rejection reason..."
                              value={rejectionNotes}
                              onChange={(e) => setRejectionNotes(e.target.value)}
                              className="w-full text-xs p-2 border border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white placeholder-rose-300"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setRejectingRequestId(null)}
                                className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await rejectRequest(r.requestId, rejectionNotes.trim());
                                  setRejectingRequestId(null);
                                  setRejectionNotes("");
                                }}
                                className="text-xs px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-sm"
                              >
                                Confirm rejection
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => acceptRequest(r.requestId)}
                              className="flex items-center gap-1.5 text-xs px-4 py-2 bg-[#006039] hover:bg-[#004d2e] text-white rounded-lg font-semibold shadow-sm transition-all cursor-pointer hover:shadow-md"
                            >
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingRequestId(r.requestId);
                                setRejectionNotes("");
                              }}
                              className="flex items-center gap-1.5 text-xs px-4 py-2 border-2 border-rose-400 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition-all cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-[#006039]" /> Request history
                </p>
                <div className="divide-y max-h-52 overflow-y-auto premium-surface border-0 shadow-none">
                  {selectedHistory.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 text-center">No requests yet.</p>
                  ) : (
                    selectedHistory
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((h) => (
                        <div key={h.requestId} className="p-3 text-xs flex flex-col gap-1 hover:bg-slate-50/80 transition-colors">
                          <div className="flex justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800">{h.partNumber} — {h.materialName}</span>
                              <span className="text-slate-500 ml-1">Qty {h.quantity}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px]">{requestStatusLabel(h.status)}</span>
                              <span className="text-slate-400 text-[10px]">{new Date(h.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {h.notes && (
                            <div className="text-[10px] text-rose-700 bg-rose-50/80 p-2 rounded-lg border border-rose-100 italic">
                              Reason: {h.notes}
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </PremiumPanel>
      </div>
    </div>
  );
}

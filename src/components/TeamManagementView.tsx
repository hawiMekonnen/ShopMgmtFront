import React, { useState, useEffect, useCallback } from "react";
import { Users, RefreshCw, UserPlus, ClipboardList, Shield, Bell, X, Check, Ban } from "lucide-react";
import { api } from "../client";
import { AuthSession, MaterialRequest } from "../types";
import { requestStatusLabel, normalizeRequestStatus } from "../requestStatus";

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
  const [managers, setManagers] = useState<Employee[]>([]);
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

  const rejectRequest = async (requestId: number) => {
    const ok = await executeApiCall(
      () => api.managerRejectRequest(requestId, "Rejected by manager"),
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6" />
            {isManager ? "Team & user management" : "Shop team & activity"}
          </h2>
          {isManager && totalPending > 0 && (
            <p className="text-sm text-amber-700 flex items-center gap-1.5 mt-1">
              <Bell className="w-4 h-4" />
              {totalPending} employee request{totalPending !== 1 ? "s" : ""} waiting for your approval
            </p>
          )}
        </div>
        <button type="button" onClick={load} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isAdmin && shops.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Shop</label>
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value ? Number(e.target.value) : "")}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-[#006039]" /> New manager account
          </h3>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Manager full name" value={managerName} onChange={(e) => setManagerName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]" />
            <input placeholder="Manager ID (optional)" value={managerLoginId} onChange={(e) => setManagerLoginId(e.target.value.toUpperCase())} className="border rounded-lg px-3 py-2 text-sm w-44 font-mono uppercase" />
            <input placeholder="Password" type="password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-40" />
            <button type="button" onClick={createManager} className="px-4 py-2 bg-[#006039] text-white text-sm font-semibold rounded-lg cursor-pointer">Create manager</button>
          </div>
        </div>
      )}

      {(isManager || isAdmin) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <UserPlus className="w-4 h-4 text-[#006039]" /> New employee account
          </h3>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]" />
            <input placeholder="Employee ID (optional)" value={loginId} onChange={(e) => setLoginId(e.target.value.toUpperCase())} className="border rounded-lg px-3 py-2 text-sm w-44 font-mono uppercase" />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-40" />
            <input placeholder="Max req/mo" type="number" min="1" value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-28" />
            <input placeholder="Max qty/mo" type="number" min="1" value={maxQuantity} onChange={(e) => setMaxQuantity(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-28" />
            <button type="button" disabled={creating} onClick={createEmployee} className="px-4 py-2 bg-[#006039] text-white text-sm font-semibold rounded-lg disabled:opacity-50 cursor-pointer">Create account</button>
          </div>
        </div>
      )}

      {isManager && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            Your Department Setting
          </h3>
          <p className="text-xs text-slate-500">
            Select the department you manage. Employees created under your account will automatically inherit this department.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-semibold text-slate-655">Current Department: <strong className="text-[#006039]">{myDeptName || "None"}</strong></span>
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
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#006039] max-w-[280px]"
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
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border divide-y">
          <h3 className="p-4 font-semibold text-sm text-slate-700">
            Your employees ({employees.length})
          </h3>
          {employees.map((emp) => {
            const pending = pendingCount(emp.userId);
            const active = selectedEmployeeId === emp.userId;
            return (
              <button
                key={emp.userId}
                type="button"
                onClick={() => setSelectedEmployeeId(emp.userId)}
                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer ${active ? "bg-[#006039]/5 border-l-4 border-[#006039]" : ""}`}
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {emp.name}{" "}
                    <span className="font-mono text-[#006039] text-xs">{emp.loginId}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Limit: {emp.maxRequestsPerMonth ?? "—"} req/mo · {emp.maxQuantityPerMonth ?? "—"} qty/mo
                    {emp.departmentName && ` · Dept: ${emp.departmentName}`}
                  </p>
                </div>
                {pending > 0 && (
                  <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {pending}
                  </span>
                )}
              </button>
            );
          })}
          {employees.length === 0 && (
            <p className="p-4 text-slate-400 text-sm">No employees assigned to you yet. Create an account above.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 min-h-[280px]">
          {!selectedEmployee ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Select an employee to view their current request and history.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800">{selectedEmployee.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedEmployee.loginId} {selectedEmployee.departmentName ? `· ${selectedEmployee.departmentName}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedEmployeeId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedPending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Pending approval</p>
                  {selectedPending.map((r) => (
                    <div key={r.requestId} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-2">
                      <p className="font-semibold">{r.partNumber} — {r.materialName}</p>
                      <p className="text-xs text-slate-600">Qty {r.quantity} · {r.aircraftOrWorkOrder && `Purpose: ${r.aircraftOrWorkOrder}`}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => acceptRequest(r.requestId)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectRequest(r.requestId)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-rose-100 text-rose-800 rounded-lg font-semibold cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Request history</p>
                <div className="divide-y max-h-52 overflow-y-auto border rounded-lg">
                  {selectedHistory.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400 text-center">No requests yet.</p>
                  ) : (
                    selectedHistory
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((h) => (
                        <div key={h.requestId} className="p-2.5 text-xs flex justify-between gap-2">
                          <div>
                            <span className="font-semibold text-slate-800">{h.partNumber} — {h.materialName}</span>
                            <span className="text-slate-500 ml-1">Qty {h.quantity}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{requestStatusLabel(h.status)}</span>
                            <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

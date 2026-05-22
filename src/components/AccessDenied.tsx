import { ShieldAlert } from "lucide-react";
import { ViewState } from "../types";

interface AccessDeniedProps {
  role: string;
  onGoHome: () => void;
  attempted?: ViewState["type"];
}

export default function AccessDenied({ role, onGoHome, attempted }: AccessDeniedProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
      <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
      <h3 className="text-lg font-bold text-slate-900">Not available for your role</h3>
      <p className="text-sm text-slate-500">
        {attempted
          ? `The "${attempted}" screen is not part of the ${role} workspace.`
          : `This action is not allowed for ${role} users.`}
      </p>
      <button
        type="button"
        onClick={onGoHome}
        className="px-4 py-2 bg-[#006039] text-white text-sm font-semibold rounded-lg"
      >
        Go to my home screen
      </button>
    </div>
  );
}

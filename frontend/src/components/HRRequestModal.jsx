// components/HRRequestModal.jsx
import { X, Mail } from "lucide-react";

function HRRequestModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleEmailAdmin = () => {
    const subject = "HR Access Request";
    const body = "Hello Admin,\n\nI would like to request HR access for my account.\n\nThank you.";
    window.open(`mailto:kirtanvyas9916@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-base-content">HR Access Required</h2>
          <button 
            onClick={onClose} 
            className="text-base-content/60 hover:text-base-content transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-base-content/80">
            To create sessions and access HR features, you need special permissions.
          </p>
          
          <div className="bg-warning/20 border border-warning rounded-lg p-4">
            <p className="text-warning-content text-sm">
              📧 Contact the administrator to request HR access.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleEmailAdmin}
              className="btn btn-primary flex-1 gap-2"
            >
              <Mail className="w-4 h-4" />
              Email Admin
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HRRequestModal;
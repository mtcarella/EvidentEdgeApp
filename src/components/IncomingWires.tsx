import { ExternalLink, FileSpreadsheet } from 'lucide-react';

export function IncomingWires() {
  const handleOpenSpreadsheet = () => {
    window.open('https://evidenttitle.sharepoint.com/:x:/s/Wires/IQAQ6Xy3dY47TYq_BxbZauTPAWr8MMt3vy-lx6BL39jwaWw?e=GNFO7e', '_blank');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
        <h2 className="text-2xl font-bold text-slate-900">Incoming Wires</h2>
        <p className="text-sm text-slate-600 mt-1">
          View and track incoming wire transfers
        </p>
      </div>

      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Access Incoming Wires Spreadsheet
            </h3>
            <p className="text-slate-600">
              Click the button below to open the SharePoint spreadsheet in a new tab. Make sure you're logged into your Microsoft account.
            </p>
          </div>

          <button
            onClick={handleOpenSpreadsheet}
            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            <FileSpreadsheet className="w-6 h-6" />
            <span>Open Incoming Wires Spreadsheet</span>
            <ExternalLink className="w-5 h-5" />
          </button>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              If you're unable to access the spreadsheet, please ensure you have the proper permissions or contact your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { BarChart3, Download, CalendarCheck, Users, Activity, PhoneCall, Trash2 } from 'lucide-react';

const Reports: React.FC = () => {
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await api.get('/reports/compliance');
            setReports(res.data);
        } catch (error) {
            console.error('Error fetching reports', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, date: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar el reporte del día ${date}? Esta acción no se puede deshacer.`)) return;
        try {
            await api.delete(`/reports/${id}`);
            fetchReports();
        } catch (error) {
            alert('No se pudo eliminar el reporte');
        }
    };

    const exportToCSV = () => {
        if (reports.length === 0) return;

        const headers = ["Fecha", "Campaña", "Staff Planeado", "Staff Real", "Cumplimiento (%)", "Llamadas Recibidas", "Abandonos", "Nivel de Servicio (%)"];
        const rows = reports.map((r: any) => [
            r.date.split('-').reverse().join('/'),
            r.poolName,
            r.plannedAgents,
            r.activeAgents,
            r.compliancePct,
            r.totalCalls,
            r.abandonedCalls,
            r.serviceLevel
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row: any) => row.join(','))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_operativo_wfm_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-50 flex items-center gap-3">
                        <BarChart3 className="text-indigo-400" />
                        Reportes de Cumplimiento
                    </h1>
                    <p className="text-slate-400 mt-2">Análisis de Plan vs. Realidad y métricas de cierre de día.</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 active:scale-95"
                >
                    <Download size={18} />
                    Descargar Reporte (Excel)
                </button>
            </div>

            {/* Main Content */}
            <div className="bg-[#161a22] rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-800/30 border-b border-slate-800">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <div className="flex items-center gap-2"><CalendarCheck size={12} /> Fecha</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Campaña
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                                    <div className="flex items-center justify-center gap-2"><Users size={12} /> Plan vs Real</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                                    <div className="flex items-center justify-center gap-2"><Activity size={12} /> Cumplimiento</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                                    <div className="flex items-center justify-center gap-2"><PhoneCall size={12} /> Tráfico</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {reports.map((report: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <p className="text-sm font-bold text-slate-200">
                                            {report.date.split('-').reverse().join('/')}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-tighter">
                                            {report.poolName}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="text-center">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">Plan</p>
                                                <p className="text-lg font-black text-indigo-400">{report.plannedAgents}</p>
                                            </div>
                                            <div className="w-px h-6 bg-slate-700"></div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">Real</p>
                                                <p className="text-lg font-black text-slate-200">{report.activeAgents}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {report.plannedAgents > 0 ? (
                                            <span className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${report.compliancePct >= 95 ? 'bg-emerald-900/20 text-emerald-400' :
                                                    report.compliancePct >= 85 ? 'bg-amber-900/20 text-amber-400' : 'bg-rose-900/20 text-rose-400'
                                                }`}>
                                                {report.compliancePct}%
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-500 italic">Sin plan</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1 text-xs">
                                            <p><span className="text-slate-500 font-medium">Recibidas:</span> <span className="font-bold text-slate-200">{report.totalCalls}</span></p>
                                            <p><span className="text-slate-500 font-medium">Abandonos:</span> <span className="font-bold text-rose-400">{report.abandonedCalls}</span></p>
                                            <p><span className="text-slate-500 font-medium">NS:</span> <span className="font-bold text-indigo-400">{report.serviceLevel}%</span></p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(report.id, report.date)}
                                            className="p-2 text-gray-300 hover:text-rose-400 hover:bg-rose-900/20 rounded-lg transition-all group-hover:scale-110"
                                            title="Eliminar reporte de este día"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {reports.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <p className="text-slate-500 italic">Aún no hay días cerrados. Ve a la pestaña Live y usa "Cerrar Día y Guardar Métricas".</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;

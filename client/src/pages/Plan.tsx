import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { BookOpen, Calendar, Filter, Archive, CheckCircle, ChevronRight, Trash2 } from 'lucide-react';

const Plan: React.FC = () => {
    const [pools, setPools] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [selectedPoolId, setSelectedPoolId] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const res = await api.get('/pools');
            setPools(res.data);
            if (res.data.length > 0) {
                setSelectedPoolId(res.data[0].id);
                fetchPlans(res.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching pools', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPlans = (poolId: string) => {
        api.get(`/plans/${poolId}`).then(res => setPlans(res.data));
    };

    const handlePoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedPoolId(id);
        fetchPlans(id);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Cabecera Técnica */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-50 flex items-center gap-3">
                        <Archive className="text-indigo-400" />
                        Histórico de Planes
                    </h1>
                    <p className="text-slate-400 mt-2">Repositorio oficial de planes de capacidad guardados y auditados.</p>
                </div>

                <div className="flex items-center gap-3 bg-[#161a22] p-2 rounded-2xl shadow-sm border border-slate-800">
                    <Filter className="text-slate-500 ml-2" size={18} />
                    <select
                        value={selectedPoolId}
                        onChange={handlePoolChange}
                        className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-200 pr-8"
                    >
                        {pools.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
            </div>

            {/* Listado de Planes */}
            <div className="grid grid-cols-1 gap-6">
                {plans.length === 0 ? (
                    <div className="bg-[#161a22] p-20 text-center rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 bg-[#0e1117] rounded-full flex items-center justify-center">
                            <BookOpen className="text-gray-300" size={32} />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-slate-50">Archivo Vacío</p>
                            <p className="text-slate-500">No hay planes registrados para {pools.find(p => p.id == selectedPoolId)?.nombre}.</p>
                        </div>
                    </div>
                ) : (
                    plans.map(plan => (
                        <div key={plan.id} className="bg-[#161a22] rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-400">
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-50 italic">PLAN: {new Date(plan.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' })}</h3>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Cargado a las {new Date(plan.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-emerald-900/20 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                        <CheckCircle size={12} />
                                        Finalizado / Auditado
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                                    {(() => {
                                        const order = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
                                        return Object.entries(plan.distribucion)
                                            .sort((a, b) => {
                                                const dayA = a[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                                const dayB = b[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                                return order.indexOf(dayA) - order.indexOf(dayB);
                                            })
                                            .map(([day, data]: [string, any]) => (
                                                <div key={day} className="relative p-4 bg-[#0e1117] rounded-2xl border border-transparent">
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 opacity-70">{day.substring(0, 3)}</p>
                                                    <div className="flex flex-col items-baseline gap-1">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-slate-100">{data.planned}</span>
                                                            <span className="text-[8px] font-black text-indigo-400 uppercase">Pax</span>
                                                        </div>
                                                        {data.matutino !== undefined && (
                                                            <div className="text-[9px] text-slate-400 font-medium">
                                                                <span className="text-blue-500">{data.matutino}</span> / <span className="text-orange-500">{data.vespertino}</span> / <span className="text-purple-500">{data.nocturno}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 text-[8px] font-bold text-slate-400 bg-[#161a22] inline-block px-1.5 py-0.5 rounded-lg border border-slate-800 shadow-sm leading-tight">
                                                        {data.shift ? `TURNO ${data.shift}` : `${data.rest} Libres`}
                                                    </div>
                                                </div>
                                            ));
                                    })()}
                                </div>
                            </div>
                            <div className="bg-slate-800/30 px-6 py-3 border-t border-slate-800/50 flex justify-between items-center">
                                <p className="text-[10px] font-bold text-slate-500 italic">ID de Auditoría: {plan.id.substring(0, 8)}...</p>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={async () => {
                                            if (confirm('¿Está seguro de eliminar este plan histórico? Esta acción no se puede deshacer.')) {
                                                await api.delete(`/plans/${plan.id}`);
                                                fetchPlans(selectedPoolId);
                                            }
                                        }}
                                        className="text-rose-400 hover:text-rose-400 p-2 transition-colors"
                                        title="Eliminar Plan"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button className="text-indigo-400 text-xs font-black flex items-center gap-1 hover:gap-2 transition-all">
                                        DETALLES COMPLETOS
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Plan;

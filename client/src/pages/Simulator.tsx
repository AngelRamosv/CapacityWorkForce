import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { LayoutDashboard, Save, AlertCircle, CheckCircle2, RotateCcw, Activity, Palmtree } from 'lucide-react';

const DAYS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

interface DayData {
    matutino: number;
    vespertino: number;
    nocturno: number;
    planned: number;
    rest: number;
    vacation: number;
}

const Simulator: React.FC = () => {
    const [pools, setPools] = useState<any[]>([]);
    const [selectedPoolId, setSelectedPoolId] = useState('');
    const [vacations, setVacations] = useState<any[]>([]);
    const [lastPreloadPoolId, setLastPreloadPoolId] = useState<string | null>(null);
    const [distribution, setDistribution] = useState<Record<string, DayData>>(
        DAYS.reduce((acc, day) => ({ ...acc, [day]: { matutino: 0, vespertino: 0, nocturno: 0, planned: 0, rest: 0, vacation: 0 } }), {})
    );
    const [balance, setBalance] = useState<any>(null);
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [poolsRes, configRes, vacRes] = await Promise.all([
                api.get('/pools'),
                api.get('/config'),
                api.get('/vacations')
            ]);
            setPools(poolsRes.data);
            setConfig(configRes.data);
            setVacations(vacRes.data);
            
            if (poolsRes.data.length > 0) {
                const retPool = poolsRes.data.find((p: any) => p.nombre.toLowerCase().includes('retencion') || p.nombre.toLowerCase().includes('retención'));
                setSelectedPoolId(retPool ? retPool.id : poolsRes.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching data', error);
        }
    };

    // 1. Efecto para recalcular el balance cada vez que cambia la distribución (Suma Cero)
    useEffect(() => {
        if (selectedPoolId && Object.values(distribution).some(d => d.planned > 0)) {
            simulate();
        }
    }, [distribution, selectedPoolId]);

    // 2. Efecto para PRE-CARGAR nocturnos solo una vez al cambiar de Pool
    useEffect(() => {
        if (selectedPoolId && selectedPoolId !== lastPreloadPoolId) {
            const pool = pools.find(p => p.id === selectedPoolId);
            if (pool) {
                const noctCount = pool.agentesNocturnos || 0;
                setDistribution(prev => {
                    const next = { ...prev };
                    DAYS.forEach(day => {
                        const isWeekend = day === 'Sabado' || day === 'Domingo';
                        const n = isWeekend ? 0 : noctCount;
                        next[day] = { 
                            ...prev[day], 
                            nocturno: n,
                            planned: n,
                            matutino: 0,
                            vespertino: 0,
                            rest: 0
                        };
                    });
                    return next;
                });
                setLastPreloadPoolId(selectedPoolId);
            }
        }
    }, [selectedPoolId, pools.length, lastPreloadPoolId]);

    const simulate = async () => {
        const pool = pools.find(p => p.id === selectedPoolId);
        if (!pool) return;

        try {
            const res = await api.post('/simulate', {
                totalAgents: pool.totalAgentes,
                distribution
            });
            setBalance(res.data);
        } catch (error) {
            console.error('Error simulating', error);
        }
    };

    const handleInputChange = (day: string, field: keyof DayData, value: number) => {
        setDistribution(prev => {
            const currentDay = { ...prev[day], [field]: value };

            if (field === 'matutino' || field === 'vespertino' || field === 'nocturno') {
                currentDay.planned = currentDay.matutino + currentDay.vespertino + currentDay.nocturno;
            }

            return {
                ...prev,
                [day]: currentDay
            };
        });
    };

    const handlePoolChange = (id: string, field: string, value: any) => {
        setPools(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const calculateCapacity = (planned: number) => {
        if (!config) return 0;
        const { shrinkage, ocupacion, tmoMinutos, horasTurno } = config;
        const effective = planned * (1 - shrinkage);
        return Math.round((effective * horasTurno * 60 * ocupacion) / tmoMinutos);
    };

    const handleSave = async () => {
        if (!balance?.isBalanced) {
            alert('El plan debe estar balanceado (Suma Cero) antes de guardar.');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/plans', {
                poolId: selectedPoolId,
                weekNumber: 1,
                year: 2026,
                distribution
            });
            alert('Plan guardado y auditado exitosamente conforme a la estructura profesional.');
        } catch (error) {
            alert('Error al guardar el plan');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoPlan = () => {
        const pool = pools.find(p => p.id === selectedPoolId);
        if (!pool) return;

        // Contamos cuántas vacaciones activas hay para este pool
        const poolVacations = vacations.filter(v => v.campanaId === parseInt(selectedPoolId));
        const totalVacCount = poolVacations.length; 

        const totalAgents = pool.totalAgentes - totalVacCount;

        // NUEVA LÓGICA IA AVANZADA
        // 1. Descansos: Repartir solo de Miércoles a Domingo (Lunes y Martes 0 descansos)
        const restDaysMap: any = { Lunes: 0, Martes: 0, Miercoles: 0, Jueves: 0, Viernes: 0, Sabado: 0, Domingo: 0 };
        const allowedRestDays = ['Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
        let remainingRestDays = totalAgents;
        let dayIdx = 0;

        while (remainingRestDays > 0) {
            restDaysMap[allowedRestDays[dayIdx]]++;
            remainingRestDays--;
            dayIdx = (dayIdx + 1) % allowedRestDays.length;
        }

        const newDist = DAYS.reduce((acc, day) => {
            const rest = restDaysMap[day];
            let planned = totalAgents - rest;

            // 2. Turno Nocturno Congelado
            const noctFromExcel = pool.agentesNocturnos || 0;
            let nocturno = (day === 'Sabado' || day === 'Domingo') ? 0 : noctFromExcel;
            
            if (nocturno > planned) nocturno = planned; 

            const remainingToPlan = planned - nocturno;
            let matutino = 0;
            let vespertino = 0;

            // 3. Fines de semana: Solo Matutino
            if (day === 'Sabado' || day === 'Domingo') {
                matutino = remainingToPlan;
                vespertino = 0;
            } else {
                // Lunes a Viernes: 50/50
                matutino = Math.round(remainingToPlan * 0.50);
                vespertino = remainingToPlan - matutino;
            }

            return {
                ...acc,
                [day]: { matutino, vespertino, nocturno, planned, rest, vacation: totalVacCount }
            };
        }, {});

        setDistribution(newDist);
        if (totalVacCount > 0) {
            alert(`IA: Plan generado descontando ${totalVacCount} agentes en vacaciones.`);
        } else {
            alert(`IA: Plan balanceado generado para ${pool.nombre} (${totalAgents} agentes)`);
        }
    };
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-[#161a22] p-6 rounded-xl shadow-sm border border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
                        <LayoutDashboard className="text-indigo-400" />
                        Simulador de Suma Cero (Modelo Profesional)
                    </h1>
                    <p className="text-slate-400 mt-1">Ajusta la distribución diaria o usa la IA para balancear.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            const emptyDist = DAYS.reduce((acc, day) => ({
                                ...acc,
                                [day]: { matutino: 0, vespertino: 0, nocturno: 0, planned: 0, rest: 0, vacation: 0 }
                            }), {});
                            setDistribution(emptyDist);
                        }}
                        className="flex items-center gap-2 bg-[#161a22] text-slate-300 border border-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-[#0e1117] transition active:scale-95"
                    >
                        Reiniciar Plan
                    </button>

                    <button
                        onClick={handleAutoPlan}
                        className="flex items-center gap-2 bg-amber-900/20 text-amber-300 border border-amber-800/50 px-4 py-2 rounded-lg font-bold hover:bg-amber-100 transition active:scale-95"
                    >
                        <RotateCcw size={18} className="animate-spin-slow" />
                        Auto-Plan IA
                    </button>

                    <button
                        onClick={async () => {
                            try {
                                const res = await api.get('/live');
                                const pool = pools.find(p => p.id === selectedPoolId);
                                if (pool) {
                                    handlePoolChange(pool.id, 'totalAgentes', res.data.total_agentes);
                                    alert(`Staff Real cargado: ${res.data.total_agentes} agentes activos en este momento.`);
                                }
                            } catch (error) {
                                alert('No se pudo conectar con la Central de Datos');
                            }
                        }}
                        className="flex items-center gap-2 bg-rose-900/20 text-rose-700 border border-rose-800/50 px-4 py-2 rounded-lg font-bold hover:bg-rose-100 transition active:scale-95"
                    >
                        <Activity size={18} />
                        Usar Staff Real (Live)
                    </button>

                    <select
                        className="bg-[#0e1117] border border-slate-700 text-slate-50 rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        value={selectedPoolId}
                        onChange={(e) => setSelectedPoolId(e.target.value)}
                    >
                        {pools.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre} ({p.totalAgentes} agentes)</option>
                        ))}
                    </select>
                </div>
            </div>

            {vacations.filter(v => v.campanaId === parseInt(selectedPoolId)).length > 0 && (
                <div className="bg-emerald-900/20 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-sm font-medium">
                    <Palmtree className="text-emerald-400" />
                    Hay {vacations.filter(v => v.campanaId === parseInt(selectedPoolId)).length} agentes con vacaciones aprobadas para este pool.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Grid de Entrada */}
                <div className="lg:col-span-2 bg-[#161a22] rounded-xl shadow-sm border border-slate-800 p-6">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">
                                <th className="pb-4 text-left">Día</th>
                                <th className="pb-4 text-sky-600">Matutino</th>
                                <th className="pb-4 text-orange-600">Vespertino</th>
                                <th className="pb-4 text-indigo-400">Nocturno</th>
                                <th className="pb-4">Descansos</th>
                                <th className="pb-4">Vacac.</th>
                                <th className="pb-4 text-right">Capacidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {DAYS.map(day => (
                                <tr key={day} className="group hover:bg-slate-800/30 transition border-b border-slate-800/50/50 last:border-0 relative">
                                    <td className="py-4 font-semibold text-slate-200 text-xs">
                                        {day}
                                        <div className="text-[9px] text-slate-500 font-normal">
                                            Σ {distribution[day].planned} asignados
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-sky-50 text-sky-700 border-none rounded-md p-1.5 focus:ring-2 focus:ring-sky-500 transition text-center text-xs font-bold"
                                            value={distribution[day].matutino}
                                            onChange={(e) => handleInputChange(day, 'matutino', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-orange-50 text-orange-700 border-none rounded-md p-1.5 focus:ring-2 focus:ring-orange-500 transition text-center text-xs font-bold"
                                            value={distribution[day].vespertino}
                                            onChange={(e) => handleInputChange(day, 'vespertino', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-indigo-900/30 text-indigo-300 border-none rounded-md p-1.5 focus:ring-2 focus:ring-indigo-500 transition text-center text-xs font-bold"
                                            value={distribution[day].nocturno}
                                            onChange={(e) => handleInputChange(day, 'nocturno', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number"
                                            className="w-14 bg-[#0e1117] text-slate-300 border-none rounded-md p-1.5 focus:ring-2 focus:ring-gray-400 transition text-center text-xs"
                                            value={distribution[day].rest}
                                            onChange={(e) => handleInputChange(day, 'rest', parseInt(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <input type="number" readOnly
                                            className="w-14 bg-slate-800 text-slate-500 border-none rounded-md p-1.5 text-center text-xs cursor-not-allowed hidden md:inline-block outline-none"
                                            value={distribution[day].vacation}
                                        />
                                    </td>
                                    <td className="py-4 text-right font-mono font-black text-indigo-400">
                                        {calculateCapacity(distribution[day].planned)} <span className="text-[9px] text-slate-500 font-sans font-medium">LLAM</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Panel de Control y Balance */}
                <div className="space-y-6">
                    <div className={`p-6 rounded-xl border transition-all duration-300 ${balance?.isBalanced ? 'bg-emerald-900/20 border-emerald-800/50 shadow-emerald-900/20' : 'bg-rose-900/20 border-rose-800/50 shadow-rose-900/20'
                        } shadow-lg`}>
                        <div className="flex items-center gap-2 mb-4">
                            {balance?.isBalanced ? (
                                <CheckCircle2 className="text-green-600" />
                            ) : (
                                <AlertCircle className="text-red-500 animate-pulse" />
                            )}
                            <h2 className={`font-bold text-lg ${balance?.isBalanced ? 'text-green-800' : 'text-red-800'}`}>
                                {balance?.isBalanced ? 'Suma Cero Correcta' : 'Estado de Balance'}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b pb-2 border-slate-800">
                                <span className="text-sm text-slate-400">Capacidad Total Semana</span>
                                <span className="text-2xl font-black text-slate-100">{balance?.weeklyTotalCapacity}</span>
                            </div>
                            <div className="flex justify-between items-end border-b pb-2 border-slate-800">
                                <span className="text-sm text-slate-400">Total Asignado (Σ)</span>
                                <span className="text-2xl font-black text-slate-100">{balance?.totalAllocated}</span>
                            </div>
                            <div className="text-center pt-2">
                                <span className={`text-xl font-black ${balance?.isBalanced ? 'text-green-600' : (balance?.delta > 0 ? 'text-amber-500' : 'text-rose-500')}`}>
                                    {balance?.isBalanced ? 'Suma Cero Correcta' : (balance?.delta > 0 ? `Falta asignar ${Math.abs(balance?.delta)} jornada(s)` : `Sobrecarga de ${Math.abs(balance?.delta)} jornada(s)`)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!balance?.isBalanced || isLoading}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${balance?.isBalanced
                            ? 'bg-indigo-500 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-95'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        <Save size={20} />
                        {isLoading ? 'Guardando...' : 'Guardar Plan y Auditar'}
                    </button>

                    <div className="bg-[#161a22] p-4 rounded-lg border border-slate-800 text-[11px] text-slate-500 space-y-1">
                        <p className="font-bold text-slate-400 uppercase">Referencia Profesional</p>
                        <p>• AHT: {config?.tmoMinutos} min</p>
                        <p>• Ocupación: {Math.round(config?.ocupacion * 100)}%</p>
                        <p>• Shrinkage: {Math.round(config?.shrinkage * 100)}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Simulator;

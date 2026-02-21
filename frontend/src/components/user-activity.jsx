import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";

const UserActivityChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("daily");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `http://localhost:3000/users/stats/activity?period=${period}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setData(response.data || []);
      } catch (error) {
        console.error("Error fetching statistics:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [period]);

  const formatXAxis = (tickItem) => {
    if (tickItem === null || tickItem === undefined) return "";
    const stringTick = String(tickItem);

    switch (period) {
      case "daily": return `${stringTick}h`;
      case "weekly": return stringTick.substring(0, 3);
      case "yearly":
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[tickItem - 1] || stringTick;
      default: return stringTick;
    }
  };

  return (
    <div className="w-full h-full min-h-[420px] flex flex-col bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      
      {/* Header sekcija */}
      <div className="flex justify-between items-start mb-8 px-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">User Activity</h2>
          <p className="text-[12px] text-emerald-600 font-bold uppercase tracking-widest">Growth Analytics</p>
        </div>

        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          {["daily", "weekly", "monthly", "yearly"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-[10px] font-bold uppercase rounded-xl transition-all duration-300 ${
                period === p 
                ? "bg-white text-emerald-600 shadow-md ring-1 ring-slate-200 scale-105" 
                : "text-slate-500 hover:text-emerald-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Kontejner za grafik */}
      <div className="flex-1 w-full relative"> 
        {loading ? (
          <div className="h-full flex items-center justify-center">
             <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="95%">
            <AreaChart 
              data={data} 
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCountGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              
              <XAxis 
                dataKey={period === "yearly" ? "month" : (period === "daily" ? "hour" : (period === "weekly" ? "day" : "date"))} 
                tickFormatter={formatXAxis}
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                height={50}
                dy={15}
              />
              
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
              />
              
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                  padding: '12px'
                }}
                labelFormatter={(value) => `Time: ${formatXAxis(value)}`}
              />
              
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#10b981" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorCountGreen)" 
                animationDuration={1500}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#059669' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default UserActivityChart;
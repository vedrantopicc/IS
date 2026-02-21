import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import { useParams } from "react-router-dom";
import { TrendingUp } from "lucide-react";

const EventStatsChart = () => {
  const { eventId } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("daily");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `http://localhost:3000/events/organizer/${eventId}/time-stats?period=${filter}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setData(response.data || []);
      } catch (error) {
        console.error("Error fetching stats:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    if (eventId) fetchStats();
  }, [eventId, filter]);

  // Funkcija koja formatira tekst na dnu grafikona
  const formatXAxis = (tickItem) => {
    if (tickItem === null || tickItem === undefined) return "";
    const val = String(tickItem);

    switch (filter) {
      case "daily": 
        return `${val}h`; // Dodaje 'h' na sate (npr. 11h, 12h)
      case "weekly": 
        return val.length > 3 ? val.substring(0, 3) : val; // Skraćuje dane (npr. Mon)
      case "yearly":
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[parseInt(val) - 1] || val; // Pretvara broj u ime meseca
      default: 
        return val;
    }
  };

  return (
    <div className="p-4 space-y-6 bg-transparent w-full">
      <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <div className="flex justify-between items-center mb-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
               <div className="p-2 bg-blue-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
               </div>
               <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Reservation Overview</h3>
            </div>
            <p className="text-gray-500 text-[15px] ml-10">Tracking your ticket sales performance</p>
          </div>
          
          <div className="bg-gray-50 p-1.5 rounded-xl border border-gray-100">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border-none rounded-lg py-1.5 px-4 text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div className="h-[400px] w-full">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
               <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
               <p className="text-gray-400 font-medium">Analyzing data...</p>
            </div>
          ) : data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                
                <XAxis 
                  // KLJUČNA PROMENA: dataKey se menja na osnovu filtera
                  dataKey={
                    filter === "daily" ? "hour" : 
                    filter === "weekly" ? "day" : 
                    filter === "yearly" ? "month" : "date"
                  } 
                  tickFormatter={formatXAxis}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  dy={10} // Pomera tekst malo niže da ne udara u liniju
                  interval={0} // Osigurava da se vide sve labele ako ima mesta
                />

                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                
                <Tooltip 
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                />
                
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2563eb" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorCount)"
                  dot={{ r: 5, fill: '#2563eb', strokeWidth: 3, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#1d4ed8' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-gray-500 font-medium">No reservations available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventStatsChart;
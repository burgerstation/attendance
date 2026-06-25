import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Calendar, Clock, User, BarChart2, List, CalendarDays } from 'lucide-react';

// Use your public anon key here
const supabase = createClient('https://bdwpsqnqjvfxtxbzcxwa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3BzcW5xanZmeHR4YnpjeHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDY2NTQsImV4cCI6MjA5NzgyMjY1NH0.AS7zTcJ4MPnLgIp9PzWaf1zLjQVF9RnDd_b8xwTcUtQ');

export default function AttendanceDashboard() {
  const [logs, setLogs] = useState([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [statSearchQuery, setStatSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' or 'stats'

  useEffect(() => {
    fetchLogs();
    
    const interval = setInterval(() => {
      fetchLogs();
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select(`
          swipe_time,
          status,
          employees ( full_name, role )
        `)
        .order('swipe_time', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- LOGS FILTERING ---
  const filteredLogs = logs.filter(log => {
    const name = log.employees?.full_name?.toLowerCase() || '';
    return name.includes(logSearchQuery.toLowerCase());
  });

  // --- STATISTICS CALCULATION ---
  const employeeStats = useMemo(() => {
    if (logs.length === 0) return [];

    const stats = {};

    // 1. Group logs by employee
    logs.forEach(log => {
      const name = log.employees?.full_name || 'Unknown (Add to DB)';
      if (!stats[name]) {
        stats[name] = { name, role: log.employees?.role || 'No Role', rawLogs: [] };
      }
      stats[name].rawLogs.push(log);
    });

    // 2. Calculate daily hours for each employee
    return Object.values(stats).map(emp => {
      const logsByDay = {};
      
      // Group their specific logs by day
      emp.rawLogs.forEach(log => {
        const dStr = new Date(log.swipe_time).toLocaleDateString('en-GB', { timeZone: 'Africa/Casablanca' });
        if (!logsByDay[dStr]) logsByDay[dStr] = [];
        logsByDay[dStr].push(log);
      });

      let totalMillisecondsOverall = 0;
      const dailyBreakdown = [];

      // Calculate time differences for checkIn -> checkOut pairs per day
      Object.entries(logsByDay).forEach(([dateStr, dayLogs]) => {
        // Sort chronologically
        dayLogs.sort((a, b) => new Date(a.swipe_time) - new Date(b.swipe_time));
        
        let lastCheckIn = null;
        let dailyMilliseconds = 0;

        dayLogs.forEach(l => {
          if (l.status === 'checkIn') {
            lastCheckIn = new Date(l.swipe_time);
          } else if (l.status === 'checkOut' && lastCheckIn) {
            dailyMilliseconds += (new Date(l.swipe_time) - lastCheckIn);
            lastCheckIn = null; 
          }
        });

        totalMillisecondsOverall += dailyMilliseconds;
        
        // Only add days where they actually logged time
        if (dailyMilliseconds > 0) {
          dailyBreakdown.push({
            dateStr,
            dateObj: new Date(dayLogs[0].swipe_time), // Keep original date for proper sorting
            hours: (dailyMilliseconds / (1000 * 60 * 60)).toFixed(1)
          });
        }
      });

      // Sort daily breakdown so most recent days are at the top
      dailyBreakdown.sort((a, b) => b.dateObj - a.dateObj);

      return {
        name: emp.name,
        role: emp.role,
        totalHours: (totalMillisecondsOverall / (1000 * 60 * 60)).toFixed(1),
        dailyBreakdown
      };
    }).sort((a, b) => parseFloat(b.totalHours) - parseFloat(a.totalHours)); 
  }, [logs]);

  // --- STATS FILTERING ---
  const filteredStats = employeeStats.filter(stat => 
    stat.name.toLowerCase().includes(statSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Dashboard</h1>
          <p className="text-gray-500 mt-1">Live tracking automatically synced from device</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 gap-6">
          <button 
            onClick={() => setActiveTab('logs')}
            className={`pb-4 px-2 font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'logs' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List className="w-4 h-4" />
            Live Logs
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`pb-4 px-2 font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'stats' 
                ? 'border-b-2 border-blue-600 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Employee Statistics
          </button>
        </div>

        {/* ========================================= */}
        {/* TAB 1: LIVE LOGS                          */}
        {/* ========================================= */}
        {activeTab === 'logs' && (
          <div>
            <div className="bg-white p-4 rounded-t-xl border border-gray-200 flex items-center gap-3 shadow-sm">
              <Search className="text-gray-400 w-5 h-5 ml-2" />
              <input 
                type="text"
                placeholder="Search live logs by employee name..."
                className="w-full outline-none text-gray-700 bg-transparent"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
              />
            </div>

            <div className="bg-white border-x border-b border-gray-200 rounded-b-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                  <tr>
                    <th className="py-4 px-6 font-semibold">Employee</th>
                    <th className="py-4 px-6 font-semibold">Date</th>
                    <th className="py-4 px-6 font-semibold">Time</th>
                    <th className="py-4 px-6 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-10 text-gray-500">Loading records...</td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-10 text-gray-500">No attendance records found.</td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, index) => {
                      const dateObj = new Date(log.swipe_time);
                      return (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {log.employees?.full_name || 'Unknown (Add to DB)'}
                                </p>
                                <p className="text-sm text-gray-500">{log.employees?.role || 'No Role'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600 flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {dateObj.toLocaleDateString('en-GB', { timeZone: 'Africa/Casablanca' })}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 text-gray-900 font-medium">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {dateObj.toLocaleTimeString('en-GB', { 
                                 timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit' 
                              })}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {(() => {
                              let style = { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', label: log.status || 'Unknown' };
                              switch (log.status) {
                                case 'checkIn': style = { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Checked In' }; break;
                                case 'checkOut': style = { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Checked Out' }; break;
                                case 'breakIn': style = { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Break In' }; break;
                                case 'breakOut': style = { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Break Out' }; break;
                              }
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                                  {style.label}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* TAB 2: EMPLOYEE STATISTICS                */}
        {/* ========================================= */}
        {activeTab === 'stats' && (
          <div className="animate-in fade-in duration-300">
            {/* Dedicated Stats Search */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-3 shadow-sm mb-6">
              <Search className="text-gray-400 w-5 h-5 ml-2" />
              <input 
                type="text"
                placeholder="Search statistics by employee name..."
                className="w-full outline-none text-gray-700 bg-transparent"
                value={statSearchQuery}
                onChange={(e) => setStatSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="text-center py-10 text-gray-500">Calculating statistics...</p>
            ) : filteredStats.length === 0 ? (
              <p className="text-center py-10 text-gray-500">No matching employees found.</p>
            ) : (
              <div className="space-y-6">
                {filteredStats.map((stat, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    
                    {/* Employee Card Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{stat.name}</h3>
                          <p className="text-sm text-gray-500">{stat.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">Total Tracked</p>
                        <p className="text-2xl font-black text-gray-900">{stat.totalHours} <span className="text-base font-medium text-gray-500">hrs</span></p>
                      </div>
                    </div>

                    {/* Daily Breakdown Table */}
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-6 font-semibold w-1/2">Date</th>
                          <th className="py-3 px-6 font-semibold w-1/2 text-right">Hours Worked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {stat.dailyBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan="2" className="py-4 px-6 text-center text-gray-400 text-sm">
                              No complete check-in/check-out pairs recorded yet.
                            </td>
                          </tr>
                        ) : (
                          stat.dailyBreakdown.map((day, dayIdx) => (
                            <tr key={dayIdx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 px-6">
                                <div className="flex items-center gap-2 text-gray-700 font-medium">
                                  <CalendarDays className="w-4 h-4 text-gray-400" />
                                  {day.dateStr}
                                </div>
                              </td>
                              <td className="py-3 px-6 text-right">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-blue-50 text-blue-700">
                                  {day.hours} h
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
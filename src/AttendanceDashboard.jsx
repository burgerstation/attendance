import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, RefreshCw, Calendar, Clock, User } from 'lucide-react';

// Use your public anon key here
const supabase = createClient('https://bdwpsqnqjvfxtxbzcxwa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3BzcW5xanZmeHR4YnpjeHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDY2NTQsImV4cCI6MjA5NzgyMjY1NH0.AS7zTcJ4MPnLgIp9PzWaf1zLjQVF9RnDd_b8xwTcUtQ');

export default function AttendanceDashboard() {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load data when the page opens
  useEffect(() => {
    fetchLogs();
  }, []);

  // Grabs data from Supabase
  async function fetchLogs() {
    setLoading(true);
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

  // Tells the local Node.js server to pull from the Hikvision machine
  async function handleSync() {
    setSyncing(true);
    try {
      // Calls your local bridge API running on port 3001
      const res = await fetch('http://localhost:3001/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error("Sync failed");
      
      // If sync works, refresh the Supabase data on the screen
      await fetchLogs(); 
    } catch (error) {
      alert("Failed to sync. Make sure your local Node.js server is running!");
    } finally {
      setSyncing(false);
    }
  }

  // Filters the table based on the search bar
  const filteredLogs = logs.filter(log => {
    const name = log.employees?.full_name?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Attendance Schedule</h1>
            <p className="text-gray-500 mt-1">Live tracking and employee logs</p>
          </div>
          
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Device...' : 'Refresh Data'}
          </button>
        </div>

        {/* Search Bar Container */}
        <div className="bg-white p-4 rounded-t-xl border border-gray-200 flex items-center gap-3">
          <Search className="text-gray-400 w-5 h-5 ml-2" />
          <input 
            type="text"
            placeholder="Search employees by name..."
            className="w-full outline-none text-gray-700 bg-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Data Table */}
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
                      {/* Name & Role */}
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
                      
                      {/* Date */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {dateObj.toLocaleDateString('en-GB', { timeZone: 'Africa/Casablanca' })}
                        </div>
                      </td>

                      {/* Time */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-gray-900 font-medium">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {dateObj.toLocaleTimeString('en-GB', { 
                             timeZone: 'Africa/Casablanca', 
                             hour: '2-digit', 
                             minute: '2-digit' 
                          })}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                          log.status === 'checkIn' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'checkIn' ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                          {log.status === 'checkIn' ? 'Checked In' : 'Checked Out'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
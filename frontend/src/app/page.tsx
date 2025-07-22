'use client';

import React, { useState, useEffect } from "react";
import { FiExternalLink, FiPlus, FiGlobe, FiServer, FiRefreshCw, FiPower, FiPlay, FiTrash } from 'react-icons/fi';

interface Site {
    id: string;
    name: string;
    description: string;
    url: string;
    port: string;
    status: string;
    createdAt: Date;
}

export default function Page() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [site, setSite] = useState<{ name: string; description: string }>({ name: "", description: "" });
    const [sites, setSites] = useState<Site[]>([]);

    // Get API base URL from environment or default to localhost
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async (): Promise<void> => {
        try {
            setInitialLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/sites`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(data)
            // Parse dates and ensure proper typing
            const sitesWithDates: Site[] = (data.sites || []).map((siteData: any) => ({
                ...siteData,
                id: String(siteData.id) || '',
                port: String(siteData.port || ''),
                createdAt: siteData.createdAt ? new Date(siteData.createdAt) : new Date()
            }));
            setSites(sitesWithDates);
        } catch (e) {
            console.error("Failed to fetch sites:", e);
            setError(`Failed to load sites: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        e.preventDefault();
        if (!site.name.trim() || !site.description.trim()) {
            setError('Both name and description are required');
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/sites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: site.name.trim(),
                    description: site.description.trim()
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Ensure proper typing for the new site
            const newSite: Site = {
                ...data.site,
                id: String(data.site.id) || '',
                port: String(data.site.port || ''),
                createdAt: data.site.createdAt ? new Date(data.site.createdAt) : new Date()
            };
            
            setSites(prevSites => [...prevSites, newSite]);
            setSite({ name: "", description: "" });
            
            // Refresh the sites list to ensure consistency
            setTimeout(() => {
                fetchSites();
            }, 2000);

        } catch (e) {
            console.error('Error creating site:', e);
            setError(e instanceof Error ? e.message : 'Failed to create site');
        } finally {
            setLoading(false);
        }
    };

    const handleStopSite = async (siteId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}/stop`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            // Refresh the sites list to show the updated status
            fetchSites();
        } catch (e) {
            console.error('Error stopping site:', e);
            setError(e instanceof Error ? e.message : 'Failed to stop site');
        }
    };

    const handleStartSite = async (siteId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}/start`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            // Refresh the sites list to show the updated status
            fetchSites();
        } catch (e) {
            console.error('Error starting site:', e);
            setError(e instanceof Error ? e.message : 'Failed to start site');
        }
    };

    const handleDeleteSite = async (siteId: string) => {
        if (!confirm('Are you sure you want to permanently delete this site and all its data? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            // Refresh the sites list to remove the deleted site
            fetchSites();
        } catch (e) {
            console.error('Error deleting site:', e);
            setError(e instanceof Error ? e.message : 'Failed to delete site');
        }
    };

    const getStatusIcon = (status: string) => {
        return status === 'running' ? (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        ) : (
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        );
    };

    const getStatusColor = (status: string): string => {
        switch(status) {
            case 'running':
                return 'bg-green-50 text-green-700 border border-green-200';
            case 'exited':
            case 'stopped':
                return 'bg-red-50 text-red-700 border border-red-200';
            case 'created':
            case 'restarting':
                return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
            default:
                return 'bg-gray-50 text-gray-700 border border-gray-200';
        }
    };

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (initialLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f6eede] to-[#ede2d0] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#a8fde8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[#666] text-lg">Loading your websites...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f6eede] to-[#ede2d0] p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <FiServer className="w-6 h-6 text-[#333]" />
                    </div>
                    <h1 className="text-3xl font-bold text-[#333] tracking-tight">Wordpress manager</h1>
                </div>
                <p className="text-[#666] text-lg">Manage your wordpress websites in one place</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Sites Grid */}
                <div className="xl:col-span-2">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 md:p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-[#333] flex items-center gap-3">
                                <FiGlobe className="w-6 h-6" />
                                Your Websites
                            </h2>
                            <div className="flex items-center gap-3">
                                <div className="text-sm text-[#666] bg-[#a8fde8]/20 px-3 py-1 rounded-full">
                                    {sites.length} total sites
                                </div>
                                {error && !loading && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
                                        <p className="text-sm text-red-700 text-center">{error}</p>
                                        <button 
                                            onClick={() => setError(null)}
                                            className="text-xs text-red-600 hover:text-red-800 mt-1 block mx-auto"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={() => fetchSites()}
                                    className="p-2 text-[#666] hover:text-[#2d5a4a] hover:bg-[#a8fde8]/20 rounded-lg transition-all duration-200"
                                    title="Refresh sites"
                                >
                                    <FiRefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                            {sites.map((siteData: Site) => (
                                <div 
                                    key={siteData.id} 
                                    className="group bg-white rounded-xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-[#a8fde8]/30 hover:-translate-y-1"
                                >
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-bold text-lg text-[#333] leading-tight group-hover:text-[#2d5a4a] transition-colors">
                                                    {siteData.name}
                                                </h3>
                                                <div className="flex items-center gap-1">
                                                    {getStatusIcon(siteData.status)}
                                                </div>
                                            </div>
                                            <p className="text-sm text-[#666] leading-relaxed mb-4 line-clamp-2">
                                                {siteData.description}
                                            </p>
                                            <div className="space-y-1 mb-4">
                                                {siteData.port && (
                                                    <p className="text-xs text-[#888]">Port: {siteData.port}</p>
                                                )}
                                                <p className="text-xs text-[#888]">Created: {formatDate(siteData.createdAt)}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider ${getStatusColor(siteData.status)}`}>
                                                {siteData.status}
                                            </span>
                                            {siteData.url && siteData.status === 'running' && (
                                                <a 
                                                    href={siteData.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="p-2 text-[#666] hover:text-[#2d5a4a] hover:bg-[#a8fde8]/20 rounded-lg transition-all duration-200 group/link"
                                                    title="Visit website"
                                                >
                                                    <FiExternalLink className="w-4 h-4 group-hover/link:rotate-12 transition-transform" />
                                                </a>
                                            )}

                                           {siteData.status === 'running' && (
                                               <button
                                                   onClick={() => handleStopSite(siteData.id)}
                                                   className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-all duration-200 group/stop"
                                                   title="Stop site"
                                               >
                                                   <FiPower className="w-4 h-4 group-hover/stop:scale-110 transition-transform" />
                                               </button>
                                           )}

                                           {siteData.status !== 'running' && (
                                               <button
                                                   onClick={() => handleStartSite(siteData.id)}
                                                   className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-100 rounded-lg transition-all duration-200 group/start"
                                                   title="Start site"
                                               >
                                                   <FiPlay className="w-4 h-4 group-hover/start:scale-110 transition-transform" />
                                               </button>
                                           )}
                                          
                                          {siteData.status !== 'running' && (
                                              <button
                                                  onClick={() => handleDeleteSite(siteData.id)}
                                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-all duration-200 group/delete"
                                                  title="Delete site permanently"
                                              >
                                                  <FiTrash className="w-4 h-4 group-hover/delete:scale-110 transition-transform" />
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              </div>
                         ))}
                     </div>
                      
                      {sites.length === 0 && (
                          <div className="text-center py-12">
                                <div className="w-16 h-16 bg-[#a8fde8]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FiGlobe className="w-8 h-8 text-[#666]" />
                                </div>
                                <p className="text-[#666] text-lg">No websites yet</p>
                                <p className="text-sm text-[#888] mt-1">Create your first site to get started</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Site Form */}
                <div className="xl:col-span-1">
                    <div className="sticky top-6">
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-gradient-to-br from-[#a8fde8] to-[#88e7d0] rounded-xl flex items-center justify-center mx-auto mb-3">
                                    <FiPlus className="w-6 h-6 text-[#2d5a4a]" />
                                </div>
                                <h2 className="text-xl font-bold text-[#333]">Create New Site</h2>
                                <p className="text-sm text-[#666] mt-1">Add a new website to your dashboard</p>
                            </div>
                            
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-[#333] mb-2">
                                        Site Name
                                    </label>
                                    <input
                                        type="text"
                                        value={site.name}
                                        onChange={(e) => setSite({ ...site, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#a8fde8]/50 focus:border-[#a8fde8] text-[#333] placeholder-gray-400 transition-all duration-200"
                                        placeholder="My Awesome Website"
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-[#333] mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={site.description}
                                        onChange={(e) => setSite({ ...site, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#a8fde8]/50 focus:border-[#a8fde8] text-[#333] placeholder-gray-400 resize-none transition-all duration-200"
                                        placeholder="Brief description of your website..."
                                        required
                                    />
                                </div>
                                
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }}
                                    disabled={loading || !site.name.trim() || !site.description.trim()}
                                    className="w-full bg-gradient-to-r from-[#a8fde8] to-[#88e7d0] text-[#2d5a4a] font-bold py-3 rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-[#2d5a4a]/30 border-t-[#2d5a4a] rounded-full animate-spin"></div>
                                            Creating WordPress Site...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <FiPlus className="w-4 h-4" />
                                            Create WordPress Site
                                        </span>
                                    )}
                                </button>
                                
                                {loading && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="text-sm text-blue-700 text-center">
                                            Setting up Docker containers... This may take a few minutes.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                    </div>
                </div>
            </div>
    );
}
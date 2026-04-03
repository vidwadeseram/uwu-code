"use client";

import { useEffect, useState, useCallback } from "react";

interface TicketProvider {
  id: string;
  provider: string;
  config: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProviderConfig {
  repo?: string;
  token?: string;
  boardId?: string;
  email?: string;
  apiToken?: string;
}

export default function TicketProvidersPage() {
  const [providers, setProviders] = useState<TicketProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProvider, setShowNewProvider] = useState(false);
  const [newProvider, setNewProvider] = useState<{ provider: string; config: ProviderConfig }>({
    provider: "github",
    config: {},
  });
  const [importing, setImporting] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/ticket-providers");
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleCreateProvider = async () => {
    if (!newProvider.provider || !newProvider.config) return;
    try {
      const res = await fetch("/api/ticket-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProvider),
      });
      if (res.ok) {
        setNewProvider({ provider: "github", config: {} });
        setShowNewProvider(false);
        loadProviders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await fetch(`/api/ticket-providers/${id}`, { method: "DELETE" });
      loadProviders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleImport = async (id: string) => {
    setImporting(id);
    try {
      const res = await fetch(`/api/ticket-providers/${id}/import`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Imported ${data.imported} tickets, updated ${data.updated} existing`);
      } else {
        alert(`Import failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Import failed");
    } finally {
      setImporting(null);
    }
  };

  const parseConfig = (configStr: string): ProviderConfig => {
    try {
      return JSON.parse(configStr);
    } catch {
      return {};
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">Ticket Providers</h1>
        <button
          type="button"
          onClick={() => setShowNewProvider(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          + Add Provider
        </button>
      </div>

      {showNewProvider && (
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <div className="mb-4">
            <label htmlFor="provider-type" className="block text-sm text-slate-400 mb-1">Provider Type</label>
            <select
              id="provider-type"
              value={newProvider.provider}
              onChange={(e) => setNewProvider({ ...newProvider, provider: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm"
            >
              <option value="github">GitHub Issues</option>
              <option value="jira" disabled>Jira (coming soon)</option>
            </select>
          </div>

          {newProvider.provider === "github" && (
            <>
              <div className="mb-4">
                <label htmlFor="github-repo" className="block text-sm text-slate-400 mb-1">
                  Repository (owner/repo)
                </label>
                <input
                  id="github-repo"
                  type="text"
                  value={newProvider.config.repo || ""}
                  onChange={(e) => setNewProvider({
                    ...newProvider,
                    config: { ...newProvider.config, repo: e.target.value },
                  })}
                  placeholder="vidwadeseram/uwu-code"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="github-token" className="block text-sm text-slate-400 mb-1">
                  Personal Access Token (optional)
                </label>
                <input
                  id="github-token"
                  type="password"
                  value={newProvider.config.token || ""}
                  onChange={(e) => setNewProvider({
                    ...newProvider,
                    config: { ...newProvider.config, token: e.target.value },
                  })}
                  placeholder="ghp_..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm"
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateProvider}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewProvider(false)}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <p>No ticket providers configured</p>
            <p className="text-sm mt-1">Add a provider to import tickets from GitHub or Jira</p>
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => {
              const config = parseConfig(provider.config);
              return (
                <div key={provider.id} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {provider.provider === "github" ? "🐙" : "📋"}
                      </span>
                      <div>
                        <h3 className="font-medium">{provider.provider === "github" ? "GitHub Issues" : "Jira"}</h3>
                        <p className="text-sm text-slate-400">
                          {provider.provider === "github" && config.repo}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleImport(provider.id)}
                        disabled={importing === provider.id || provider.provider === "jira"}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
                      >
                        {importing === provider.id ? "Importing..." : "Import Tickets"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Created: {new Date(provider.createdAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

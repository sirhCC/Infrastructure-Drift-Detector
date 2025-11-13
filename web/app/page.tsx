'use client';

import { useEffect, useState } from 'react';
import { api, type Project } from '../lib/api';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      const response = await api.getProjects();
      setProjects(response.data.projects);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of infrastructure drift across all projects
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Projects
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {projects.length}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Drift
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-orange-600">
              {projects.reduce((sum, p) => sum + p.driftCount, 0)}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Critical Status
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">
              {projects.filter(p => p.status === 'critical').length}
            </dd>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="mt-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Projects
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No projects yet. Create one to get started!
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {projects.map((project) => (
                <li key={project.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-blue-600 truncate">
                          {project.name}
                        </p>
                        <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          {project.iacType}
                        </span>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            project.status === 'healthy'
                              ? 'bg-green-100 text-green-800'
                              : project.status === 'warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          Drift count: {project.driftCount}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        {project.lastScan && (
                          <p>
                            Last scan:{' '}
                            {new Date(project.lastScan).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Getting Started */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900">Getting Started</h3>
        <div className="mt-2 text-sm text-blue-700">
          <p>To start monitoring your infrastructure:</p>
          <ol className="mt-2 list-decimal list-inside space-y-1">
            <li>Create a new project</li>
            <li>Configure your IaC path (Terraform or Pulumi)</li>
            <li>Run your first scan</li>
            <li>View drift results and trends</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

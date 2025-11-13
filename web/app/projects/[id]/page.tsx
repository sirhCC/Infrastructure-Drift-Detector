'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import TrendChart from '../../components/charts/TrendChart';
import DependencyGraph from '../../components/graphs/DependencyGraph';

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'graph'>('overview');

  useEffect(() => {
    loadProjectData();
  }, [params.id]);

  async function loadProjectData() {
    try {
      setLoading(true);
      const [projectRes, trendsRes, resourcesRes] = await Promise.all([
        api.getProject(params.id),
        api.getTrends(params.id, 30),
        api.getResources(params.id),
      ]);

      setProject(projectRes.data.project);
      setTrends(trendsRes.data.trends);
      setResources(resourcesRes.data.resources);
    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center py-12">Project not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {project.iacType} • Last scan:{' '}
              {project.lastScan
                ? new Date(project.lastScan).toLocaleString()
                : 'Never'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'trends', 'graph'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Drift
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-orange-600">
                  {project.driftCount}
                </dd>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Resources
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {resources.length}
                </dd>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Health Rate
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-green-600">
                  {resources.length > 0
                    ? Math.round(
                        ((resources.length - project.driftCount) /
                          resources.length) *
                          100
                      )
                    : 0}
                  %
                </dd>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              30-Day Drift Trend
            </h3>
            {trends.length > 0 ? (
              <>
                <div className="mb-6">
                  <TrendChart data={trends} type="area" showCritical={true} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Drift Over Time
                    </h4>
                    <TrendChart data={trends} type="line" showCritical={false} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Severity Breakdown
                    </h4>
                    <TrendChart data={trends} type="bar" showCritical={true} />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No trend data available yet
              </div>
            )}
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resource Dependency Graph
            </h3>
            {resources.length > 0 ? (
              <DependencyGraph
                resources={resources.map((r: any) => ({
                  id: r.resourceId,
                  name: r.resourceName,
                  type: r.resourceType || 'unknown',
                  status: r.hasDrift
                    ? r.severity === 'critical'
                      ? 'critical'
                      : 'warning'
                    : 'healthy',
                  dependencies: r.dependencies || [],
                }))}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                No resources to display
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

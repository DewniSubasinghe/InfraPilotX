import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';

const MonitoringPage = () => {
  const [orgs, setOrgs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [deployments, setDeployments] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showDeployArgocdForm, setShowDeployArgocdForm] = useState(false);
  const [deploymentYaml, setDeploymentYaml] = useState('');
  const [manifestsExist, setManifestsExist] = useState(false);
  const [loading, setLoading] = useState({
    orgs: false,
    repos: false,
    templates: false,
    creating: false,
    deploying: false,
    deployments: false,
    checking: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { register, handleSubmit } = useForm();

  // Fetch organizations
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        setLoading(prev => ({ ...prev, orgs: true }));
        const res = await axios.get('http://localhost:5000/api/github/connections');
        setOrgs(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch organizations');
      } finally {
        setLoading(prev => ({ ...prev, orgs: false }));
      }
    };
    fetchOrgs();
  }, []);

  // Fetch repositories when org is selected
  useEffect(() => {
    const fetchRepos = async () => {
      if (!selectedOrg) {
        setRepos([]);
        setSelectedRepo('');
        return;
      }

      try {
        setLoading(prev => ({ ...prev, repos: true }));
        const res = await axios.get(`http://localhost:5000/api/github/repos/${selectedOrg}`);
        setRepos(res.data.repositories || []);
        setSelectedRepo('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch repositories');
      } finally {
        setLoading(prev => ({ ...prev, repos: false }));
      }
    };

    fetchRepos();
  }, [selectedOrg]);

  // Check for existing manifests when repo is selected
  useEffect(() => {
    const checkManifests = async () => {
      if (!selectedOrg || !selectedRepo) {
        setManifestsExist(false);
        return;
      }

      try {
        setLoading(prev => ({ ...prev, checking: true }));
        const response = await axios.get('http://localhost:5000/api/monitoring/check-manifests', {
          params: { orgName: selectedOrg, repoName: selectedRepo }
        });
        setManifestsExist(response.data.exists);
      } catch (error) {
        setManifestsExist(false);
      } finally {
        setLoading(prev => ({ ...prev, checking: false }));
      }
    };

    checkManifests();
  }, [selectedRepo, selectedOrg]);

  // Fetch monitoring deployments
  useEffect(() => {
    const fetchDeployments = async () => {
      try {
        setLoading(prev => ({ ...prev, deployments: true }));
        const res = await axios.get('http://localhost:5000/api/monitoring/list');
        setDeployments(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch deployments');
      } finally {
        setLoading(prev => ({ ...prev, deployments: false }));
      }
    };
    fetchDeployments();
  }, []);

  // Load template
  const loadTemplate = async () => {
    try {
      setLoading(prev => ({ ...prev, templates: true }));
      setError(null);

      const response = await axios.get('http://localhost:5000/api/monitoring/template');

      if (response.data.success) {
        setDeploymentYaml(response.data.deployment);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to load template');
    } finally {
      setLoading(prev => ({ ...prev, templates: false }));
    }
  };

  // Create manifests
  const createManifests = async () => {
    try {
      setLoading(prev => ({ ...prev, creating: true }));
      setError(null);

      const response = await axios.post('http://localhost:5000/api/monitoring/create-manifests', {
        orgName: selectedOrg,
        repoName: selectedRepo
      });

      setSuccess(response.data.message);
      setManifestsExist(true);

      // Refresh deployments list
      const deploymentsRes = await axios.get('http://localhost:5000/api/monitoring/list');
      setDeployments(deploymentsRes.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create manifests');
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  };

  // Deploy via ArgoCD
  const deployArgocd = async (data) => {
    try {
      setLoading(prev => ({ ...prev, deploying: true }));
      setError(null);

      const response = await axios.post('http://localhost:5000/api/monitoring/deploy-argocd', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        destServer: data.destServer,
        destNamespace: data.destNamespace
      });

      setSuccess(response.data.message);

      // Refresh deployments list
      const deploymentsRes = await axios.get('http://localhost:5000/api/monitoring/list');
      setDeployments(deploymentsRes.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to deploy via ArgoCD');
    } finally {
      setLoading(prev => ({ ...prev, deploying: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 p-8">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-indigo-700 mb-6">Grafana Monitoring</h1>

        {error && (
          <div className="p-4 mb-6 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 mb-6 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Organization and Repository Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-gray-700 mb-2">Organization</label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="w-full p-2 border rounded"
              disabled={loading.orgs}
            >
              <option value="">Select Organization</option>
              {orgs.map(org => (
                <option key={org._id} value={org.orgName}>{org.orgName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Repository</label>
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="w-full p-2 border rounded"
              disabled={!selectedOrg || loading.repos}
            >
              <option value="">Select Repository</option>
              {repos.map(repo => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Information */}
        {selectedRepo && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                manifestsExist ? 'bg-green-500' : 'bg-yellow-500'
              }`}></span>
              <span>
                {manifestsExist 
                  ? 'Grafana manifests found in repository'
                  : 'No Grafana manifests found - create them first'}
              </span>
            </div>
          </div>
        )}

        {/* Grafana Deployment Options */}
        <div className="mb-8 p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Grafana Deployment</h2>
          
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => {
                setShowTemplateForm(true);
                setShowDeployArgocdForm(false);
                loadTemplate();
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              disabled={!selectedRepo}
            >
              View Template
            </button>
            <button
              onClick={() => {
                setShowDeployArgocdForm(true);
                setShowTemplateForm(false);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              disabled={!selectedRepo || !manifestsExist}
            >
              Deploy via ArgoCD
            </button>
          </div>

          {/* Template View */}
          {showTemplateForm && (
            <div className="p-4 border rounded-lg bg-gray-50 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Grafana Deployment Template</h3>
                <button
                  onClick={() => setShowTemplateForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>

              {loading.templates ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                  <p className="mt-2">Loading template...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Deployment YAML</label>
                    <textarea
                      value={deploymentYaml}
                      readOnly
                      className="w-full h-64 p-2 border rounded font-mono text-sm"
                    />
                  </div>
                  <button
                    onClick={createManifests}
                    disabled={loading.creating || !selectedOrg || !selectedRepo}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-indigo-300"
                  >
                    {loading.creating ? 'Creating...' : 'Create Manifests'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ArgoCD Deployment */}
          {showDeployArgocdForm && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Deploy Grafana via ArgoCD</h3>
                <button
                  onClick={() => setShowDeployArgocdForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleSubmit(deployArgocd)} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2">Cluster URL</label>
                  <input
                    type="text"
                    {...register('destServer', { required: true })}
                    className="w-full p-2 border rounded"
                    defaultValue="https://kubernetes.default.svc"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For Minikube, use: https://kubernetes.default.svc
                  </p>
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Namespace</label>
                  <input
                    type="text"
                    {...register('destNamespace')}
                    className="w-full p-2 border rounded"
                    defaultValue="default"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading.deploying || !selectedOrg || !selectedRepo || !manifestsExist}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-300"
                >
                  {loading.deploying ? 'Deploying...' : 'Deploy via ArgoCD'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Monitoring Deployments */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Grafana Deployments</h2>
          {loading.deployments ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
              <p className="mt-2">Loading deployments...</p>
            </div>
          ) : deployments.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              No Grafana deployments found
            </div>
          ) : (
            <div className="space-y-4">
              {deployments.map((deployment, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">
                      Deployed on {new Date(deployment.deployedAt).toLocaleString()}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      deployment.status === 'Deployed' || deployment.status === 'Deployed via ArgoCD'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {deployment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitoringPage;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';

const AppManagementPage = () => {
  const [orgs, setOrgs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [apps, setApps] = useState([]);
  const [showManifestForm, setShowManifestForm] = useState(false);
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [deploymentYaml, setDeploymentYaml] = useState('');
  const [loading, setLoading] = useState({
    manifests: false,
    templates: false,
    creating: false,
    deploying: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { register, handleSubmit, watch, reset } = useForm();

  const appName = watch('appName', '');
  const image = watch('image', '');

  // Fetch organizations
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/github/connections');
        setOrgs(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch organizations');
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
        const res = await axios.get(`http://localhost:5000/api/github/repos/${selectedOrg}`);
        setRepos(res.data.repositories || []);
        setSelectedRepo('');
        setApps([]);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch repositories');
      }
    };

    fetchRepos();
  }, [selectedOrg]);

  // Fetch manifests when repo is selected
  useEffect(() => {
    const fetchManifests = async () => {
      if (!selectedOrg || !selectedRepo) {
        setApps([]);
        return;
      }

      try {
        setLoading(prev => ({ ...prev, manifests: true }));
        setError(null);

        const response = await axios.get('http://localhost:5000/api/app/list-manifests', {
          params: { orgName: selectedOrg, repoName: selectedRepo }
        });

        if (response.data.success && response.data.exists) {
          setApps(response.data.apps);
        } else {
          setApps([]);
        }
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to fetch manifests');
      } finally {
        setLoading(prev => ({ ...prev, manifests: false }));
      }
    };

    fetchManifests();
  }, [selectedRepo, selectedOrg]);

  // Load template when appName or image changes
  useEffect(() => {
    const loadTemplate = async () => {
      if (!appName || !image) return;

      try {
        setLoading(prev => ({ ...prev, templates: true }));
        setError(null);

        const response = await axios.get('http://localhost:5000/api/app/templates', {
          params: { appName, image }
        });

        if (response.data.success) {
          setDeploymentYaml(response.data.deployment);
        }
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to load template');
      } finally {
        setLoading(prev => ({ ...prev, templates: false }));
      }
    };

    loadTemplate();
  }, [appName, image]);

  // Create manifest
  const onCreateManifest = async (data) => {
    try {
      setLoading(prev => ({ ...prev, creating: true }));
      setError(null);

      const response = await axios.post('http://localhost:5000/api/app/create-manifests', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        appName: data.appName,
        deploymentYaml: deploymentYaml
      });

      setSuccess(response.data.message);
      reset();
      setDeploymentYaml('');

      // Refresh manifests list
      const manifestsRes = await axios.get('http://localhost:5000/api/app/list-manifests', {
        params: { orgName: selectedOrg, repoName: selectedRepo }
      });
      setApps(manifestsRes.data.apps || []);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create manifest');
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  };

  // Deploy application
  const onDeployApp = async (data) => {
    try {
      setLoading(prev => ({ ...prev, deploying: true }));
      setError(null);

      const response = await axios.post('http://localhost:5000/api/app/deploy', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        appName: selectedApp,
        destServer: data.destServer,
        destNamespace: data.destNamespace
      });

      setSuccess(response.data.message);
      setSelectedApp(null);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to deploy application');
    } finally {
      setLoading(prev => ({ ...prev, deploying: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 p-8">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-indigo-700 mb-6">Application Management</h1>

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
              disabled={!selectedOrg || repos.length === 0}
            >
              <option value="">Select Repository</option>
              {repos.map(repo => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Application List */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Applications</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowManifestForm(true);
                  setShowDeployForm(false);
                  reset();
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                disabled={!selectedRepo}
              >
                Create Manifest
              </button>
              <button
                onClick={() => {
                  setShowDeployForm(true);
                  setShowManifestForm(false);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                disabled={!selectedRepo || apps.length === 0}
              >
                Deploy Application
              </button>
            </div>
          </div>

          {loading.manifests ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
              <p className="mt-2">Loading applications...</p>
            </div>
          ) : apps.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              {selectedRepo ? 'No applications found in manifests folder' : 'Select a repository to view applications'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apps.map((app, index) => (
                <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{app.name}</h3>
                      <p className="text-sm text-gray-600">Path: {app.path}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedApp(app.name);
                        setShowDeployForm(true);
                        setShowManifestForm(false);
                      }}
                      className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                    >
                      Deploy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Manifest Form */}
        {showManifestForm && (
          <div className="mb-8 p-4 border rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create Application Manifest</h2>
              <button
                onClick={() => {
                  setShowManifestForm(false);
                  reset();
                  setDeploymentYaml('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit(onCreateManifest)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Application Name</label>
                  <input
                    type="text"
                    {...register('appName', { required: true })}
                    className="w-full p-2 border rounded"
                    placeholder="my-app"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Container Image</label>
                  <input
                    type="text"
                    {...register('image', { required: true })}
                    className="w-full p-2 border rounded"
                    placeholder="nginx:latest"
                  />
                </div>
              </div>

              {loading.templates ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                  <p className="mt-2">Generating template...</p>
                </div>
              ) : (
                <div>
                  <label className="block text-gray-700 mb-2">Deployment YAML</label>
                  <textarea
                    value={deploymentYaml}
                    onChange={(e) => setDeploymentYaml(e.target.value)}
                    className="w-full h-96 p-2 border rounded font-mono text-sm"
                    spellCheck="false"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowManifestForm(false);
                    reset();
                    setDeploymentYaml('');
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading.creating || !appName || !image || !deploymentYaml}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {loading.creating ? 'Creating...' : 'Create Manifest'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Deploy Application Form */}
        {showDeployForm && (
          <div className="mb-8 p-4 border rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Deploy Application</h2>
              <button
                onClick={() => {
                  setShowDeployForm(false);
                  setSelectedApp(null);
                  reset();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit(onDeployApp)} className="space-y-4">
              {selectedApp ? (
                <div className="p-3 bg-blue-50 rounded">
                  <p className="font-medium">Selected Application:</p>
                  <p>{selectedApp}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-gray-700 mb-2">Select Application</label>
                  <select
                    {...register('appName', { required: true })}
                    onChange={(e) => setSelectedApp(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select an application</option>
                    {apps.map((app, index) => (
                      <option key={index} value={app.name}>{app.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading.deploying || !selectedApp}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-300"
                >
                  {loading.deploying ? 'Deploying...' : 'Deploy Application'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppManagementPage;
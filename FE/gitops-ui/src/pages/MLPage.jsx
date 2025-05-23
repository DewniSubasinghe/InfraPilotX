import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';

const MLPage = () => {
  const [orgs, setOrgs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [models, setModels] = useState([]);
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [showDeployArgocdForm, setShowDeployArgocdForm] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [deploymentYaml, setDeploymentYaml] = useState('');
  const [loading, setLoading] = useState({
    orgs: false,
    repos: false,
    models: false,
    templates: false,
    deploying: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { register, handleSubmit, watch, reset } = useForm();

  const modelName = watch('modelName', '');
  const image = watch('image', '');

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

  // Fetch models when repo is selected
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedOrg || !selectedRepo) {
        setModels([]);
        return;
      }

      try {
        setLoading(prev => ({ ...prev, models: true }));
        const response = await axios.get('http://localhost:5000/api/ml/list', {
          params: { orgName: selectedOrg, repoName: selectedRepo }
        });

        if (response.data.success && response.data.exists) {
          setModels(response.data.models);
        } else {
          setModels([]);
        }
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to fetch ML models');
      } finally {
        setLoading(prev => ({ ...prev, models: false }));
      }
    };

    fetchModels();
  }, [selectedRepo, selectedOrg]);

  // Load template when model config changes
  useEffect(() => {
    const loadTemplate = async () => {
      if (!modelName || !image) return;

      try {
        setLoading(prev => ({ ...prev, templates: true }));
        const response = await axios.get('http://localhost:5000/api/ml/templates', {
          params: { modelName, image }
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
  }, [modelName, image]);

  // Create manifest
  const onCreateManifest = async (data) => {
    try {
      setLoading(prev => ({ ...prev, deploying: true }));
      setError(null);

      const response = await axios.post('http://localhost:5000/api/ml/deploy', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        modelName: data.modelName,
        deploymentYaml: deploymentYaml
      });

      setSuccess(response.data.message);
      reset();
      setDeploymentYaml('');

      // Refresh models list
      const modelsRes = await axios.get('http://localhost:5000/api/ml/list', {
        params: { orgName: selectedOrg, repoName: selectedRepo }
      });
      setModels(modelsRes.data.models || []);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create manifest');
    } finally {
      setLoading(prev => ({ ...prev, deploying: false }));
    }
  };

  // Deploy via ArgoCD
  const onDeployArgocd = async (data) => {
    try {
      setLoading(prev => ({ ...prev, deploying: true }));
      setError(null);

      const response = await axios.post('http://localhost:5000/api/ml/deploy-argocd', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        modelName: selectedModel || data.modelName,
        destServer: data.destServer,
        destNamespace: data.destNamespace
      });

      setSuccess(response.data.message);
      setSelectedModel(null);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to deploy via ArgoCD');
    } finally {
      setLoading(prev => ({ ...prev, deploying: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 p-8">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-indigo-700 mb-6">ML Model Management</h1>

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

        {/* Model List */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">ML Models</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowDeployForm(true);
                  setShowDeployArgocdForm(false);
                  reset();
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                disabled={!selectedRepo}
              >
                Create Manifest
              </button>
              <button
                onClick={() => {
                  setShowDeployArgocdForm(true);
                  setShowDeployForm(false);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                disabled={!selectedRepo || models.length === 0}
              >
                Deploy via ArgoCD
              </button>
            </div>
          </div>

          {selectedModel && (
            <div className="p-3 bg-blue-50 rounded mb-4 flex justify-between items-center">
              <p className="font-medium">Selected Model: {selectedModel}</p>
              <button
                onClick={() => setSelectedModel(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          )}

          {loading.models ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
              <p className="mt-2">Loading models...</p>
            </div>
          ) : models.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              {selectedRepo ? 'No ML models found' : 'Select a repository to view models'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((model, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg hover:bg-gray-50 cursor-pointer ${selectedModel === model.name ? 'bg-blue-50 border-blue-300' : ''}`}
                  onClick={() => {
                    setSelectedModel(model.name);
                    setShowDeployArgocdForm(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{model.name}</h3>
                      <p className="text-sm text-gray-600">Path: {model.path}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Manifest Form */}
        {showDeployForm && (
          <div className="mb-8 p-4 border rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create ML Model Manifest</h2>
              <button
                onClick={() => {
                  setShowDeployForm(false);
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
                  <label className="block text-gray-700 mb-2">Model Name</label>
                  <input
                    type="text"
                    {...register('modelName', { required: true })}
                    className="w-full p-2 border rounded"
                    placeholder="image-classifier"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Container Image</label>
                  <input
                    type="text"
                    {...register('image', { required: true })}
                    className="w-full p-2 border rounded"
                    placeholder="tensorflow/serving:latest"
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
                    className="w-full h-64 p-2 border rounded font-mono text-sm"
                    spellCheck="false"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading.deploying || !modelName || !image || !deploymentYaml}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {loading.deploying ? 'Creating...' : 'Create Manifest'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Deploy via ArgoCD Form */}
        {showDeployArgocdForm && (
          <div className="mb-8 p-4 border rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Deploy via ArgoCD</h2>
              <button
                onClick={() => {
                  setShowDeployArgocdForm(false);
                  setSelectedModel(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit(onDeployArgocd)} className="space-y-4">
              {selectedModel ? null : (
                <div>
                  <label className="block text-gray-700 mb-2">Select Model</label>
                  <select
                    {...register('modelName', { required: !selectedModel })}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select a model</option>
                    {models.map((model, index) => (
                      <option key={index} value={model.name}>{model.name}</option>
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
              <button
                type="submit"
                disabled={loading.deploying || (!selectedModel && !watch('modelName'))}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-300"
              >
                {loading.deploying ? 'Deploying...' : 'Deploy via ArgoCD'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default MLPage;
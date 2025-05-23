import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';

const CICDPage = () => {
  const [orgs, setOrgs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [folderStatus, setFolderStatus] = useState('');
  const [language, setLanguage] = useState('java');
  const [dockerImage, setDockerImage] = useState('');
  const [pipelineContent, setPipelineContent] = useState('');
  const [loading, setLoading] = useState({
    checking: false,
    creating: false,
    template: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { register, handleSubmit, reset } = useForm();

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
        setPipelines([]);
        setFolderStatus('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch repositories');
      }
    };

    fetchRepos();
  }, [selectedOrg]);

  // Check CICD folder when repo is selected
  useEffect(() => {
    const checkCICDFolder = async () => {
      if (!selectedOrg || !selectedRepo) {
        setPipelines([]);
        setFolderStatus('');
        return;
      }

      try {
        setLoading(prev => ({ ...prev, checking: true }));
        setError(null);

        // First check if CICD folder exists
        const folderRes = await axios.get('http://localhost:5000/api/cicd/check-cicd', {
          params: { orgName: selectedOrg, repoName: selectedRepo }
        });

        // Then get existing pipelines if folder exists
        if (folderRes.data.success && folderRes.data.exists) {
          const pipelinesRes = await axios.get('http://localhost:5000/api/cicd/existing-pipelines', {
            params: { orgName: selectedOrg, repoName: selectedRepo }
          });
          setPipelines(pipelinesRes.data.items || []);
        } else {
          setPipelines([]);
        }

        setFolderStatus(folderRes.data.message);
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to check CICD folder');
        console.error('API Error:', error);
      } finally {
        setLoading(prev => ({ ...prev, checking: false }));
      }
    };

    checkCICDFolder();
  }, [selectedRepo, selectedOrg]);

  // Load template
  const loadTemplate = async () => {
    if (!selectedOrg || !selectedRepo || !dockerImage.trim()) {
      setError('Please select organization, repository and enter Docker image name');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, template: true }));
      setError(null);

      const response = await axios.get('http://localhost:5000/api/cicd/template', {
        params: { 
          language, 
          dockerImage: dockerImage.trim() 
        }
      });

      if (response.data.success) {
        setPipelineContent(response.data.content);
        setSuccess('Template loaded successfully');
      } else {
        setError(response.data.message || 'Failed to load template');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to load template');
      console.error('Template Error:', error);
    } finally {
      setLoading(prev => ({ ...prev, template: false }));
    }
  };

  // Create pipeline
  const onSubmit = async (data) => {
    if (!pipelineContent) {
      setError('Pipeline content cannot be empty');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, creating: true }));
      setError(null);
      setSuccess(null);

      const response = await axios.post('http://localhost:5000/api/cicd/create-pipeline', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        pipelineName: data.pipelineName,
        pipelineContent
      });

      setSuccess(response.data.message);

      // Refresh pipeline list
      const pipelinesRes = await axios.get('http://localhost:5000/api/cicd/existing-pipelines', {
        params: { orgName: selectedOrg, repoName: selectedRepo }
      });
      
      setPipelines(pipelinesRes.data.items || []);
      reset({ pipelineName: '' });
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create pipeline');
      console.error('Creation Error:', error);
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 p-8">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-indigo-700 mb-6">CI/CD Pipeline Management</h1>

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

        {selectedRepo && (
          <>
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h2 className="text-lg font-semibold mb-2">Pipeline Status</h2>
              <p className="text-gray-700 mb-3">
                {loading.checking ? 'Checking...' : folderStatus}
              </p>
              
              {pipelines.length > 0 && (
                <>
                  <h3 className="font-medium mb-2">Existing Pipelines:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {pipelines.map((pipeline, i) => (
                      <div key={i} className="p-2 border rounded bg-white flex justify-between items-center">
                        <span className="font-mono text-sm">{pipeline.name.replace('.groovy', '')}</span>
                        <a
                          href={pipeline.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h2 className="text-lg font-semibold mb-4">Create New Pipeline</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 mb-2">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="java">Java</option>
                    <option value="python">Python</option>
                    <option value="nodejs">Node.js</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Docker Image</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                      library/
                    </span>
                    <input
                      type="text"
                      value={dockerImage}
                      onChange={(e) => setDockerImage(e.target.value)}
                      className="flex-1 p-2 border rounded-r"
                      placeholder="image-name"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={loadTemplate}
                    disabled={!dockerImage.trim() || loading.template}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
                  >
                    {loading.template ? 'Loading...' : 'Load Template'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Pipeline Name</label>
                  <input
                    type="text"
                    {...register('pipelineName', { required: true })}
                    className="w-full p-2 border rounded"
                    placeholder="my-pipeline"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Pipeline Content</label>
                  <textarea
                    value={pipelineContent}
                    onChange={(e) => setPipelineContent(e.target.value)}
                    className="w-full h-64 p-2 border rounded font-mono text-sm"
                    placeholder="Load a template or write your pipeline script here"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading.creating || !pipelineContent}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {loading.creating ? 'Creating...' : 'Create Pipeline'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CICDPage;
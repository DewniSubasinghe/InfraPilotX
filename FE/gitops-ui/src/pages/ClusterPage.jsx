import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';

const ClusterPage = () => {
  const [orgs, setOrgs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fetchingProjects, setFetchingProjects] = useState(false);
  const { register, handleSubmit, watch } = useForm();

  const projectName = watch('projectName', '');
  const clusterUrl = watch('clusterUrl', 'https://kubernetes.default.svc');
  const namespace = watch('namespace', 'default');

  // Fetch connected orgs
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        setLoading(true);
        const res = await axios.get('http://localhost:5000/api/github/connections');
        setOrgs(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch organizations');
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  // Fetch repos when org is selected
  const fetchRepos = async (orgName) => {
    if (!orgName) {
      setRepos([]);
      setSelectedRepo('');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`http://localhost:5000/api/github/repos/${orgName}`);
      setRepos(res.data.repositories);
      setSelectedRepo('');
      setProjects([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  // Fetch projects when repo is selected
  useEffect(() => {
    const fetchProjects = async () => {
      if (!selectedOrg || !selectedRepo) {
        setProjects([]);
        return;
      }

      try {
        setFetchingProjects(true);
        setError(null);
       
        // First verify the projects folder exists
        await axios.get('http://localhost:5000/api/cluster/check-projects-folder', {
          params: {
            orgName: selectedOrg,
            repoName: selectedRepo
          }
        });

        // Then fetch existing projects
        const projectsRes = await axios.get('http://localhost:5000/api/cluster/existing-projects', {
          params: {
            orgName: selectedOrg,
            repoName: selectedRepo
          }
        });
       
        setProjects(projectsRes.data);
      } catch (error) {
        if (error.response?.status === 404) {
          setError(`Projects folder not found in repository ${selectedRepo}`);
        } else {
          setError(error.response?.data?.message || 'Failed to fetch projects');
        }
      } finally {
        setFetchingProjects(false);
      }
    };

    if (selectedRepo) {
      fetchProjects();
    }
  }, [selectedRepo, selectedOrg]);

  const handleRepoChange = (e) => {
    const repo = e.target.value;
    setSelectedRepo(repo);
  };

  // Create project
  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError(null);
     
      const repoUrl = `https://github.com/${selectedOrg}/${selectedRepo}`;
      const res = await axios.post('http://localhost:5000/api/cluster/create-project', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        projectName: data.projectName,
        clusterUrl: data.clusterUrl,
        namespace: data.namespace,
        repoUrl: repoUrl
      });
     
      setSuccess(res.data.message);
      
      // Refresh projects list after creation
      const projectsRes = await axios.get('http://localhost:5000/api/cluster/existing-projects', {
        params: {
          orgName: selectedOrg,
          repoName: selectedRepo
        }
      });
      setProjects(projectsRes.data);
    } catch (error) {
      if (error.response?.status === 422) {
        setError(`Project "${data.projectName}" already exists in the repository`);
      } else {
        setError(error.response?.data?.message || 'Failed to create project');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 p-8">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-indigo-700 mb-6">Cluster Management</h1>

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
              onChange={(e) => {
                setSelectedOrg(e.target.value);
                fetchRepos(e.target.value);
              }}
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
              onChange={handleRepoChange}
              className="w-full p-2 border rounded"
              disabled={!selectedOrg}
            >
              <option value="">Select Repository</option>
              {repos.map(repo => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Projects list shown right below the dropdowns */}
        {fetchingProjects && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-center">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-600"></div>
            <span className="ml-2">Loading projects...</span>
          </div>
        )}

        {selectedRepo && projects.length > 0 && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h2 className="text-lg font-semibold mb-3">Existing Projects in Repository</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {projects.map(project => (
                <div key={project.name} className="p-2 border rounded bg-white flex justify-between items-center">
                  <span className="font-mono text-sm">{project.name.replace('.yaml', '')}</span>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    View YAML
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedRepo && projects.length === 0 && !fetchingProjects && (
          <div className="mb-6 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
            No projects found in this repository. Create your first project below.
          </div>
        )}

        {selectedRepo && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Project Name</label>
              <input
                type="text"
                {...register('projectName', {
                  required: true,
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message: 'Only lowercase letters, numbers, and hyphens allowed'
                  }
                })}
                className="w-full p-2 border rounded"
                placeholder="my-project"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lowercase letters, numbers and hyphens only
              </p>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Cluster URL</label>
              <input
                type="text"
                {...register('clusterUrl', { required: true })}
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
                {...register('namespace')}
                className="w-full p-2 border rounded"
                defaultValue="default"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ClusterPage;
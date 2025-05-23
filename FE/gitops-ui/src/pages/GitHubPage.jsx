import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { FaTrash } from 'react-icons/fa';

const GitHubPage = () => {
  const [orgs, setOrgs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [language, setLanguage] = useState('java');
  const [templates, setTemplates] = useState({
    dockerfile: { content: '', description: '' },
    jenkinsfile: { content: '', description: '' }
  });
  const [connectionStatus, setConnectionStatus] = useState({});
  const [orgInput, setOrgInput] = useState('');
  const [deletingOrg, setDeletingOrg] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  // Fetch connected orgs
  const fetchConnectedOrgs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/github/connections');
      setOrgs(response.data);
      const status = {};
      response.data.forEach(org => {
        status[org.orgName] = 'connected';
      });
      setConnectionStatus(status);
    } catch (error) {
      console.error('Error fetching orgs:', error);
    }
  };

  // Delete organization connection
  const deleteOrgConnection = async (orgName) => {
    try {
      setDeletingOrg(orgName);
      await axios.delete(`http://localhost:5000/api/github/connections/${orgName}`);
      
      // Update local state
      setOrgs(prevOrgs => prevOrgs.filter(org => org.orgName !== orgName));
      setConnectionStatus(prev => {
        const newStatus = {...prev};
        delete newStatus[orgName];
        return newStatus;
      });
      
      // Reset selection if deleted org was selected
      if (selectedOrg === orgName) {
        setSelectedOrg('');
        setSelectedRepo('');
        setRepos([]);
      }
      
      alert(`Organization ${orgName} disconnected successfully`);
    } catch (error) {
      console.error('Error deleting org connection:', error);
      alert(`Failed to disconnect organization: ${error.response?.data?.message || error.message}`);
    } finally {
      setDeletingOrg(null);
    }
  };

  // Fetch repos for selected org
  const fetchReposForOrg = async (orgName) => {
    try {
      if (!orgName) return;
      const response = await axios.get(`http://localhost:5000/api/github/repos/${orgName}`);
      setRepos(response.data.repositories || []);
    } catch (error) {
      console.error('Error fetching repos:', error);
      setRepos([]);
    }
  };

  // Load template when language changes
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/github/templates/${language}`);
        setTemplates({
          dockerfile: response.data.dockerfile,
          jenkinsfile: response.data.jenkinsfile
        });
      } catch (error) {
        console.error('Error loading template:', error);
      }
    };
    loadTemplate();
  }, [language]);

  // Set GitHub token
  const onTokenSubmit = async (data) => {
    try {
      await axios.post('http://localhost:5000/api/github/set-token', {
        token: data.token
      });
      alert('GitHub token stored successfully');
      reset();
    } catch (error) {
      console.error('Error storing token:', error);
      alert(`Failed to store GitHub token: ${error.response?.data?.message || error.message}`);
    }
  };

  // Connect to new org
  const connectNewOrg = async () => {
    try {
      if (!orgInput) {
        alert('Please enter an organization name');
        return;
      }
      
      setConnectionStatus(prev => ({ ...prev, [orgInput]: 'connecting' }));
      const response = await axios.post('http://localhost:5000/api/github/connect', { 
        orgName: orgInput 
      });
      
      if (response.data.existing) {
        alert(`Already connected to ${orgInput}`);
      } else {
        alert(`Successfully connected to ${orgInput} with ${response.data.org.reposCount} repositories`);
        setSelectedOrg(orgInput);
      }
      
      fetchConnectedOrgs();
    } catch (error) {
      console.error('Error connecting org:', error);
      setConnectionStatus(prev => ({ ...prev, [orgInput]: 'error' }));
      alert(`Failed to connect: ${error.response?.data?.message || error.message}`);
    }
  };

  // Add files to repo
  const addFilesToRepo = async () => {
    try {
      if (!selectedOrg || !selectedRepo) {
        alert('Please select both organization and repository');
        return;
      }
      
      if (!templates.dockerfile.content && !templates.jenkinsfile.content) {
        alert('Please provide at least one file content');
        return;
      }
      
      await axios.post('http://localhost:5000/api/github/add-files', {
        orgName: selectedOrg,
        repoName: selectedRepo,
        dockerfile: templates.dockerfile.content,
        jenkinsfile: templates.jenkinsfile.content
      });
      
      alert('Files added to repository successfully');
    } catch (error) {
      console.error('Error adding files:', error);
      alert(`Failed to add files: ${error.response?.data?.message || error.message}`);
    }
  };

  // Handle template content change
  const handleTemplateChange = (fileType, content) => {
    setTemplates(prev => ({
      ...prev,
      [fileType]: {
        ...prev[fileType],
        content
      }
    }));
  };

  useEffect(() => {
    fetchConnectedOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchReposForOrg(selectedOrg);
    } else {
      setRepos([]);
      setSelectedRepo('');
    }
  }, [selectedOrg]);

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 p-8">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-indigo-700 mb-6">GitHub Integration</h1>
        
        {/* Token Configuration */}
        <div className="mb-8 p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">GitHub Token Configuration</h2>
          <form onSubmit={handleSubmit(onTokenSubmit)} className="flex flex-col space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">GitHub Personal Access Token</label>
              <input
                type="password"
                {...register('token', { required: true })}
                placeholder="ghp_your_token_here"
                className="w-full p-2 border rounded"
              />
              <p className="text-sm text-gray-500 mt-1">
                Token needs <code>repo</code>, <code>admin:org</code>, and <code>workflow</code> scopes
              </p>
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Save Token
            </button>
          </form>
        </div>
        
        {/* Organization Connection */}
        <div className="mb-8 p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Connect Organization</h2>
          <div className="flex mb-4">
            <input
              type="text"
              placeholder="Enter GitHub organization name"
              value={orgInput}
              onChange={(e) => setOrgInput(e.target.value)}
              className="flex-grow p-2 border rounded-l"
            />
            <button
              onClick={connectNewOrg}
              className="bg-indigo-600 text-white px-4 py-2 rounded-r hover:bg-indigo-700"
              disabled={!orgInput || connectionStatus[orgInput] === 'connecting'}
            >
              {connectionStatus[orgInput] === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          </div>
          
          <h3 className="font-medium mb-2">Connected Organizations</h3>
          {orgs.length === 0 ? (
            <p className="text-gray-500">No organizations connected yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {orgs.map((org) => (
                <div 
                  key={org._id} 
                  className={`p-3 rounded border flex items-center cursor-pointer ${selectedOrg === org.orgName ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50'}`}
                  onClick={() => setSelectedOrg(org.orgName)}
                >
                  {org.avatarUrl && (
                    <img 
                      src={org.avatarUrl} 
                      alt={org.orgName} 
                      className="w-10 h-10 rounded-full mr-3"
                    />
                  )}
                  <div className="flex-grow">
                    <p className="font-medium">{org.orgName}</p>
                    <p className="text-xs text-gray-500">
                      {org.reposCount} repos • Connected {new Date(org.connectedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to disconnect ${org.orgName}?`)) {
                        deleteOrgConnection(org.orgName);
                      }
                    }}
                    className="p-2 text-red-500 hover:text-red-700"
                    disabled={deletingOrg === org.orgName}
                  >
                    {deletingOrg === org.orgName ? (
                      <span className="animate-spin">...</span>
                    ) : (
                      <FaTrash />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Repository Selection */}
        <div className="mb-8 p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Repository Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-2">Organization</label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select an organization</option>
                {orgs.map((org) => (
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
                <option value="">Select a repository</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.name}>{repo.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedRepo && (
            <div className="flex space-x-4 mb-4">
              <a
                href={`https://github.com/${selectedOrg}/${selectedRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 text-sm"
              >
                View on GitHub
              </a>
            </div>
          )}
        </div>
        
        {/* Language Selection */}
        {selectedRepo && (
          <div className="mb-4 p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Project Language</h2>
            <div className="grid grid-cols-3 gap-4">
              {['java', 'python', 'nodejs'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`p-3 rounded-lg border ${
                    language === lang 
                      ? 'bg-indigo-100 border-indigo-500' 
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="capitalize font-medium">{lang}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Selected: {language} • {templates.dockerfile.description}
            </p>
          </div>
        )}

        {/* File Configuration */}
        {selectedRepo && (
          <div className="p-4 border rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 mb-2">Dockerfile</label>
                <textarea
                  value={templates.dockerfile.content}
                  onChange={(e) => handleTemplateChange('dockerfile', e.target.value)}
                  className="w-full h-64 p-2 border rounded font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">Jenkinsfile</label>
                <textarea
                  value={templates.jenkinsfile.content}
                  onChange={(e) => handleTemplateChange('jenkinsfile', e.target.value)}
                  className="w-full h-64 p-2 border rounded font-mono text-sm"
                />
              </div>
            </div>

            <button
              onClick={addFilesToRepo}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Add Files to Repository
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitHubPage;
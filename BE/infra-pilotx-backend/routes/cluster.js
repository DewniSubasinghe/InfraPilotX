const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const yaml = require('js-yaml');
const { Octokit } = require('octokit');

async function getGitHubToken() {
  const db = getDb();
  const config = await db.collection('githubConfig').findOne({ type: 'token' });
  return config?.token;
}

router.get('/check-projects-folder', async (req, res) => {
  try {
    const { orgName, repoName } = req.query;
    
    if (!orgName || !repoName) {
      return res.status(400).json({ message: 'Organization and repository names are required' });
    }

    const token = await getGitHubToken();
    if (!token) {
      return res.status(400).json({ message: 'GitHub token not configured' });
    }

    const octokit = new Octokit({ auth: token });

    // First verify the repository exists
    try {
      await octokit.rest.repos.get({
        owner: orgName,
        repo: repoName
      });
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ 
          message: 'Repository not found',
          details: `Repository ${repoName} not found in organization ${orgName}`
        });
      }
      throw error;
    }

    // Then check for projects folder
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'projects'
      });
      return res.json({ exists: true });
    } catch (error) {
      if (error.status === 404) {
        return res.json({ exists: false });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error checking projects folder:', error);
    return res.status(500).json({
      message: 'Failed to check projects folder',
      error: error.message,
      details: error.response?.data?.message || 'Unknown error occurred'
    });
  }
});

router.get('/existing-projects', async (req, res) => {
  try {
    const { orgName, repoName } = req.query;
    const token = await getGitHubToken();
    if (!token) return res.status(400).json({ message: 'GitHub token not configured' });

    const octokit = new Octokit({ auth: token });
    
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'projects'
      });

      const projects = Array.isArray(data) 
        ? data.filter(f => f.name.endsWith('.yaml') || f.name.endsWith('.yml'))
        : [];
      
      res.json(projects.map(p => ({
        name: p.name,
        path: p.path,
        url: p.html_url
      })));
    } catch (error) {
      if (error.status === 404) {
        res.json([]);
      } else {
        throw error;
      }
    }
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
});

router.post('/create-project', async (req, res) => {
  try {
    const { orgName, repoName, projectName, clusterUrl, namespace, repoUrl } = req.body;
   
    if (!orgName || !repoName || !projectName || !clusterUrl || !repoUrl) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const token = await getGitHubToken();
    if (!token) return res.status(400).json({ message: 'GitHub token not configured' });

    const octokit = new Octokit({ auth: token });

    // Check if project already exists
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: `projects/${projectName}.yaml`
      });
      return res.status(422).json({ message: `Project "${projectName}" already exists` });
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    // Create projects folder if needed
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'projects'
      });
    } catch (error) {
      if (error.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'projects/.gitkeep',
          message: 'Create projects directory',
          content: Buffer.from('').toString('base64'),
          branch: 'main'
        });
      } else {
        throw error;
      }
    }

    // Generate the complete YAML with proper formatting
    const projectYaml = `apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  annotations:
    argocd-autopilot.argoproj-labs.io/default-dest-server: ${clusterUrl}
    argocd.argoproj.io/sync-options: PruneLast=true
    argocd.argoproj.io/sync-wave: "-2"
  creationTimestamp: null
  name: ${projectName}
  namespace: argocd
spec:
  clusterResourceWhitelist:
  - group: '*'
    kind: '*'
  description: ${projectName} project
  destinations:
  - namespace: '*'
    server: '*'
  namespaceResourceWhitelist:
  - group: '*'
    kind: '*'
  sourceRepos:
  - '*'
status: {}

---
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"
  creationTimestamp: null
  name: ${projectName}
  namespace: argocd
spec:
  generators:
  - git:
      files:
      - path: apps/**/config.json
      repoURL: ${repoUrl}.git
      requeueAfterSeconds: 20
      revision: ""
      template:
        metadata: {}
        spec:
          destination: {}
          project: ""
          source:
            repoURL: ""
  - git:
      files:
      - path: apps/**/config_dir.json
      repoURL: ${repoUrl}.git
      requeueAfterSeconds: 20
      revision: ""
      template:
        metadata: {}
        spec:
          destination: {}
          project: ""
          source:
            directory:
              exclude: '{{ exclude }}'
              include: '{{ include }}'
              jsonnet: {}
              recurse: true
            repoURL: ""
  syncPolicy: {}
  template:
    metadata:
      labels:
        app.kubernetes.io/managed-by: argocd-autopilot
        app.kubernetes.io/name: '{{ appName }}'
      name: ${projectName}-{{ userGivenName }}
      namespace: argocd
    spec:
      destination:
        namespace: '{{ destNamespace }}'
        server: '{{ destServer }}'
      ignoreDifferences:
      - group: argoproj.io
        jsonPointers:
        - /status
        kind: Application
      project: ${projectName}
      source:
        path: '{{ srcPath }}'
        repoURL: '{{ srcRepoURL }}'
        targetRevision: '{{ srcTargetRevision }}'
      syncPolicy:
        automated:
          allowEmpty: true
          prune: true
          selfHeal: true
status: {}`;

    // Create project file
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `projects/${projectName}.yaml`,
      message: `Add project ${projectName}`,
      content: Buffer.from(projectYaml).toString('base64'),
      branch: 'main'
    });

    res.status(201).json({
      message: 'Project created successfully',
      url: response.data.content.html_url
    });

  } catch (error) {
    console.error('Error creating project:', error);
    if (error.status === 422) {
      res.status(422).json({
        message: error.response?.data?.message || 'Project already exists'
      });
    } else {
      res.status(500).json({
        message: 'Failed to create project',
        error: error.message
      });
    }
  }
});

module.exports = router;
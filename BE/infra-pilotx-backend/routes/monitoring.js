const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const { Octokit } = require('octokit');
const yaml = require('js-yaml');

// Helper to get GitHub token
async function getGitHubToken() {
  const db = getDb();
  const config = await db.collection('githubConfig').findOne({ type: 'token' });
  return config?.token;
}

// Grafana deployment template
const grafanaDeploymentTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
      volumes:
      - name: grafana-storage
        emptyDir: {}`;

// Check if Grafana manifests exist
router.get('/check-manifests', async (req, res) => {
  try {
    const { orgName, repoName } = req.query;
    const token = await getGitHubToken();
   
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token not configured'
      });
    }

    const octokit = new Octokit({ auth: token });
   
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'monitoring/grafana/deployment.yaml'
      });
     
      res.json({
        success: true,
        exists: true,
        message: 'Grafana manifests exist'
      });
    } catch (error) {
      if (error.status === 404) {
        res.json({
          success: true,
          exists: false,
          message: 'Grafana manifests not found'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check Grafana manifests',
      error: error.message
    });
  }
});

// Get Grafana template
router.get('/template', async (req, res) => {
  try {
    res.json({
      success: true,
      deployment: grafanaDeploymentTemplate,
      message: 'Grafana template generated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate Grafana template',
      error: error.message
    });
  }
});

// Create Grafana manifests
router.post('/create-manifests', async (req, res) => {
  try {
    const { orgName, repoName } = req.body;
    const token = await getGitHubToken();
   
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token not configured'
      });
    }

    if (!orgName || !repoName) {
      return res.status(400).json({
        success: false,
        message: 'Organization and repository name are required'
      });
    }

    const octokit = new Octokit({ auth: token });

    // Create monitoring folder if it doesn't exist
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'monitoring'
      });
    } catch (error) {
      if (error.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'monitoring/.gitkeep',
          message: 'Create monitoring directory',
          content: Buffer.from('').toString('base64'),
          branch: 'main'
        });
      } else {
        throw error;
      }
    }

    // Create grafana folder inside monitoring
    const grafanaFolderPath = 'monitoring/grafana';
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${grafanaFolderPath}/.gitkeep`,
      message: 'Create grafana directory',
      content: Buffer.from('').toString('base64'),
      branch: 'main'
    });

    // Create deployment.yaml
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${grafanaFolderPath}/deployment.yaml`,
      message: 'Add deployment for Grafana',
      content: Buffer.from(grafanaDeploymentTemplate).toString('base64'),
      branch: 'main'
    });

    res.json({
      success: true,
      message: 'Grafana manifests created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create Grafana manifests, already there',
      error: error.message
    });
  }
});

// Deploy Grafana via ArgoCD
router.post('/deploy-argocd', async (req, res) => {
  try {
    const { orgName, repoName, destServer = 'https://kubernetes.default.svc', destNamespace = 'default' } = req.body;
    const token = await getGitHubToken();
   
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token not configured'
      });
    }

    if (!orgName || !repoName) {
      return res.status(400).json({
        success: false,
        message: 'Organization and repository are required'
      });
    }

    // First verify manifests exist
    const octokit = new Octokit({ auth: token });
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'monitoring/grafana/deployment.yaml'
      });
    } catch (error) {
      if (error.status === 404) {
        return res.status(400).json({
          success: false,
          message: 'Grafana manifests not found. Please create them first.'
        });
      }
      throw error;
    }

    const repoUrl = `https://github.com/${orgName}/${repoName}.git`;
    const srcPath = 'monitoring/grafana/';

    // Create ArgoCD application config
    const monitoringAppConfig = {
      appName: 'grafana',
      userGivenName: 'grafana',
      destNamespace: destNamespace,
      destServer: destServer,
      srcPath: srcPath,
      srcRepoURL: repoUrl,
      srcTargetRevision: "",
      labels: null,
      exclude: "",
      include: ""
    };

    // Create apps/grafana folder if it doesn't exist
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'apps/grafana'
      });
    } catch (error) {
      if (error.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'apps/grafana/.gitkeep',
          message: 'Create grafana app directory',
          content: Buffer.from('').toString('base64'),
          branch: 'main'
        });
      } else {
        throw error;
      }
    }

    // Create config_dir.json for ArgoCD
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: 'apps/grafana/config_dir.json',
      message: 'Add ArgoCD config for Grafana',
      content: Buffer.from(JSON.stringify(monitoringAppConfig, null, 2)).toString('base64'),
      branch: 'main'
    });

    // Store deployment in DB
    const db = getDb();
    await db.collection('monitoring').insertOne({
      tool: 'grafana',
      deployedAt: new Date(),
      status: 'Deployed via ArgoCD'
    });

    res.json({
      success: true,
      message: 'Grafana deployment initiated in ArgoCD'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to deploy Grafana via ArgoCD, already there',
      error: error.message
    });
  }
});

// List monitoring deployments
router.get('/list', async (req, res) => {
  try {
    const db = getDb();
    const monitoring = await db.collection('monitoring')
      .find()
      .sort({ deployedAt: -1 })
      .toArray();
   
    res.status(200).json(monitoring);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch monitoring deployments',
      error: error.message
    });
  }
});

module.exports = router;
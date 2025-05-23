const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const { Octokit } = require('octokit');
const yaml = require('js-yaml');
const path = require('path');

// Helper to get GitHub token
async function getGitHubToken() {
  const db = getDb();
  const config = await db.collection('githubConfig').findOne({ type: 'token' });
  return config?.token;
}

// Check if manifests folder exists and list apps
router.get('/list-manifests', async (req, res) => {
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
      const { data } = await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'manifests'
      });

      if (Array.isArray(data)) {
        const apps = data.filter(item => item.type === 'dir').map(item => ({
          name: item.name,
          path: item.path
        }));

        return res.json({
          success: true,
          exists: true,
          apps,
          message: 'Manifests folder exists'
        });
      }

      return res.json({
        success: true,
        exists: false,
        apps: [],
        message: 'Manifests folder is empty'
      });
    } catch (error) {
      if (error.status === 404) {
        return res.json({
          success: true,
          exists: false,
          apps: [],
          message: 'Manifests folder not found'
        });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check manifests folder',
      error: error.message
    });
  }
});

// Template for deployment.yaml
const deploymentTemplate = {
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: {
    name: "",
    labels: {
      app: ""
    }
  },
  spec: {
    replicas: 1,
    selector: {
      matchLabels: {
        app: ""
      }
    },
    template: {
      metadata: {
        labels: {
          app: ""
        }
      },
      spec: {
        containers: [{
          name: "",
          image: "",
          ports: [{
            containerPort: 80
          }]
        }]
      }
    }
  }
};

// Get template manifests for preview
router.get('/templates', async (req, res) => {
  try {
    const { appName, image } = req.query;
    
    if (!appName || !image) {
      return res.status(400).json({
        success: false,
        message: 'Application name and image are required'
      });
    }

    // Create deployment.yaml
    const deployment = { ...deploymentTemplate };
    deployment.metadata.name = `${appName}-deployment`;
    deployment.metadata.labels.app = appName;
    deployment.spec.selector.matchLabels.app = appName;
    deployment.spec.template.metadata.labels.app = appName;
    deployment.spec.template.spec.containers[0].name = appName;
    deployment.spec.template.spec.containers[0].image = image;

    res.json({
      success: true,
      deployment: yaml.dump(deployment),
      message: 'Template generated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message
    });
  }
});

// Create new application manifests
router.post('/create-manifests', async (req, res) => {
  try {
    const { orgName, repoName, appName, deploymentYaml } = req.body;
    const token = await getGitHubToken();
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token not configured'
      });
    }

    if (!appName || !deploymentYaml) {
      return res.status(400).json({
        success: false,
        message: 'Application name and deployment manifest are required'
      });
    }

    const octokit = new Octokit({ auth: token });

    // Validate YAML
    try {
      yaml.load(deploymentYaml);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YAML format',
        error: error.message
      });
    }

    // Create manifests folder if it doesn't exist
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'manifests'
      });
    } catch (error) {
      if (error.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'manifests/.gitkeep',
          message: 'Create manifests directory',
          content: Buffer.from('').toString('base64'),
          branch: 'main'
        });
      } else {
        throw error;
      }
    }

    // Create app folder inside manifests
    const appFolderPath = `manifests/${appName}`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${appFolderPath}/.gitkeep`,
      message: `Create ${appName} directory`,
      content: Buffer.from('').toString('base64'),
      branch: 'main'
    });

    // Create deployment.yaml
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${appFolderPath}/deployment.yaml`,
      message: `Add deployment for ${appName}`,
      content: Buffer.from(deploymentYaml).toString('base64'),
      branch: 'main'
    });

    res.json({
      success: true,
      message: 'Application manifest created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create application manifest',
      error: error.message
    });
  }
});

// Deploy application to ArgoCD
router.post('/deploy', async (req, res) => {
  try {
    const { orgName, repoName, appName, destServer = 'https://kubernetes.default.svc', destNamespace = 'default' } = req.body;
    const token = await getGitHubToken();
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token not configured'
      });
    }

    if (!orgName || !repoName || !appName) {
      return res.status(400).json({
        success: false,
        message: 'Organization, repository and application name are required'
      });
    }

    const octokit = new Octokit({ auth: token });
    const repoUrl = `https://github.com/${orgName}/${repoName}.git`;
    const srcPath = `manifests/${appName}/`;

    // Create config_dir.json
    const config = {
      appName: appName,
      userGivenName: appName,
      destNamespace: destNamespace,
      destServer: destServer,
      srcPath: srcPath,
      srcRepoURL: repoUrl,
      srcTargetRevision: "",
      labels: null,
      exclude: "",
      include: ""
    };

    // Create apps folder if it doesn't exist
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'apps'
      });
    } catch (error) {
      if (error.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'apps/.gitkeep',
          message: 'Create apps directory',
          content: Buffer.from('').toString('base64'),
          branch: 'main'
        });
      } else {
        throw error;
      }
    }

    // Create app folder inside apps
    const appFolderPath = `apps/${appName}`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${appFolderPath}/.gitkeep`,
      message: `Create ${appName} app directory`,
      content: Buffer.from('').toString('base64'),
      branch: 'main'
    });

    // Create config_dir.json
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${appFolderPath}/config_dir.json`,
      message: `Add ArgoCD config for ${appName}`,
      content: Buffer.from(JSON.stringify(config, null, 2)).toString('base64'),
      branch: 'main'
    });

    res.json({
      success: true,
      message: 'Application deployment initiated in ArgoCD'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to deploy application, already there',
      error: error.message
    });
  }
});

module.exports = router;
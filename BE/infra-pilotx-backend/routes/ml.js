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

// Template for ML deployment
const mlDeploymentTemplate = {
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
            containerPort: 5000
          }]
        }]
      }
    }
  }
};

// Get ML templates
router.get('/templates', async (req, res) => {
  try {
    const { modelName, image } = req.query;
   
    if (!modelName || !image) {
      return res.status(400).json({
        success: false,
        message: 'Model name and image are required'
      });
    }

    // Create deployment.yaml
    const deployment = { ...mlDeploymentTemplate };
    deployment.metadata.name = `${modelName}-deployment`;
    deployment.metadata.labels.app = modelName;
    deployment.spec.selector.matchLabels.app = modelName;
    deployment.spec.template.metadata.labels.app = modelName;
    deployment.spec.template.spec.containers[0].name = modelName;
    deployment.spec.template.spec.containers[0].image = image;

    res.json({
      success: true,
      deployment: yaml.dump(deployment),
      message: 'ML template generated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate ML template',
      error: error.message
    });
  }
});

// Deploy ML model
router.post('/deploy', async (req, res) => {
  try {
    const { orgName, repoName, modelName, deploymentYaml } = req.body;
    const token = await getGitHubToken();
   
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token not configured'
      });
    }

    if (!orgName || !repoName || !modelName || !deploymentYaml) {
      return res.status(400).json({
        success: false,
        message: 'All required fields are missing'
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

    // Create ml-models folder if it doesn't exist
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'ml-models'
      });
    } catch (error) {
      if (error.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'ml-models/.gitkeep',
          message: 'Create ml-models directory',
          content: Buffer.from('').toString('base64'),
          branch: 'main'
        });
      } else {
        throw error;
      }
    }

    // Create model folder inside ml-models
    const modelFolderPath = `ml-models/${modelName}`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${modelFolderPath}/.gitkeep`,
      message: `Create ${modelName} directory`,
      content: Buffer.from('').toString('base64'),
      branch: 'main'
    });

    // Create deployment.yaml
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${modelFolderPath}/deployment.yaml`,
      message: `Add deployment for ${modelName}`,
      content: Buffer.from(deploymentYaml).toString('base64'),
      branch: 'main'
    });

    res.json({
      success: true,
      message: 'ML model manifest created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create ML model manifest, already there',
      error: error.message
    });
  }
});

// List deployed ML models
router.get('/list', async (req, res) => {
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
        path: 'ml-models'
      });

      if (Array.isArray(data)) {
        const models = data.filter(item => item.type === 'dir').map(item => ({
          name: item.name,
          path: item.path
        }));

        return res.json({
          success: true,
          exists: true,
          models,
          message: 'ML models folder exists'
        });
      }

      return res.json({
        success: true,
        exists: false,
        models: [],
        message: 'ML models folder is empty'
      });
    } catch (error) {
      if (error.status === 404) {
        return res.json({
          success: true,
          exists: false,
          models: [],
          message: 'ML models folder not found'
        });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list ML models',
      error: error.message
    });
  }
});

// Deploy ML model via ArgoCD
router.post('/deploy-argocd', async (req, res) => {
  try {
    const { orgName, repoName, modelName, destServer = 'https://kubernetes.default.svc', destNamespace = 'default' } = req.body;
    const token = await getGitHubToken();
   
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'GitHub token not configured'
      });
    }

    if (!orgName || !repoName || !modelName) {
      return res.status(400).json({
        success: false,
        message: 'Organization, repository and model name are required'
      });
    }

    const octokit = new Octokit({ auth: token });
    const repoUrl = `https://github.com/${orgName}/${repoName}.git`;
    const srcPath = `ml-models/${modelName}/`;

    // Create ArgoCD application config
    const mlAppConfig = {
      appName: modelName,
      userGivenName: modelName,
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
    const appFolderPath = `apps/${modelName}`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${appFolderPath}/.gitkeep`,
      message: `Create ${modelName} app directory`,
      content: Buffer.from('').toString('base64'),
      branch: 'main'
    });

    // Create config_dir.json for ArgoCD
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `${appFolderPath}/config_dir.json`,
      message: `Add ArgoCD config for ${modelName}`,
      content: Buffer.from(JSON.stringify(mlAppConfig, null, 2)).toString('base64'),
      branch: 'main'
    });

    res.json({
      success: true,
      message: 'ML model deployment initiated in ArgoCD'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to deploy ML model via ArgoCD, already there',
      error: error.message
    });
  }
});

module.exports = router;
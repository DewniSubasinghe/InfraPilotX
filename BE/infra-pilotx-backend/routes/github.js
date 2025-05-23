const express = require('express');
const { Octokit } = require('octokit');
const router = express.Router();
const { getDb } = require('../config/db');

// Enhanced token validation middleware
const validateGitHubToken = async (req, res, next) => {
  try {
    if (!req.headers['content-type']?.includes('application/json')) {
      return res.status(415).json({ 
        message: 'Content-Type must be application/json' 
      });
    }

    const { token } = req.body;
    
    if (!token || !token.startsWith('ghp_')) {
      return res.status(400).json({ 
        message: 'Valid GitHub token is required',
        example: 'ghp_yourTokenHere'
      });
    }

    // Verify token with GitHub
    const octokit = new Octokit({ auth: token });
    try {
      await octokit.rest.users.getAuthenticated();
      req.octokit = octokit;
      next();
    } catch (e) {
      console.error('GitHub token verification failed:', e);
      return res.status(401).json({ 
        message: 'GitHub token verification failed',
        solution: '1. Check token is valid\n2. Verify token has required scopes\n3. Ensure token is not expired'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Check if token is configured and valid
router.get('/check-token', async (req, res) => {
  try {
    const db = getDb();
    const config = await db.collection('githubConfig').findOne({ type: 'token' });
    
    if (!config?.token) {
      return res.status(200).json({ 
        configured: false,
        message: 'No GitHub token configured'
      });
    }
    
    const octokit = new Octokit({ auth: config.token });
    await octokit.rest.users.getAuthenticated();
    
    res.status(200).json({ 
      configured: true,
      valid: true,
      lastVerified: config.lastVerified,
      message: 'Token is valid'
    });
  } catch (error) {
    res.status(200).json({
      configured: true,
      valid: false,
      error: error.message,
      message: 'Token is invalid or expired'
    });
  }
});

// Store GitHub token
router.post('/set-token', validateGitHubToken, async (req, res) => {
  try {
    const { token } = req.body;
    const db = getDb();

    const result = await db.collection('githubConfig').updateOne(
      { type: 'token' },
      { 
        $set: { 
          token,
          updatedAt: new Date(),
          lastVerified: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.status(200).json({ 
      message: 'GitHub token stored successfully',
      action: result.upsertedId ? 'created' : 'updated',
      timestamp: new Date(),
      tokenConfigured: true
    });
  } catch (error) {
    console.error('Token storage error:', error);
    res.status(500).json({ 
      message: 'Failed to store GitHub token',
      error: error.message
    });
  }
});

// Connect to GitHub Org
router.post('/connect', async (req, res) => {
  try {
    const { orgName } = req.body;
    if (!orgName) {
      return res.status(400).json({ 
        message: 'Organization name is required',
        solution: 'Please provide a valid GitHub organization name'
      });
    }

    const db = getDb();
    const config = await db.collection('githubConfig').findOne({ type: 'token' });
    
    if (!config?.token) {
      return res.status(400).json({ 
        message: 'GitHub token not configured',
        solution: 'First call /set-token endpoint with a valid GitHub token'
      });
    }

    const octokit = new Octokit({ auth: config.token });
    const { data: orgData } = await octokit.rest.orgs.get({ org: orgName });
    
    const existingConnection = await db.collection('githubConnections').findOne({ orgName });
    if (existingConnection) {
      return res.status(200).json({
        message: 'Organization already connected',
        org: {
          name: orgData.login,
          id: orgData.id,
          avatarUrl: orgData.avatar_url,
          reposCount: existingConnection.reposCount
        },
        existing: true
      });
    }

    const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org: orgName,
      per_page: 100
    });

    const connection = {
      orgName: orgData.login,
      orgId: orgData.id,
      avatarUrl: orgData.avatar_url,
      connectedAt: new Date(),
      reposCount: repos.length,
      repos: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        url: repo.html_url,
        defaultBranch: repo.default_branch
      }))
    };

    await db.collection('githubConnections').insertOne(connection);
    
    res.status(200).json({
      message: 'Connected successfully',
      org: {
        name: orgData.login,
        id: orgData.id,
        avatarUrl: orgData.avatar_url,
        reposCount: repos.length
      },
      repositories: connection.repos
    });
  } catch (error) {
    console.error('GitHub connection error:', error);
    let errorMessage = 'Failed to connect to organization';
    let solution = 'Please check the organization name and token permissions';
    
    if (error.status === 404) {
      errorMessage = 'Organization not found';
      solution = 'Verify the organization name is correct';
    } else if (error.status === 403) {
      errorMessage = 'Token lacks sufficient permissions';
      solution = 'Ensure token has admin:org and repo scopes';
    }
    
    res.status(error.status || 500).json({ 
      message: errorMessage,
      error: error.message,
      solution
    });
  }
});

// List connected orgs
router.get('/connections', async (req, res) => {
  try {
    const db = getDb();
    const connections = await db.collection('githubConnections')
      .find({})
      .sort({ connectedAt: -1 })
      .toArray();
    
    res.status(200).json(connections);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch connections',
      error: error.message
    });
  }
});

// Delete organization connection
router.delete('/connections/:orgName', async (req, res) => {
  try {
    const { orgName } = req.params;
    const db = getDb();
    
    const result = await db.collection('githubConnections').deleteOne({ orgName });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        message: 'Organization connection not found' 
      });
    }
    
    res.status(200).json({ 
      message: 'Organization connection deleted successfully',
      orgName
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to delete organization connection',
      error: error.message
    });
  }
});

// List repositories in org
router.get('/repos/:orgName', async (req, res) => {
  try {
    const { orgName } = req.params;
    const db = getDb();
    const config = await db.collection('githubConfig').findOne({ type: 'token' });
    
    if (!config?.token) {
      return res.status(400).json({ message: 'GitHub token not configured' });
    }

    const orgConnection = await db.collection('githubConnections').findOne({ orgName });
    if (orgConnection?.repos) {
      return res.status(200).json({
        org: orgName,
        count: orgConnection.reposCount,
        repositories: orgConnection.repos,
        source: 'cache'
      });
    }

    const octokit = new Octokit({ auth: config.token });
    const repos = await octokit.paginate(octokit.rest.repos.listForOrg, { 
      org: orgName,
      per_page: 100
    });
    
    res.status(200).json({
      org: orgName,
      count: repos.length,
      repositories: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        url: repo.html_url,
        defaultBranch: repo.default_branch
      })),
      source: 'api'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch repositories',
      error: error.message
    });
  }
});

// Get language-specific templates
router.get('/templates/:language', (req, res) => {
  const { language } = req.params;
  
  const templates = {
    java: {
      dockerfile: {
        content: `FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app
COPY .mvn/ .mvn
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline
COPY src ./src
RUN ./mvnw package -DskipTests
ENTRYPOINT ["java", "-jar", "/app/target/*.jar"]`,
        description: "Java Dockerfile template with Maven build"
      },
      jenkinsfile: {
        content: `@Library('shared-ci-cd')_
pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        script {
          if(env.BRANCH_NAME == 'main') {
            sharedPipelineJavaMain()
          } else if (env.CHANGE_ID) {
            sharedPipelineJavaPR()
          } else {
            sharedPipelineJavaDev()
          }
        }
      }
    }
  }
}`,
        description: "Java Jenkinsfile template with shared library"
      }
    },
    python: {
      dockerfile: {
        content: `FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]`,
        description: "Python Dockerfile template"
      },
      jenkinsfile: {
        content: `@Library('shared-ci-cd')_
pipeline {
  agent any
  stages {
    stage('Setup') {
      steps {
        script {
          sh 'python -m venv venv'
          sh 'source venv/bin/activate'
        }
      }
    }
    stage('Build') {
      steps {
        script {
          if(env.BRANCH_NAME == 'main') {
            sharedPipelinePythonMain()
          } else {
            sharedPipelinePythonDev()
          }
        }
      }
    }
  }
}`,
        description: "Python Jenkinsfile template"
      }
    },
    nodejs: {
      dockerfile: {
        content: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]`,
        description: "Node.js Dockerfile template"
      },
      jenkinsfile: {
        content: `@Library('shared-ci-cd')_
pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        script {
          if(env.BRANCH_NAME == 'main') {
            sharedPipelineNodeMain()
          } else if (env.CHANGE_ID) {
            sharedPipelineNodePR()
          } else {
            sharedPipelineNodeDev()
          }
        }
      }
    }
  }
}`,
        description: "Node.js Jenkinsfile template"
      }
    }
  };

  if (!templates[language]) {
    return res.status(400).json({ message: 'Unsupported language' });
  }

  res.status(200).json({
    language,
    ...templates[language]
  });
});

// Add files to repo
router.post('/add-files', async (req, res) => {
  try {
    const { orgName, repoName, dockerfile, jenkinsfile } = req.body;
    const db = getDb();
    const config = await db.collection('githubConfig').findOne({ type: 'token' });
    
    if (!config?.token) {
      return res.status(400).json({ message: 'GitHub token not configured' });
    }

    if (!orgName || !repoName) {
      return res.status(400).json({ message: 'Organization and repository name are required' });
    }

    if (!dockerfile && !jenkinsfile) {
      return res.status(400).json({ message: 'At least one file content is required' });
    }

    const octokit = new Octokit({ auth: config.token });
    const results = [];
    
    if (dockerfile) {
      try {
        const result = await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'Dockerfile',
          message: `Add Dockerfile via InfraPilotX`,
          content: Buffer.from(dockerfile).toString('base64'),
          branch: 'main'
        });
        results.push({
          file: 'Dockerfile',
          status: 'created',
          url: result.data.content.html_url
        });
      } catch (error) {
        results.push({
          file: 'Dockerfile',
          status: 'error',
          error: error.message
        });
      }
    }
    
    if (jenkinsfile) {
      try {
        const result = await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'Jenkinsfile',
          message: `Add Jenkinsfile via InfraPilotX`,
          content: Buffer.from(jenkinsfile).toString('base64'),
          branch: 'main'
        });
        results.push({
          file: 'Jenkinsfile',
          status: 'created',
          url: result.data.content.html_url
        });
      } catch (error) {
        results.push({
          file: 'Jenkinsfile',
          status: 'error',
          error: error.message
        });
      }
    }
    
    if (results.some(r => r.status === 'created')) {
      await db.collection('githubConnections').updateOne(
        { orgName },
        { $set: { updatedAt: new Date() } }
      );
    }

    res.status(200).json({ 
      message: 'Files processed',
      results,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to add files',
      error: error.message
    });
  }
});

// Get repository file content
router.get('/file-content', async (req, res) => {
  try {
    const { orgName, repoName, filePath } = req.query;
    const db = getDb();
    const config = await db.collection('githubConfig').findOne({ type: 'token' });
    
    if (!config?.token) {
      return res.status(400).json({ message: 'GitHub token not configured' });
    }

    if (!orgName || !repoName || !filePath) {
      return res.status(400).json({ message: 'Organization, repository and file path are required' });
    }

    const octokit = new Octokit({ auth: config.token });
    const response = await octokit.rest.repos.getContent({
      owner: orgName,
      repo: repoName,
      path: filePath
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    
    res.status(200).json({
      content,
      encoding: 'utf8',
      size: content.length,
      path: response.data.path,
      sha: response.data.sha
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch file content',
      error: error.message
    });
  }
});

module.exports = router;
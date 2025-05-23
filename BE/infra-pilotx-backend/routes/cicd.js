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

// Check if CICD folder exists in repo
router.get('/check-cicd', async (req, res) => {
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
        path: 'cicd'
      });
      
      res.json({ 
        success: true,
        exists: true,
        message: 'CICD folder exists' 
      });
    } catch (error) {
      if (error.status === 404) {
        res.json({ 
          success: true,
          exists: false,
          message: 'CICD folder not found' 
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check CICD folder',
      error: error.message
    });
  }
});

// Get existing pipelines from CICD folder
router.get('/existing-pipelines', async (req, res) => {
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
        path: 'cicd'
      });

      const pipelines = Array.isArray(data) 
        ? data.filter(file => file.name.endsWith('.groovy'))
        : [];
      
      res.json({
        success: true,
        items: pipelines.map(file => ({
          name: file.name,
          path: file.path,
          url: file.html_url,
          sha: file.sha
        }))
      });
    } catch (error) {
      if (error.status === 404) {
        res.json({
          success: true,
          items: []
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pipelines',
      error: error.message
    });
  }
});

// Get pipeline template
router.get('/template', async (req, res) => {
  try {
    const { language, dockerImage, registryUrl, registryCredentialId } = req.query;
    
    if (!language || !dockerImage) {
      return res.status(400).json({
        success: false,
        message: 'Language and Docker image are required'
      });
    }

    // Default registry to Docker Hub if not provided
    const registry = registryUrl || 'docker.io';
    const credId = registryCredentialId || 'dockerhub-creds';

    const templates = {
      java: `pipeline {
  agent any
  environment {
    DOCKER_IMAGE = "${dockerImage}"
    REGISTRY = "${registry}"
    CREDENTIALS_ID = "${credId}"
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }
    stage('Build') {
      steps {
        sh './mvnw clean package -DskipTests'
      }
    }
    stage('Test') {
      steps {
        sh './mvnw test'
      }
    }
    stage('Build Docker Image') {
      steps {
        script {
          docker.build("${dockerImage}")
        }
      }
    }
    stage('Push Docker Image') {
      steps {
        script {
          docker.withRegistry("https://${registry}", "${credId}") {
            docker.image("${dockerImage}").push()
          }
        }
      }
    }
    stage('Deploy to Dev') {
      when {
        branch 'dev'
      }
      steps {
        sh 'kubectl apply -f k8s/dev'
      }
    }
    stage('Deploy to Prod') {
      when {
        branch 'main'
      }
      steps {
        sh 'kubectl apply -f k8s/prod'
      }
    }
  }
  post {
    always {
      junit '**/target/surefire-reports/*.xml'
      archiveArtifacts artifacts: '**/target/*.jar', fingerprint: true
    }
    failure {
      mail to: 'team@example.com',
           subject: "Failed Pipeline: \${currentBuild.fullDisplayName}",
           body: "Build \${env.BUILD_URL} failed"
    }
  }
}`,
      python: `pipeline {
  agent any
  environment {
    DOCKER_IMAGE = "${dockerImage}"
    REGISTRY = "${registry}"
    CREDENTIALS_ID = "${credId}"
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }
    stage('Setup Virtualenv') {
      steps {
        sh 'python -m venv venv'
        sh 'source venv/bin/activate && pip install -r requirements.txt'
      }
    }
    stage('Test') {
      steps {
        sh 'source venv/bin/activate && pytest'
      }
    }
    stage('Build Docker Image') {
      steps {
        script {
          docker.build("${dockerImage}")
        }
      }
    }
    stage('Push Docker Image') {
      steps {
        script {
          docker.withRegistry("https://${registry}", "${credId}") {
            docker.image("${dockerImage}").push()
          }
        }
      }
    }
    stage('Deploy to Dev') {
      when {
        branch 'dev'
      }
      steps {
        sh 'kubectl apply -f k8s/dev'
      }
    }
  }
  post {
    always {
      junit '**/test-reports/*.xml'
    }
    failure {
      slackSend channel: '#builds',
                message: "Build Failed: \${env.JOB_NAME} - \${env.BUILD_NUMBER}"
    }
  }
}`,
      nodejs: `pipeline {
  agent any
  environment {
    DOCKER_IMAGE = "${dockerImage}"
    REGISTRY = "${registry}"
    CREDENTIALS_ID = "${credId}"
    NODE_ENV = 'production'
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }
    stage('Install Dependencies') {
      steps {
        sh 'npm ci'
      }
    }
    stage('Lint') {
      steps {
        sh 'npm run lint'
      }
    }
    stage('Test') {
      steps {
        sh 'npm test'
      }
    }
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    stage('Build Docker Image') {
      steps {
        script {
          docker.build("${dockerImage}")
        }
      }
    }
    stage('Push Docker Image') {
      steps {
        script {
          docker.withRegistry("https://${registry}", "${credId}") {
            docker.image("${dockerImage}").push()
          }
        }
      }
    }
    stage('Deploy to Staging') {
      when {
        branch 'staging'
      }
      steps {
        sh 'kubectl apply -f k8s/staging'
      }
    }
    stage('Deploy to Production') {
      when {
        branch 'main'
      }
      steps {
        input message: 'Deploy to production?', ok: 'Deploy'
        sh 'kubectl apply -f k8s/production'
      }
    }
  }
  post {
    always {
      junit '**/test-results.xml'
      archiveArtifacts artifacts: '**/build/**'
    }
    success {
      slackSend channel: '#builds',
                message: "Build Succeeded: \${env.JOB_NAME} - \${env.BUILD_NUMBER}"
    }
  }
}`
    };

    if (!templates[language]) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language'
      });
    }

    res.json({
      success: true,
      content: templates[language],
      message: 'Template loaded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load template',
      error: error.message
    });
  }
});

// Create new pipeline
router.post('/create-pipeline', async (req, res) => {
  try {
    const { orgName, repoName, pipelineName, pipelineContent } = req.body;
    const token = await getGitHubToken();
    
    if (!token) {
      return res.status(400).json({ 
        success: false,
        message: 'GitHub token not configured' 
      });
    }

    if (!pipelineName || !pipelineContent) {
      return res.status(400).json({
        success: false,
        message: 'Pipeline name and content are required'
      });
    }

    const octokit = new Octokit({ auth: token });
    
    // Check if cicd folder exists, create if not
    try {
      await octokit.rest.repos.getContent({
        owner: orgName,
        repo: repoName,
        path: 'cicd'
      });
    } catch (error) {
      if (error.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: 'cicd/.gitkeep',
          message: 'Create CICD directory',
          content: Buffer.from('').toString('base64'),
          branch: 'main'
        });
      } else {
        throw error;
      }
    }

    // Create pipeline file
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: orgName,
      repo: repoName,
      path: `cicd/${pipelineName}.groovy`,
      message: `Add ${pipelineName} pipeline via InfraPilotX`,
      content: Buffer.from(pipelineContent).toString('base64'),
      branch: 'main'
    });

    res.json({
      success: true,
      message: 'Pipeline created successfully',
      url: response.data.content.html_url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create pipeline, already exists.',
      error: error.message
    });
  }
});

module.exports = router;
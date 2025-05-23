import React from "react";

const Documentation = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 text-white">
      {/* Header */}
      <div className="text-center py-10 px-6">
        <h1 className="text-5xl font-extrabold text-white">InfraPilotX Documentation</h1>
      </div>

      <div className="max-w-7xl mx-auto p-10 flex-grow">
        {/* Overview */}
        <section className="mb-8 bg-white p-6 rounded-lg shadow-lg text-gray-800">
          <h2 className="text-2xl font-semibold text-indigo-600">Overview</h2>
          <p>
            InfraPilotX is an autonomous GitOps framework for streamlined Kubernetes 
            infrastructure management in business ecosystems. It leverages ArgoCD 
            Autopilot for efficient deployment, CI/CD automation, and multi-cloud support.
          </p>
        </section>

        {/* Features */}
        <section className="mb-8 bg-white p-6 rounded-lg shadow-lg text-gray-800">
          <h2 className="text-2xl font-semibold text-indigo-600">Key Features</h2>
          <ul className="list-disc pl-6">
            <li>Seamless Kubernetes infrastructure deployment</li>
            <li>Integration with GitHub, Jenkins, and cloud providers</li>
            <li>Automated CI/CD pipeline generation</li>
            <li>Multi-cloud and disaster recovery support</li>
            <li>MLOps model deployment and monitoring</li>
          </ul>
        </section>

        {/* Setup & Installation */}
        <section className="mb-8 bg-white p-6 rounded-lg shadow-lg text-gray-800">
          <h2 className="text-2xl font-semibold text-indigo-600">Setup & Installation</h2>
          <p>Follow these steps to locally tryout InfraPilotX:</p>
          <ol className="list-decimal pl-6">
            <li>Clone the repository from GitHub.</li>
            <li>Install dependencies: <code className="text-indigo-600">npm install</code></li>
            <li>Configure ArgoCD Autopilot and cloud settings.</li>
            <li>Deploy using: <code className="text-indigo-600">npm start</code></li>
          </ol>
        </section>

        {/* Usage */}
        <section className="mb-8 bg-white p-6 rounded-lg shadow-lg text-gray-800">
          <h2 className="text-2xl font-semibold text-indigo-600">Usage</h2>
          <p>
            - Navigate to different tiles for GitHub, Cloud, CI/CD, and ML deployments. <br />
            - Use the UI to register GitHub orgs, configure pipelines, and deploy ML models.
          </p>
        </section>
      </div>

      {/* Footer Section */}
      <footer className="bg-gray-800 text-center py-2 mt-auto">
        <p className="text-white text-sm">
          Copyright © 2025 InfraPilotX. Developed for scholarly purposes. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Documentation;


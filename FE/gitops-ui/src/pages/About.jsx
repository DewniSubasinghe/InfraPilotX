import React from "react";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 text-white">
      {/* Header */}
      <div className="text-center py-6 px-3">
        <h1 className="text-5xl font-extrabold text-white">About Us</h1>
      </div>

      <div className="max-w-7xl mx-auto p-10 flex-grow">
        {/* About the Creator */}
        <section className="mb-8 bg-white p-6 rounded-lg shadow-lg text-gray-800">
          <h2 className="text-2xl font-semibold text-indigo-600 mb-4">About the Creator</h2>
          <p className="text-gray-700">
            I am Dewni Subasinghe, a final-year Software Engineering student at the
            Informatics Institute of Technology (IIT) affiliated with University of Westminster. 
            I am employed as an Associate DevOps Engineer.
            I am passionate about DevOps practices, automation, and building
            scalable, resilient systems. I aim to bridge the gap between theoretical
            concepts and real-world business challenges, making infrastructure
            management more efficient and accessible.
          </p>
        </section>

        {/* About InfraPilotX */}
        <section className="mb-8 bg-white p-6 rounded-lg shadow-lg text-gray-800">
          <h2 className="text-2xl font-semibold text-indigo-600 mb-4">About InfraPilotX</h2>
          <p className="text-gray-700">
            InfraPilotX is an autonomous GitOps framework designed to simplify
            Kubernetes infrastructure management in business ecosystems. It leverages
            ArgoCD Autopilot and CI/CD automation tools to provide seamless deployment,
            multi-cloud support, disaster recovery, and MLOps capabilities. The project 
            aims to streamline Kubernetes infrastructure management by offering features 
            such as fast rollbacks, automated pipeline generation, and integration with popular 
            cloud platforms. It also provides the flexibility to handle disaster recovery and 
            cross-cloud migration while supporting MLOps for model deployment and monitoring.
            InfraPilotX’s core goal is to reduce the complexity of Kubernetes setups and enable 
            organizations to deploy, monitor, and recover systems with ease in a multi-cloud environment.
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

export default About;



import React from "react";
import { FaGithub, FaCloud, FaCogs, FaChartLine, FaDesktop, FaMicrochip } from "react-icons/fa";
import { Link } from "react-router-dom";

const Home = () => {
  const tiles = [
    { 
      name: "GitHub", 
      icon: <FaGithub />, 
      path: "/github",
      description: "Manage GitHub organizations and repositories"
    },
    { 
      name: "Cloud", 
      icon: <FaCloud />, 
      path: "/cluster",
      description: "Connect and manage Kubernetes clusters"
    },
    { 
      name: "App", 
      icon: <FaCogs />, 
      path: "/apps",
      description: "Deploy and manage applications"
    },
    { 
      name: "CICD", 
      icon: <FaChartLine />, 
      path: "/cicd",
      description: "Configure CI/CD pipelines"
    },
    { 
      name: "Monitoring", 
      icon: <FaDesktop />, 
      path: "/monitoring",
      description: "Set up monitoring solutions"
    },
    { 
      name: "Machine Learning", 
      icon: <FaMicrochip />, 
      path: "/ml",
      description: "Deploy ML models"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800">
      {/* Navbar */}
      <nav className="bg-gray-800 p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-white">
          <Link to="/" className="text-3xl font-bold">InfraPilotX</Link>
          <div className="space-x-6">
            <Link to="/" className="hover:text-indigo-400">Home</Link>
            <Link to="/documentation" className="hover:text-indigo-400">Documentation</Link>
            <Link to="/about" className="hover:text-indigo-400">About Us</Link>
            <Link to="/contact" className="hover:text-indigo-400">Contact Us</Link>
          </div>
        </div>
      </nav>

      {/* Product Description Section */}
      <div className="bg-white text-center py-5 px-6">
        <h1 className="text-5xl text-indigo-600 font-bold mb-7">InfraPilotX</h1>
        <p className="text-xl text-gray-700 mb-3 max-w-4xl mx-auto">
          InfraPilotX offers a streamlined, autonomous GitOps framework designed to simplify Kubernetes infrastructure management, 
          making it ideal for business ecosystems with many integrated features.
        </p>
      </div>

      {/* Tiles Section */}
      <div className="max-w-7xl mx-auto p-10 flex-grow">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {tiles.map((tile, index) => (
            <Link
              key={index}
              to={tile.path}
              className="relative flex flex-col items-center justify-center bg-white p-6 rounded-lg shadow-lg text-center transition-transform transform hover:scale-105 group"
            >
              <div className="text-6xl text-indigo-600 mb-6 group-hover:text-indigo-800 transition-colors">
                {tile.icon}
              </div>
              <h2 className="text-2xl font-semibold group-hover:text-indigo-800 transition-colors">
                {tile.name}
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                {tile.description}
              </p>
            </Link>
          ))}
        </div>
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

export default Home;
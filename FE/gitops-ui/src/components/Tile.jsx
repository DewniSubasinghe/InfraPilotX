import React from "react";
import { Link } from "react-router-dom";
import axios from 'axios';

const Tile = ({ name, icon, path }) => {
  const handleTileClick = async () => {
    try {
      if (name === 'GitHub') {
        const response = await axios.get('http://localhost:5000/api/github/connections');
        console.log('Connected GitHub orgs:', response.data);
      }

    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Link
      to={path}
      className="p-6 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 text-white rounded-lg shadow-lg flex items-center justify-center flex-col transition transform hover:scale-105 hover:shadow-2xl"
      onClick={handleTileClick}
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-2xl font-semibold">{name}</h3>
    </Link>
  );
};

export default Tile;

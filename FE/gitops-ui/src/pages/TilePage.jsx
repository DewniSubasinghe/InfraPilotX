import React from "react";
import { useParams } from "react-router-dom";

const TilePage = () => {
  const { tileName } = useParams();

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-lg text-center">
        <h1 className="text-4xl font-semibold text-indigo-600 mb-6">{tileName} Page</h1>
        <p className="text-lg text-gray-700">This is the page for {tileName}. You can add more functionality here!</p>
      </div>
    </div>
  );
};

export default TilePage;

import React from 'react';

const Contact = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-800 text-white">
      {/* Header */}
      <div className="text-center py-10 px-6">
        <h1 className="text-5xl font-extrabold text-white">Contact Us</h1>
      </div>

      <div className="max-w-7xl mx-auto p-10 flex-grow">
        {/* Contact Info */}
        <section className="mb-8 bg-white p-6 rounded-lg shadow-lg text-gray-800">
          <h2 className="text-2xl font-semibold text-indigo-600 mb-4">Get in Touch</h2>
          <p className="text-gray-700">
            Feel free to reach out to me for any inquiries, collaborations, or project-related
            discussions. Below are the details for getting in touch:
          </p>

          <ul className="list-none mt-4 text-gray-700">
            <li className="mb-2">
              <strong>Email:</strong> <a href="mailto:dewnisubasinghe@gmail.com" className="text-indigo-600">dewnisubasinghe@gmail.com</a>
            </li>
            <li className="mb-2">
              <strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/dewnisubasinghe" target="_blank" rel="noopener noreferrer" className="text-indigo-600">Dewni Subasinghe</a>
            </li>
            <li className="mb-2">
              <strong>GitHub:</strong> <a href="https://github.com/DewniSubasinghe" target="_blank" rel="noopener noreferrer" className="text-indigo-600">DewniSubasinghe</a>
            </li>
          </ul>
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

export default Contact;


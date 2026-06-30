/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#f1f5f9',
        darkPanel: '#ffffff',
        glassBg: 'rgba(255, 255, 255, 0.90)',
        glassBorder: 'rgba(0, 0, 0, 0.07)',
        neonBlue: '#0891b2',      // File
        neonPurple: '#9333ea',    // Class
        neonYellow: '#d97706',    // Method
        neonGreen: '#059669',     // API Endpoint
        neonOrange: '#ea580c',    // Database
        neonPink: '#db2777',      // Queue / Kafka
        neonRed: '#e11d48',       // Circular Dependency / Critical
        neonSlate: '#64748b'      // Folders / Unused / Dead code
      },
      boxShadow: {
        glass: '0 4px 24px 0 rgba(0, 0, 0, 0.08)',
        neonBlue: '0 0 12px rgba(8, 145, 178, 0.12)',
        neonPurple: '0 0 12px rgba(147, 51, 234, 0.12)',
        neonGreen: '0 0 12px rgba(5, 150, 105, 0.12)',
        neonRed: '0 0 12px rgba(225, 29, 72, 0.12)',
      },
      backdropBlur: {
        glass: '12px',
      }
    },
  },
  plugins: [],
}
